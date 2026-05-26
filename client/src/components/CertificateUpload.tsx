import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation, Link } from 'wouter';
import { Shield, Eye, ShieldCheck, UploadCloud, Star, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useHashFile } from '../hooks/useHashFile';
import { supabase } from '../lib/supabase';
import UpgradeModal from './UpgradeModal';
import { useCertIssueQuota } from '../hooks/useCertIssueQuota';
import LimitReachedModal from './proof/LimitReachedModal'; // 🚨 月間制限用アップセルモーダル

/* ─────────────────────────────────────────────
 *  Types
 * ───────────────────────────────────────────── */

type ProofMode = 'private' | 'shareable';
type VisibilityMode = 'private' | 'public';

type Phase =
  | 'idle'
  | 'preparing'
  | 'parallel'          // hash + upload を並列実行中
  | 'hash_only'         // upload は終了、ハッシュ計算が残っている
  | 'upload_only'       // hash は終了、upload が残っている
  | 'promoting'         // create.ts で promote 中
  | 'done'
  | 'error';

interface QuotaError {
  status: number;
  body?: { error?: string; quota?: number; used?: number; resetAt?: string };
}

function isQuotaError(err: unknown): err is QuotaError {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; body?: { error?: string } };
  if (e.status === 429) return true;
  if (e.body?.error === 'quota_exceeded') return true;
  return false;
}

/* ─────────────────────────────────────────────
 *  Direct upload helpers (XHR で進捗を取る)
 * ───────────────────────────────────────────── */

interface UploadUrlResponse {
  success: boolean;
  signedUrl: string;
  bucket: string;
  quarantinePath: string;
  ttlSeconds: number;
  error?: string;
}

async function requestUploadUrl(args: {
  file: File;
  token: string;
}): Promise<UploadUrlResponse> {
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify({
      filename: args.file.name,
      contentType: args.file.type || 'application/octet-stream',
      size: args.file.size,
    }),
  });
  const body = (await res.json()) as UploadUrlResponse;
  if (!res.ok || !body.success) {
    throw new Error(body.error || `アップロードURL取得失敗 (${res.status})`);
  }
  return body;
}

function putToSignedUrl(args: {
  signedUrl: string;
  file: File;
  onProgress: (p: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', args.signedUrl);
    xhr.setRequestHeader('Content-Type', args.file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e: ProgressEvent<EventTarget>) => {
      if (e.lengthComputable) args.onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new Error('アップロード通信エラー'));
    xhr.onabort = () => reject(new DOMException('upload aborted', 'AbortError'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`アップロード失敗 HTTP ${xhr.status}`));
    };
    args.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(args.file);
  });
}

/* ─────────────────────────────────────────────
 *  Component
 * ───────────────────────────────────────────── */

export default function CertificateUpload(): JSX.Element {
  const { hashFile } = useHashFile();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { forceLock } = useCertIssueQuota();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [proofMode, setProofMode] = useState<ProofMode>('private');
  const [visibility, setVisibility] = useState<VisibilityMode>('private');

  const [phase, setPhase] = useState<Phase>('idle');
  const [hashProgress, setHashProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [quotaContext, setQuotaContext] = useState<{ used?: number; quota?: number; resetAt?: string }>({});
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false); // 🚨 月間制限モーダル用ステート

  const abortRef = useRef<AbortController | null>(null);

  const actualPlanVariable = user?.user_metadata?.plan_type;
  const currentPlan = (actualPlanVariable || '').toLowerCase();
  const isPaidPlan = currentPlan === 'light' || currentPlan === 'admin';

  /* ── dropzone ── */
  const onDrop = useCallback((files: File[]) => {
    const selected = files[0];
    if (!selected) return;
    setFile(selected);
    setPreview(selected.type.startsWith('image/') ? URL.createObjectURL(selected) : null);
    if (!user || !isPaidPlan) setProofMode('private');
    setPhase('idle');
    setErrorMessage(null);
    setHashProgress(0);
    setUploadProgress(0);
  }, [user, isPaidPlan]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxFiles: 1,
  });

  const isProcessing = phase === 'preparing' || phase === 'parallel' || phase === 'hash_only' || phase === 'upload_only' || phase === 'promoting';

  /* ─────────────────────────────────────────────
   *  Issue: 完全並列 (hash + upload を Promise.all)
   * ───────────────────────────────────────────── */
  const handleIssueCertificate = useCallback(async (): Promise<void> => {
    if (!file) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setPhase('preparing');
    setErrorMessage(null);
    setHashProgress(0);
    setUploadProgress(0);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setPhase('error');
        setErrorMessage('セッションの有効期限が切れました。再度ログインしてください。');
        window.setTimeout(() => { window.location.href = '/auth'; }, 1200);
        return;
      }

      // ── 並列実行: hash と upload を「同時」に走らせる ──
      setPhase('parallel');

      const hashPromise = (async () => {
        const result = await hashFile(file, {
          onProgress: ({ progress }) => setHashProgress(progress),
          signal,
        });
        // upload が未完了なら hash_only へ
        setPhase((prev) => (prev === 'parallel' ? 'hash_only' : prev === 'upload_only' ? 'promoting' : prev));
        return result.sha256;
      })();

      const uploadPromise = (async () => {
        // signed URL 取得 → PUT
        const { signedUrl, quarantinePath } = await requestUploadUrl({ file, token });
        await putToSignedUrl({
          signedUrl,
          file,
          onProgress: (p) => setUploadProgress(p),
          signal,
        });
        // hash が未完了なら upload_only へ
        setPhase((prev) => (prev === 'parallel' ? 'upload_only' : prev === 'hash_only' ? 'promoting' : prev));
        return quarantinePath;
      })();

      const [sha256, quarantinePath] = await Promise.all([hashPromise, uploadPromise]);

      // ── サーバで promote (バイトを送らない、JSON のみ) ──
      setPhase('promoting');

      const createRes = await fetch('/api/certificates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quarantinePath,
          sha256,
          title: file.name,
          proofMode,
          visibility: proofMode === 'shareable' ? visibility : 'private',
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          metadataJson: {
            original_filename: file.name,
            original_size: file.size,
            is_preview_compressed: false,
          },
        }),
        signal,
      });

      if (!createRes.ok) {
        const errData = (await createRes.json().catch(() => ({}))) as { error?: string; message?: string; certificate?: { public_verify_token?: string } };
        
        // 🚨 DBトリガーからの例外エラーメッセージを確実に捕捉（API実装による揺らぎを吸収）
        const errorStr = String(errData.error || errData.message || '');
        if (errorStr.includes('MONTHLY_LIMIT_EXCEEDED')) {
          throw new Error('MONTHLY_LIMIT_EXCEEDED');
        }

        if (createRes.status === 429 || errData.error === 'quota_exceeded') {
          throw { status: createRes.status, body: errData } as QuotaError;
        }
        if (createRes.status === 409 && errData.certificate?.public_verify_token) {
          throw new Error(`すでに同一の証明書が存在します。(Token: ${errData.certificate.public_verify_token})`);
        }
        throw new Error(errData.error || 'Failed to create certificate');
      }

      const result = (await createRes.json()) as { certificate: { id: string } };
      setPhase('done');

      const target = `/cert/${result.certificate.id}`;
      setLocation(target);
      window.setTimeout(() => {
        if (!window.location.pathname.includes(result.certificate.id)) {
          window.location.href = target;
        }
      }, 400);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setPhase('idle');
        return;
      }
      // 🚨 DBトリガーの月間上限エラーを傍受し、アップセルモーダルを展開
      if (err instanceof Error && err.message === 'MONTHLY_LIMIT_EXCEEDED') {
        setIsLimitModalOpen(true);
        setPhase('idle');
        return;
      }
      if (isQuotaError(err)) {
        const body = err.body ?? {};
        setQuotaContext({ used: body.used, quota: body.quota ?? 30, resetAt: body.resetAt });
        forceLock(body.resetAt);
        setUpgradeOpen(true);
        setPhase('idle');
        return;
      }
      console.error('[CertificateUpload] failed', err);
      setPhase('error');
      setErrorMessage(err instanceof Error ? err.message : '不明なエラーが発生しました');
    }
  }, [file, hashFile, proofMode, visibility, setLocation, forceLock]);

  /* ── 表示用集計 ── */
  const overallProgress = useMemo(() => {
    // hash と upload はそれぞれ独立した「終了条件」を持つ。
    // 表示は max(両方の完了度) で UX を素直にする。
    const hashWeight = 0.5;
    const uploadWeight = 0.5;
    const base = hashProgress * hashWeight + uploadProgress * uploadWeight;
    if (phase === 'promoting') return Math.max(base, 0.95);
    if (phase === 'done') return 1;
    return Math.min(base, 0.94);
  }, [hashProgress, uploadProgress, phase]);

  const phaseLabel = useMemo<string>(() => {
    switch (phase) {
      case 'preparing': return 'セッションを確認しています…';
      case 'parallel': return 'ハッシュ計算と隔離アップロードを並列実行中…';
      case 'hash_only': return 'アップロード完了。ハッシュ計算を仕上げ中…';
      case 'upload_only': return 'ハッシュ確定。隔離アップロード完了待ち…';
      case 'promoting': return '隔離領域から本番領域へ昇格中…';
      case 'done': return '完了しました。証明書ページへ移動します…';
      case 'error': return errorMessage ?? 'エラーが発生しました';
      default: return '';
    }
  }, [phase, errorMessage]);

  /* ─────────────────────────────────────────────
   *  Render
   * ───────────────────────────────────────────── */

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-[#0D0B24] rounded-3xl border border-[#1C1A38] text-white shadow-2xl">
      {!user ? (
        <NotLoggedIn />
      ) : !file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? 'border-[#00D4AA] bg-[#00D4AA]/10'
              : 'border-slate-700 hover:border-[#6C3EF4] hover:bg-[#15132D]'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-white font-bold text-xl mb-2">証明するファイルをドロップ</p>
          <p className="text-[#A8A0D8] text-sm">Private: 容量無制限 / Shareable: 画像のみ 50MBまで</p>
        </div>
      ) : (
        <div className="space-y-7 animate-in fade-in duration-500">
          {/* ── 選択ファイル ── */}
          <div className="flex flex-col sm:flex-row gap-6 items-center bg-[#07061A] p-6 rounded-2xl border border-[#1C1A38]">
            {preview ? (
              <img src={preview} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-slate-700" />
            ) : (
              <div className="w-32 h-32 rounded-xl border border-slate-700 bg-[#0D0B24] flex items-center justify-center text-slate-500 text-xs">
                NO PREVIEW
              </div>
            )}
            <div className="flex-1 w-full text-left">
              <p className="text-xs text-[#00D4AA] font-bold uppercase tracking-widest mb-1">Target Asset</p>
              <p className="text-lg font-bold truncate">{file.name}</p>
              <p className="text-sm text-[#A8A0D8]">
                {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'application/octet-stream'}
              </p>
            </div>
            <button
              onClick={() => { setFile(null); setPreview(null); setPhase('idle'); setErrorMessage(null); }}
              className="text-sm text-slate-400 hover:text-white underline transition-colors"
              disabled={isProcessing}
              type="button"
            >
              選び直す
            </button>
          </div>

          {/* ── モード選択 ── */}
          <ModeSelector
            proofMode={proofMode}
            setProofMode={setProofMode}
            visibility={visibility}
            setVisibility={setVisibility}
            isProcessing={isProcessing}
            isPaidPlan={isPaidPlan}
          />

          {/* ── 並列進捗 ── */}
          {isProcessing || phase === 'done' || phase === 'error' ? (
            <ParallelProgress
              phase={phase}
              hashProgress={hashProgress}
              uploadProgress={uploadProgress}
              overall={overallProgress}
              message={phaseLabel}
            />
          ) : null}

          {/* ── アクション ── */}
          <button
            type="button"
            onClick={isProcessing ? () => abortRef.current?.abort() : handleIssueCertificate}
            disabled={phase === 'done'}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-[#00D4AA] to-[#6C3EF4] hover:opacity-90 transition-opacity text-white disabled:opacity-50 flex flex-col items-center justify-center gap-1"
          >
            {isProcessing ? (
              <>
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  処理を中断する
                </span>
                <span className="text-xs font-normal opacity-80">{phaseLabel}</span>
              </>
            ) : phase === 'error' ? (
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                再試行する
              </span>
            ) : (
              'デジタル存在証明を発行する'
            )}
          </button>
        </div>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        used={quotaContext.used}
        quota={quotaContext.quota ?? 30}
        resetAt={quotaContext.resetAt ?? null}
      />

      {/* 🚨 月間発行枠上限 到達時の極上セールスモーダル (DBトリガー連動) */}
      <LimitReachedModal 
        isOpen={isLimitModalOpen} 
        onClose={() => setIsLimitModalOpen(false)} 
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
 *  Subcomponents
 * ───────────────────────────────────────────── */

function NotLoggedIn(): JSX.Element {
  return (
    <div className="py-16 px-6 text-center animate-in fade-in duration-500">
      <ShieldCheck className="w-16 h-16 mx-auto mb-6 text-[#00D4AA] opacity-80" />
      <h2 className="text-2xl font-bold text-white mb-4">証明書を発行するにはログインが必要です</h2>
      <p className="text-[#A8A0D8] mb-8 leading-relaxed max-w-md mx-auto">
        無料でデジタル存在証明を発行・管理するには、アカウント登録（無料）をお願いします。
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link href="/auth">
          <a className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-[#6C3EF4] text-white hover:bg-[#5b34d1] transition-colors">
            ログイン / 無料登録
          </a>
        </Link>
        <Link href="/spot-issue">
          <a className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold border border-[#2a2a4e] text-[#A8A0D8] hover:border-[#00D4AA] hover:text-white transition-colors">
            登録不要で1件だけ発行 (Spot)
          </a>
        </Link>
      </div>
    </div>
  );
}

function ModeSelector(props: {
  proofMode: ProofMode;
  setProofMode: (m: ProofMode) => void;
  visibility: VisibilityMode;
  setVisibility: (v: VisibilityMode) => void;
  isProcessing: boolean;
  isPaidPlan: boolean;
}): JSX.Element {
  const { proofMode, setProofMode, visibility, setVisibility, isProcessing, isPaidPlan } = props;
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#00D4AA]" /> 証明モードの選択
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => !isProcessing && setProofMode('private')}
          disabled={isProcessing}
          className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
            proofMode === 'private'
              ? 'border-[#00D4AA] bg-[#00D4AA]/5'
              : 'border-[#1C1A38] bg-[#07061A] hover:border-slate-600'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Shield className={`w-5 h-5 ${proofMode === 'private' ? 'text-[#00D4AA]' : 'text-slate-500'}`} />
              <h4 className={`font-bold ${proofMode === 'private' ? 'text-[#00D4AA]' : 'text-slate-300'}`}>Private Proof</h4>
            </div>
            {proofMode === 'private' && <div className="w-3 h-3 rounded-full bg-[#00D4AA] shadow-[0_0_10px_#00D4AA]" />}
          </div>
          <p className="text-xs text-[#A8A0D8] mb-3">原画は隔離領域に一時的に置かれた後、ハッシュ確定と同時に破棄されます。</p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isProcessing || !isPaidPlan) return;
            setProofMode('shareable');
            setVisibility('public');
          }}
          disabled={isProcessing || !isPaidPlan}
          className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
            !isPaidPlan
              ? 'opacity-60 cursor-not-allowed bg-[#07061A] border-[#1C1A38]'
              : proofMode === 'shareable'
                ? 'border-[#6C3EF4] bg-[#6C3EF4]/5'
                : 'border-[#1C1A38] bg-[#07061A] hover:border-slate-600'
          }`}
        >
          {!isPaidPlan && (
            <div className="absolute top-3 right-3 bg-gradient-to-r from-[#F0BB38] to-[#E5A822] text-[#1A1200] text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
              <Star className="w-3 h-3" /> LIGHT限定
            </div>
          )}
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Eye className={`w-5 h-5 ${proofMode === 'shareable' ? 'text-[#6C3EF4]' : 'text-slate-500'}`} />
              <h4 className={`font-bold ${proofMode === 'shareable' ? 'text-[#6C3EF4]' : 'text-slate-300'}`}>Shareable Proof</h4>
            </div>
            {proofMode === 'shareable' && <div className="w-3 h-3 rounded-full bg-[#6C3EF4] shadow-[0_0_10px_#6C3EF4]" />}
          </div>
          <p className="text-xs text-[#A8A0D8] mb-3">画像を本番領域へ昇格し、公開検証ページで閲覧可能にします。</p>
        </button>
      </div>

      {proofMode === 'shareable' && (
        <div className="mt-4 p-4 rounded-xl border border-[#1C1A38] bg-[#07061A] animate-in slide-in-from-top-2">
          <h4 className="text-sm font-bold text-white mb-3">公開設定 (Visibility)</h4>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
                className="accent-[#6C3EF4]"
              />
              <span className="text-sm text-slate-300">非公開 (自分のみ閲覧可)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={() => {
                  if (window.confirm('「リンクを知っている全員」に設定すると、URLを知っている第三者も証明書と画像を閲覧できるようになります。よろしいですか？')) {
                    setVisibility('public');
                  }
                }}
                className="accent-[#6C3EF4]"
              />
              <span className="text-sm text-slate-300">リンクを知っている全員</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function ParallelProgress(props: {
  phase: Phase;
  hashProgress: number;
  uploadProgress: number;
  overall: number;
  message: string;
}): JSX.Element {
  const { phase, hashProgress, uploadProgress, overall, message } = props;
  const isError = phase === 'error';
  const isDone = phase === 'done';

  return (
    <div className="rounded-2xl border border-[#1C1A38] bg-[#07061A] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#A8A0D8]">
          {isError ? 'FAILURE' : isDone ? 'COMPLETED' : 'IN PROGRESS'}
        </p>
        <span className="font-mono text-xs text-[#A8A0D8]">{Math.round(overall * 100)}%</span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: `${Math.round(overall * 100)}%`,
            background: isError
              ? '#FF453A'
              : isDone
                ? '#00D4AA'
                : 'linear-gradient(90deg,#6C3EF4,#00D4AA)',
          }}
        />
      </div>

      <p className="text-[12.5px] text-[#D4D0F4]">{message}</p>

      <div className="grid grid-cols-2 gap-3">
        <ParallelTrack
          label="SHA-256 (Web Worker)"
          progress={hashProgress}
          accent="#00D4AA"
        />
        <ParallelTrack
          label="Quarantine Upload"
          progress={uploadProgress}
          accent="#6C3EF4"
        />
      </div>
    </div>
  );
}

function ParallelTrack({ label, progress, accent }: { label: string; progress: number; accent: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-[#1C1A38] bg-[#0D0B24] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A8A0D8]">{label}</span>
        <span className="font-mono text-[11px]" style={{ color: accent }}>{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full transition-[width] duration-200 ease-out"
          style={{ width: `${Math.round(progress * 100)}%`, background: accent }}
        />
      </div>
    </div>
  );
}
