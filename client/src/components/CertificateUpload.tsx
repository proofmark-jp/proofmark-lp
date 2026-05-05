import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation, Link } from 'wouter';
import { Shield, Eye, ShieldCheck, UploadCloud, Lock, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useHashFile } from '../hooks/useHashFile';
import { prepareEvidencePayload } from '../lib/evidence-prep';
import { supabase } from '../lib/supabase';
import UpgradeModal from './UpgradeModal';
import { useCertIssueQuota } from '../hooks/useCertIssueQuota';

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

type ProofMode = 'private' | 'shareable';
type VisibilityMode = 'private' | 'public';

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

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [quotaContext, setQuotaContext] = useState<{ used?: number; quota?: number; resetAt?: string }>({});
  const { forceLock } = useCertIssueQuota();

  const { user, profile } = useAuth(); // profileを追加
  const actualPlanVariable = user?.user_metadata?.plan_type;
  const currentPlan = (actualPlanVariable || '').toLowerCase();
  const isPaidPlan = currentPlan === 'light' || currentPlan === 'admin';

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      if (!user || !isPaidPlan) setProofMode('private'); // 有料プラン判定を追加
    }
  }, [user, isPaidPlan]);

  const handleIssueCertificate = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      setProcessStatus('Web Workerで高速にSHA-256ハッシュを計算中...');
      const { sha256: fileHash } = await hashFile(file);
      setHash(fileHash);

      setProcessStatus('証明書とセキュアストレージデータをサーバーで処理中...');

      let payload;
      try {
        setProcessStatus('ペイロードを最適化中（画像の場合は軽量プレビューを生成）...');
        payload = await prepareEvidencePayload(file, fileHash);
      } catch (prepErr: any) {
        alert('ペイロード生成エラー: ' + prepErr.message);
        setProcessStatus('エラーが発生しました。もう一度お試しください。');
        setIsProcessing(false);
        return;
      }

      const metadataJson = JSON.stringify({
        original_filename: payload.originalName,
        original_size: payload.originalSize,
        is_preview_compressed: payload.isCompressed,
      });

      const formData = new FormData();
      formData.append('file', payload.fileToSend);
      formData.append('title', file.name);
      formData.append('sha256', payload.originalSha256);
      formData.append('proofMode', proofMode);
      formData.append('visibility', proofMode === 'shareable' ? visibility : 'private');
      formData.append('metadataJson', metadataJson);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        setIsProcessing(false);
        setProcessStatus('');
        alert('セッションの有効期限が切れました。安全のため、再度ログインをお願いします。');
        window.location.href = '/auth'; // ログイン画面へ強制リダイレクト
        return;
      }

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/certificates/create', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
         const errData = await res.json().catch(() => ({}));
         
         if (res.status === 429 || errData.error === 'quota_exceeded') {
            throw { status: res.status, body: errData };
         }

         if (res.status === 409) {
            throw new Error(`すでに同一の証明書が存在します。(Token: ${errData.certificate?.public_verify_token})`);
         }
         throw new Error(errData.error || 'Failed to create certificate');
      }

      const result = await res.json();
      const certId = result.certificate.id;

      setProcessStatus('完了しました。証明書ページへリダイレクトします...');

      const targetUrl = `/cert/${certId}`;
      setLocation(targetUrl);
      setTimeout(() => {
         if (!window.location.pathname.includes(certId)) {
            window.location.href = targetUrl;
         }
      }, 500);

    } catch (error: any) {
      if (isQuotaError(error)) {
        const body = error.body ?? {};
        setQuotaContext({
            used: body.used,
            quota: body.quota ?? 30,
            resetAt: body.resetAt,
        });
        forceLock(body.resetAt);
        setUpgradeOpen(true);
        setIsProcessing(false);
        setProcessStatus('');
        return;
      }

      console.error("Process failed:", error);
      alert('アップロードエラー: ' + (error.message || '不明なエラーが発生しました'));
      setProcessStatus('エラーが発生しました。もう一度お試しください。');
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1
  });

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-[#0D0B24] rounded-3xl border border-[#1C1A38] text-white shadow-2xl">
      {!user ? (
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
      ) : !file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${isDragActive
              ? 'border-[#00D4AA] bg-[#00D4AA]/10'
              : 'border-slate-700 hover:border-[#6C3EF4] hover:bg-[#15132D]'
            }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-white font-bold text-xl mb-2">作品をドラッグ＆ドロップして証明を開始</p>
          <p className="text-[#A8A0D8] text-sm">またはクリックしてファイルを選択 (最大20MB)</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row gap-6 items-center bg-[#07061A] p-6 rounded-2xl border border-[#1C1A38]">
            <img src={preview!} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-slate-700" />
            <div className="flex-1 w-full text-left">
              <p className="text-xs text-[#00D4AA] font-bold uppercase tracking-widest mb-1">Target Asset</p>
              <p className="text-lg font-bold truncate">{file.name}</p>
              <p className="text-sm text-[#A8A0D8]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="text-sm text-slate-400 hover:text-white underline transition-colors"
              disabled={isProcessing}
            >
              選び直す
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#00D4AA]" /> 証明モードの選択
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Private Mode */}
              <div
                onClick={() => !isProcessing && setProofMode('private')}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${proofMode === 'private' ? 'border-[#00D4AA] bg-[#00D4AA]/5' : 'border-[#1C1A38] bg-[#07061A] hover:border-slate-600'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className={`w-5 h-5 ${proofMode === 'private' ? 'text-[#00D4AA]' : 'text-slate-500'}`} />
                    <h4 className={`font-bold ${proofMode === 'private' ? 'text-[#00D4AA]' : 'text-slate-300'}`}>Private Proof</h4>
                  </div>
                  {proofMode === 'private' && <div className="w-3 h-3 rounded-full bg-[#00D4AA] shadow-[0_0_10px_#00D4AA]" />}
                </div>
                <p className="text-xs text-[#A8A0D8] mb-3">原画を一切送信せず、ハッシュ情報のみで存在を証明します。</p>
              </div>

      {/* Shareable Mode */}
      <div
        onClick={() => {
          console.log("Current Plan Check:", actualPlanVariable, "=> Evaluated as:", currentPlan);
          if (isProcessing) return;
          if (!user) {
            alert('ログイン（無料登録）が必要です。');
            return;
          }
          if (!isPaidPlan) {
              alert('Shareable ProofはLIGHTプラン専用の機能です。');
              return;
          }
          setProofMode('shareable');
          setVisibility('public'); // Default is public for shareable
        }}
        className={`relative p-5 rounded-2xl border-2 transition-all ${
            !isPaidPlan ? 'opacity-60 cursor-not-allowed bg-[#07061A] border-[#1C1A38]' :
            proofMode === 'shareable' ? 'cursor-pointer border-[#6C3EF4] bg-[#6C3EF4]/5' : 'cursor-pointer border-[#1C1A38] bg-[#07061A] hover:border-slate-600'
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
        <p className="text-xs text-[#A8A0D8] mb-3">画像をセキュアストレージに保存し、公開検証ページに表示します。</p>
      </div>
    </div>

    {/* 公開設定UIを追加 */}
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
                          if (window.confirm("「リンクを知っている全員」に設定すると、URLを知っている第三者も証明書と画像を閲覧できるようになります。よろしいですか？")) {
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

          <button
            onClick={handleIssueCertificate}
            disabled={isProcessing}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-[#00D4AA] to-[#6C3EF4] hover:opacity-90 transition-opacity text-white disabled:opacity-50 flex flex-col items-center justify-center gap-1"
          >
            {isProcessing ? (
              <>
                <span>処理を実行中...</span>
                <span className="text-xs font-normal opacity-80">{processStatus}</span>
              </>
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
    </div>
  );
}