/**
 * CertificateUpload.c2pa-patch.tsx — Phase 10 差分パッチ (新規ファイル)
 *
 * 既存の `CertificateUpload.tsx` をそのまま残しつつ、C2PA 機能を **同じコンポ
 * ーネント名 `CertificateUpload`** で 100% 置換できる差分版です。
 * 既存コードベースに与える影響を最小化するため、import 1 箇所だけを差し替え
 * るだけで Phase 10 が有効化されます。
 *
 *   - Free / 未ログイン: probeC2paMagic() で magic byte を覗き、検出時のみ
 *     C2paUpsell を表示。Web Worker は **絶対に起動しない** (Lazy Activation)。
 *   - 有料プラン (creator / studio / business / light / admin):
 *     useC2pa().parse() を呼び、Scrubbed なマニフェストを取得 →
 *     `formData.append('c2paManifest', JSON.stringify(...))` で API へ送る。
 *   - 失敗 / 無 manifest / SDK ロード不能: いずれの場合も C2PA は付かないが
 *     基本フローは 1ms の遅延もなく続行 (Apple-level UX)。
 *
 * ▼ 差し替え方
 *   App.tsx などの `import CertificateUpload from './components/CertificateUpload'`
 *   を `import CertificateUpload from './components/CertificateUpload.c2pa-patch'`
 *   に変更するだけで OK。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2, Eye, Lock, Shield, ShieldCheck, Sparkles, Star, UploadCloud,
  AlertTriangle, FileSearch,
  Archive, FileText, Palette, Code2, File,
} from 'lucide-react';

import { cn } from '../lib/utils';
import { PM, EASE, D } from './dashboard/obsidian-tokens';

import { useAuth } from '../hooks/useAuth';
import { useHashFile } from '../hooks/useHashFile';
import { supabase } from '../lib/supabase';
import { useC2pa, probeC2paMagic } from '../hooks/useC2pa';
import { C2paUpsell } from './cert/C2paUpsell';
import type { C2paManifest } from '../lib/c2pa-schema';
import { DeliveryKitModal } from './DeliveryKitModal';
import { usePromoteCertificate } from '../hooks/usePromoteCertificate';

async function requestUploadUrl(file: File, token: string) {
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Failed to get upload URL');
  }
  return res.json() as Promise<{ signedUrl: string; quarantinePath: string }>;
}

function putToSignedUrl(signedUrl: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

type ProofMode = 'private' | 'shareable';
type VisibilityMode = 'private' | 'public';

const PAID_TIERS = new Set(['creator', 'studio', 'business', 'light', 'admin']);

/** ファイル拡張子からLucideアイコンを返すヘルパー */
function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive;
  if (ext === 'pdf') return FileText;
  if (['psd', 'ai', 'sketch', 'fig', 'xd'].includes(ext)) return Palette;
  if (['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'c', 'cpp', 'h', 'java', 'swift', 'kt', 'css', 'html', 'json', 'yaml', 'yml', 'toml', 'xml', 'sh'].includes(ext)) return Code2;
  return File;
}

export default function CertificateUpload() {
  const { hashFile } = useHashFile();
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [proofMode, setProofMode] = useState<ProofMode>('private');
  const [visibility, setVisibility] = useState<VisibilityMode>('private');
  const [processStatus, setProcessStatus] = useState<string>('');
  const [, setLocation] = useLocation();

  const [deliveryModalFile, setDeliveryModalFile] = useState<File | null>(null);
  const [deliveryFileHash, setDeliveryFileHash] = useState<string | null>(null);
  const { promote, isPromoting } = usePromoteCertificate();

  // Obsidian Desk UI States
  const [windowDragActive, setWindowDragActive] = useState(false);
  const [shellError, setShellError] = useState<string | null>(null);

  // グローバルドラッグ検知
  useEffect(() => {
    // タッチデバイスではドラッグUIを無効化
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    const onEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) setWindowDragActive(true);
    };
    const onLeave = (e: DragEvent) => {
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setWindowDragActive(false);
      }
    };
    const onDrop = () => setWindowDragActive(false);

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', (e) => e.preventDefault());
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const { user, profile } = useAuth();

  // plan_tier の解決順序: profiles.plan_tier を最優先, fallback で metadata.plan_type
  const planTier: string =
    (profile?.plan_tier as string | undefined)?.toLowerCase() ??
    String(user?.user_metadata?.plan_type ?? 'free').toLowerCase();
  const isPaidPlan = PAID_TIERS.has(planTier);

  // ── Phase 10: C2PA Worker (Lazy 起動。Free/未ログインは初期化されない) ──
  const c2pa = useC2pa(planTier);

  // ── ドロップ時の状態 ────────────────────────────────────────
  const [c2paManifest, setC2paManifest] = useState<C2paManifest | null>(null);
  const [c2paSignal, setC2paSignal] = useState<'idle' | 'detected' | 'analysing' | 'found' | 'invalid' | 'absent'>('idle');
  const [c2paUpsellOpen, setC2paUpsellOpen] = useState(false);
  const [c2paUpsellDismissed, setC2paUpsellDismissed] = useState(false);

  // ── proofMode 切替時のファイルバリデーション安全装置 ──────────────
  useEffect(() => {
    if (!file) return;
    if (proofMode === 'shareable' && !file.type.startsWith('image/')) {
      // Shareable に切り替えたが、選択中のファイルが画像でない → クリア
      setFile(null);
      setPreview(null);
      setC2paManifest(null);
      setC2paSignal('idle');
      setShellError('Shareable Proof は画像ファイル専用です。ファイルをクリアしました。');
      setTimeout(() => setShellError(null), 4200);
    }
  }, [proofMode]); // file は意図的に deps から外す（モード切替時のみ発火）

  // ── 動的 Dropzone accept（proofMode 連動） ──────────────────────
  const dropzoneAccept = useMemo(() => {
    if (proofMode === 'shareable') return { 'image/*': [] };
    return undefined; // Private: 全ファイル受け入れ
  }, [proofMode]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;

    // TODO: [Phase 2] 500MB以上のファイル対応。Web WorkerとChunkingを用いたストリーミングハッシュ計算エンジンへリプレイスすること。
    const HARD_LIMIT = 500 * 1024 * 1024; // 500MB
    if (selectedFile.size > HARD_LIMIT) {
      setFile(null);
      setPreview(null);
      setShellError('ブラウザのメモリ制限（500MB）を超過しました。超大容量アセットの証明に対応した次世代エンジンを現在開発中です。');
      setTimeout(() => setShellError(null), 6000);
      return;
    }

    // プレビュー / state リセット
    setFile(selectedFile);
    // 画像ファイルのみプレビュー生成（非画像は null）
    if (selectedFile.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setPreview(null);
    }
    setC2paManifest(null);
    setC2paUpsellDismissed(false);
    setC2paUpsellOpen(false);
    if (!user || !isPaidPlan) setProofMode('private');

    // ─── Phase 10: C2PA 検知 ───────────────────────────────
    if (isPaidPlan && c2pa.enabled) {
      // 有料プラン → Web Worker でフルパース
      setC2paSignal('analysing');
      try {
        const r = await c2pa.parse(selectedFile);
        if (r.kind === 'manifest') {
          setC2paManifest(r.manifest);
          setC2paSignal(r.manifest.validity === 'invalid' ? 'invalid' : 'found');
        } else {
          setC2paSignal('absent');
        }
      } catch {
        // 想定外でもユーザー体験を 1ms も止めない
        setC2paSignal('absent');
      }
    } else {
      // Free / 未ログイン → byte magic だけで検知 (Worker は起動しない)
      try {
        const probably = await probeC2paMagic(selectedFile);
        if (probably) {
          setC2paSignal('detected');
          setC2paUpsellOpen(true);
        } else {
          setC2paSignal('absent');
        }
      } catch {
        setC2paSignal('absent');
      }
    }
  }, [user, isPaidPlan, c2pa]);

  // unmount で Worker を確実に破棄
  useEffect(() => () => c2pa.dispose(), [c2pa]);

  const handleIssueCertificate = async () => {
    if (!file) return;

    if (proofMode === 'private') {
      setIsProcessing(true);
      setProcessStatus('ローカル暗号化の準備中...');
      try {
        const hashResult = await hashFile(file);
        setDeliveryFileHash(hashResult.sha256);
        setDeliveryModalFile(file); // モーダル展開
      } catch (e) {
        setShellError('ハッシュ計算に失敗しました');
        setTimeout(() => setShellError(null), 4200);
      } finally {
        setIsProcessing(false);
        setProcessStatus('');
      }
      return; // ★ 絶対にここで処理を終了させ、下部のShareableルートを遮断する
    }

    setIsProcessing(true);
    try {
      setProcessStatus('準備中...');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setIsProcessing(false);
        setProcessStatus('');
        alert('安全のため、自動的にログアウトしました。お手数ですが、もう一度ログインをお願いします。');
        window.location.href = '/auth';
        return;
      }

      // 並列処理: ハッシュ計算 & アップロードURL取得
      setProcessStatus('ハッシュ計算 & セキュア通信の準備中...');
      const [hashResult, uploadInfo] = await Promise.all([
        hashFile(file),
        requestUploadUrl(file, token)
      ]);

      const fileHash = hashResult.sha256;
      setHash(fileHash);

      // ダイレクトアップロード (Vercelを経由せずSupabase Storageへ直行)
      setProcessStatus('セキュア領域へ暗号化転送中...');
      await putToSignedUrl(uploadInfo.signedUrl, file);

      // APIへJSONだけを送信 (Zero-Copy Promote)
      setProcessStatus('証明書を発行中...');
      const payload = {
        quarantinePath: uploadInfo.quarantinePath,
        sha256: fileHash,
        title: file.name,
        proofMode: proofMode,
        visibility: proofMode === 'shareable' ? visibility : 'private',
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        metadataJson: {
          original_filename: file.name,
          original_size: file.size,
          is_preview_compressed: false,
        },
        c2paManifest: isPaidPlan && c2paManifest ? JSON.stringify(c2paManifest) : null,
      };

      const res = await fetch('/api/certificates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          throw new Error(`すでに同一の証明書が存在します。(Token: ${errData.certificate?.public_verify_token})`);
        }
        throw new Error(errData.error || 'Failed to create certificate');
      }

      const result = await res.json();
      const certId = result.certificate.id;

      // --- Fire and Forget TSA Trigger (バックグラウンド自動付与) ---
      // ユーザーの画面遷移をブロックしないようawaitせず、keepaliveでブラウザに確実な送信を担保させる
      fetch('/api/timestamp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ certId, hash: fileHash }),
        keepalive: true,
      }).catch(err => console.error('[Background TSA] Failed to trigger:', err));
      // --------------------------------------------------------------
      setProcessStatus('完了。証明書ページへ遷移します...');
      const targetUrl = `/cert/${certId}`;
      setLocation(targetUrl);
      setTimeout(() => {
        if (!window.location.pathname.includes(certId)) {
          window.location.href = targetUrl;
        }
      }, 500);

    } catch (e) {
      console.error(e);
      const errMsg = (e as Error).message || 'エラーが発生しました';
      setShellError(errMsg); // 全文をそのまま渡す
      //       setTimeout(() => setShellError(null), 4200);
      setProcessStatus('エラーが発生しました。もう一度お試しください。');
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: dropzoneAccept,
    maxFiles: 1,
  });

  const computedPhase = shellError ? 'error' : (isProcessing || c2paSignal === 'analysing') ? 'active' : windowDragActive ? 'hover' : 'idle';

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-[32px] overflow-hidden" style={{ background: PM.surface }}>
      {/* Dimmer (hover時) */}
      <motion.div
        initial={false}
        animate={{ opacity: computedPhase === 'hover' ? 1 : 0 }}
        transition={{ duration: D.fast, ease: EASE }}
        className="pointer-events-none absolute inset-0 z-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(7,6,26,0.55)' }}
      />
      {/* パルスボーダー (hover時) */}
      <motion.div
        initial={false}
        animate={{ opacity: computedPhase === 'hover' ? 1 : 0 }}
        transition={{ duration: D.base, ease: EASE, repeat: Infinity, repeatType: 'reverse' }}
        className="pointer-events-none absolute inset-0 z-0 rounded-[32px] border-[3px]"
        style={{ borderColor: PM.primary }}
      />
      {/* 枠発光 (error時) */}
      <motion.div
        initial={false}
        animate={{ opacity: computedPhase === 'error' ? 1 : 0 }}
        transition={{ duration: D.base, ease: EASE }}
        className="pointer-events-none absolute inset-0 z-0 rounded-[32px] border-2"
        style={{ borderColor: PM.error, boxShadow: `inset 0 0 40px ${PM.errorSoft}` }}
      />

      {/* ここから内側のコンテンツ (z-[1]) */}
      <div className="relative z-[1] p-6 sm:p-10">
        {shellError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <div className="flex items-center gap-2 rounded-full px-4 py-2 shadow-2xl backdrop-blur-md" style={{ background: 'rgba(255,69,58,0.15)', border: `1px solid ${PM.errorRing}` }}>
              <AlertTriangle className="w-4 h-4" style={{ color: PM.error }} />
              <span className="text-[13px] font-bold tracking-wide text-white">{shellError}</span>
            </div>
          </motion.div>
        )}
        {/* Free 検出時のアップセル (Worker は起動しない) */}
        <AnimatePresence>
          {c2paUpsellOpen && !c2paUpsellDismissed && !isPaidPlan && (
            <C2paUpsell
              onUpgrade={() => setLocation('/pricing')}
              onDismiss={() => { setC2paUpsellDismissed(true); setC2paUpsellOpen(false); }}
            />
          )}
        </AnimatePresence>

        {!file ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${isDragActive
              ? 'border-[#00D4AA] bg-[#00D4AA]/10'
              : 'border-slate-700 hover:border-[#6C3EF4] hover:bg-[#15132D]'
              }`}
          >
            <input {...getInputProps()} />
            <IdleHero
              title="証明するファイルをドロップ"
              subtitle="Private: 容量無制限 / Shareable: 画像のみ 50MBまで"
            />
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row gap-6 items-center bg-[#07061A] p-6 rounded-2xl border border-[#1C1A38]">
              {preview ? (
                <img src={preview} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-slate-700" />
              ) : (() => {
                const IconComponent = getFileIcon(file.name);
                const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
                return (
                  <div
                    className="w-32 h-32 rounded-xl border border-[#1C1A38] flex flex-col items-center justify-center gap-2 relative overflow-hidden"
                    style={{
                      background: 'rgba(13,11,36,0.85)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                  >
                    <IconComponent className="w-9 h-9" style={{ color: PM.primary, opacity: 0.7 }} />
                    <span
                      className="text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded"
                      style={{ color: PM.textSubtle, background: 'rgba(108,62,244,0.1)' }}
                    >
                      .{ext}
                    </span>
                    {/* Private Mode バッジ */}
                    <span
                      className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[7px] font-semibold tracking-wider uppercase whitespace-nowrap"
                      style={{ color: PM.success, opacity: 0.55 }}
                    >
                      <Lock className="w-2 h-2" />
                      Zero-Knowledge
                    </span>
                  </div>
                );
              })()}
              <div className="flex-1 w-full text-left">
                <p className="text-xs text-[#00D4AA] font-bold uppercase tracking-widest mb-1">Target Asset</p>
                <p className="text-lg font-bold truncate">{file.name}</p>
                <p className="text-sm text-[#A8A0D8]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                {/* Private Mode: ゼロ知識バッジ (非画像ファイル時) */}
                {!preview && proofMode === 'private' && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase" style={{ color: PM.success, opacity: 0.7 }}>
                    <Lock className="w-3 h-3" />
                    Private Mode — No data sent to server
                  </p>
                )}
                {/* Phase 10: Content Credentials Found シグナル (有料時のみ) */}
                <C2paInlineSignal signal={c2paSignal} manifest={c2paManifest} />
              </div>
              <button
                onClick={() => { setFile(null); setPreview(null); setC2paManifest(null); setC2paSignal('idle'); }}
                className="text-sm text-slate-400 hover:text-white underline transition-colors"
                disabled={isProcessing}
              >
                選び直す
              </button>
            </div>

            {/* 既存の Proof Mode 選択 (元コードから論理を維持) */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00D4AA]" /> 証明モードの選択
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => !isProcessing && setProofMode('private')}
                  className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${proofMode === 'private' ? 'border-[#00D4AA] bg-[#00D4AA]/5' : 'border-[#1C1A38] bg-[#07061A] hover:border-slate-600'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className={`w-5 h-5 ${proofMode === 'private' ? 'text-[#00D4AA]' : 'text-slate-500'}`} />
                    <h4 className={`font-bold ${proofMode === 'private' ? 'text-[#00D4AA]' : 'text-slate-300'}`}>Private Proof</h4>
                  </div>
                  <p className="text-xs text-[#A8A0D8] mb-3 font-semibold">ファイルはPCから一歩も外に出ません。数GBの機密データも一瞬で存在証明が完了します</p>
                  <div className="flex flex-col gap-1.5 text-[11px] text-slate-400">
                    <p>対応形式: <span className="text-white">すべてのファイル（動画、ZIP、3Dモデル、ソースコード等）</span></p>
                    <p>上限サイズ: <span className="text-[#00D4AA] font-bold">無制限 (Unlimited)</span> ※ブラウザの処理能力に依存</p>
                  </div>
                </div>

                <div
                  onClick={() => {
                    if (isProcessing) return;
                    if (!user) {
                      setShellError('ログインが必要です');
                      setTimeout(() => setShellError(null), 4200);
                      return;
                    }
                    if (!isPaidPlan) {
                      setShellError('Shareable Proof は有料プラン専用です');
                      setTimeout(() => setShellError(null), 4200);
                      return;
                    }
                    setProofMode('shareable');
                  }}
                  className={`relative p-5 rounded-2xl border-2 transition-all ${!isPaidPlan ? 'opacity-60 cursor-not-allowed bg-[#07061A] border-[#1C1A38]'
                    : proofMode === 'shareable' ? 'cursor-pointer border-[#6C3EF4] bg-[#6C3EF4]/5'
                      : 'cursor-pointer border-[#1C1A38] bg-[#07061A] hover:border-slate-600'
                    }`}
                >
                  {!isPaidPlan && (
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-[#F0BB38] to-[#E5A822] text-[#1A1200] text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                      <Star className="w-3 h-3" /> 有料限定
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className={`w-5 h-5 ${proofMode === 'shareable' ? 'text-[#6C3EF4]' : 'text-slate-500'}`} />
                    <h4 className={`font-bold ${proofMode === 'shareable' ? 'text-[#6C3EF4]' : 'text-slate-300'}`}>Shareable Proof</h4>
                  </div>
                  <p className="text-xs text-[#A8A0D8] mb-3 font-semibold">ポートフォリオやSNSでの公開・シェアに特化した軽量モード</p>
                  <div className="flex flex-col gap-1.5 text-[11px] text-slate-400">
                    <p>対応形式: <span className="text-white">画像のみ (JPG, PNG, WEBP 等)</span></p>
                    <p>上限サイズ: <span className="text-white">50MBまで</span></p>
                  </div>
                </div>
              </div>

              {/* 公開設定UI (Visibility) */}
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
                      <span className="text-sm text-[#F0EFF8]">非公開 (自分のみ閲覧可)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="visibility"
                        value="public"
                        checked={visibility === 'public'}
                        onChange={() => setVisibility('public')}
                        className="accent-[#6C3EF4]"
                      />
                      <span className="text-sm text-[#F0EFF8]">リンクを知っている全員</span>
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-[#A8A0D8]">
                    「リンクを知っている全員」に設定すると、URLを知っている第三者も証明書と画像を閲覧できるようになります。
                  </p>
                </div>
              )}
            </div>

            {isProcessing || c2paSignal === 'analysing' ? (
              <div className="w-full">
                <SilentProgress caption={processStatus || '処理中...'} />
              </div>
            ) : (
              <button
                onClick={handleIssueCertificate}
                disabled={isProcessing || c2paSignal === 'analysing'}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-[#00D4AA] to-[#6C3EF4] hover:opacity-90 transition-opacity text-white disabled:opacity-50 flex items-center justify-center"
              >
                デジタル存在証明を発行する
              </button>
            )}
          </div>
        )}
      </div>
      <DeliveryKitModal
        isOpen={!!deliveryModalFile}
        file={deliveryModalFile}
        fileHash={deliveryFileHash}
        onClose={() => {
          if (isPromoting) return;
          setDeliveryModalFile(null);
          setDeliveryFileHash(null);
        }}
        onComplete={async (payload) => {
          try {
            if (!deliveryModalFile) return;
            setProcessStatus('WORM台帳へ昇格中...');
            const res = await promote({
              ...payload,
              c2paManifest: isPaidPlan && c2paManifest ? JSON.stringify(c2paManifest) : null
            }, deliveryModalFile);

            setShellError('Private Proofの封印が完了しました');
            setTimeout(() => setShellError(null), 4200);

            setDeliveryModalFile(null);
            setDeliveryFileHash(null);

            const certId = res.certificate?.id || (res as any).id;

            if (!certId || typeof certId !== 'string') {
              throw new Error("証明書は作成されましたが、IDの取得に失敗しました。ダッシュボードをリロードしてください。");
            }

            const targetUrl = `/cert/${certId}`;
            window.location.href = targetUrl;
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : '昇格に失敗しました';
            setShellError(errMsg);
            setTimeout(() => setShellError(null), 4200);
          }
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function C2paInlineSignal({
  signal,
  manifest,
}: {
  signal: 'idle' | 'detected' | 'analysing' | 'found' | 'invalid' | 'absent';
  manifest: C2paManifest | null;
}) {
  if (signal === 'idle' || signal === 'absent') return null;

  if (signal === 'detected') {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#00D4AA' }}>
        <Sparkles className="w-3 h-3" aria-hidden="true" />
        Content Credentials Found
      </p>
    );
  }
  if (signal === 'analysing') {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[#A8A0D8]">
        <Lock className="w-3 h-3" aria-hidden="true" />
        Content Credentials を解析中...
      </p>
    );
  }
  if (signal === 'invalid') {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#E74C3C' }}>
        C2PA 署名 破損 — 通常通り発行を続行できます
      </p>
    );
  }
  // found
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#00D4AA' }}>
      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
      Content Credentials 検証OK
      {manifest?.issuer && <span className="text-[#A8A0D8]"> · {manifest.issuer}</span>}
    </p>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/**
 * IdleHero — ドロップゾーンが空のときに「子の上」に重ねる薄い導入レイヤー。
 *
 * 仕様: 「破線ボーダーと控えめなアイコン（UploadCloud等）のみの極めてミニマル」
 *       「マーケティング的な長文は全削除」
 *       「証明したいファイルをドロップ（SHA-256 / 15MBまで）」
 *
 * ※ 子コンポーネントの DOM は壊さず、IdleHero は別ノードとして並列描画する。
 *    本ラッパーを使う側（Dashboard.obsidian.tsx）が、現行 CertificateUpload の
 *    既定ヘッダ文言を非表示にしたいときに opt-in で使うためのプレゼン層。
 */
export function IdleHero({
  title = '証明したいファイルをドロップ',
  subtitle,
  maxSizeMB = 15,
  isMobile = false,
}: {
  title?: string;
  subtitle?: string;
  maxSizeMB?: number;
  isMobile?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none flex flex-col items-center justify-center text-center',
        'rounded-2xl',
        'select-none',
      )}
      style={{
        color: PM.textMuted,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: D.slow / 1000, ease: EASE }}
        className="flex flex-col items-center gap-3"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: PM.surface,
            border: `1px solid ${PM.border}`,
          }}
        >
          <UploadCloud className="w-6 h-6" aria-hidden="true" style={{ color: PM.textMuted }} />
        </div>
        <p
          className={cn(
            'font-semibold tracking-tight',
            isMobile ? 'text-[17px]' : 'text-[18px]',
          )}
          style={{ color: PM.textMain }}
        >
          {title}
        </p>
        <p
          className="text-[12px] tracking-wider"
          style={{ color: PM.textSubtle, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
        >
          {subtitle || `SHA-256 / ${maxSizeMB}MB まで`}
        </p>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/**
 * SilentProgress — Apple-like 上品なプログレス表現。
 *
 * 仕様: 「単なる汎用スピナーは不可。Apple製品のような、ソリッドで高級感のある
 *        プログレスバー、またはハッシュ計算を暗示する静かなスキャンアニメーション」
 *
 * ※ 子の disabled ボタンを観測した結果に応じて、UploadShell が active に入った
 *    タイミングでこのレイヤーを表示することを意図している。
 */
export function SilentProgress({ caption }: { caption?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: PM.surface,
        border: `1px solid ${PM.border}`,
      }}
    >
      <FileSearch className="w-4 h-4" aria-hidden="true" style={{ color: PM.success }} />
      <div className="flex-1">
        <div
          className="h-[3px] rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="h-full"
            initial={{ width: '0%', x: 0 }}
            animate={{ width: ['18%', '38%', '62%', '82%', '92%'] }}
            transition={{ duration: 2.4, ease: EASE, repeat: Infinity, repeatType: 'reverse' }}
            style={{
              background: `linear-gradient(90deg, ${PM.primary}, ${PM.success})`,
            }}
          />
        </div>
        <p
          className="mt-1.5 text-[11px] tracking-wider"
          style={{ color: PM.textSubtle, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
        >
          {caption ?? 'Hashing · Timestamping · Anchoring'}
        </p>
      </div>
    </div>
  );
}

