/**
 * CertificateUpload.c2pa-patch.tsx — Phase 10 + Magic Dropzone (改修版)
 *
 * 改修点 (Magic Dropzone / Intelligent Routing):
 *   - `useDropzone` の maxFiles 制限を解除、`multiple: true` に変更。
 *   - onDrop に投げ込まれたファイル数で分岐:
 *       1 枚 → 既存 Single Proof フロー（圧縮なし・無変換）
 *       2 枚以上 → Chain of Evidence へ自動ルーティング
 *           - Free / 未ログイン → 中断 + ChainUpsell バナー
 *           - Creator (creator/light) → 最大 10 枚 (超過は切り捨て + 警告)
 *           - Studio / Business / Admin → 最大 150 枚 (超過は切り捨て + 警告)
 *           - 制限通過したファイルを ProcessBundleComposer にフルスクリーンで渡す
 *
 * 不変条件 (一切壊さない):
 *   - C2PA Lazy Activation (probeC2paMagic / useC2pa)
 *   - DeliveryKitModal / promote フロー
 *   - Framer Motion による Dimmer / パルスボーダー / 枠発光
 *   - Free / 未ログインの C2PA Upsell
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2, Eye, Lock, Shield, ShieldCheck, Sparkles, Star, UploadCloud,
  AlertTriangle, FileSearch,
  Archive, FileText, Palette, Code2, File,
  Layers3, X, Zap,
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
import { ProcessBundleComposer } from './proof/ProcessBundleComposer';
import { createPortal } from 'react-dom';

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

/* ─── Chain of Evidence プラン別ファイル上限 ─── */
const CHAIN_LIMIT_CREATOR = 10;   // creator / light
const CHAIN_LIMIT_STUDIO = 150;   // studio / business / admin

/** plan_tier 文字列から Chain of Evidence の最大枚数を導出する。 */
function chainLimitFor(planTier: string): number {
  const t = planTier.toLowerCase();
  if (t === 'studio' || t === 'business' || t === 'admin') return CHAIN_LIMIT_STUDIO;
  if (t === 'creator' || t === 'light') return CHAIN_LIMIT_CREATOR;
  return 0; // Free / Guest — 工程証明は使えない
}

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

  /* ───────────────────────────────────────────────────────────────
     Magic Dropzone States (Chain of Evidence Routing)
     ─────────────────────────────────────────────────────────────── */
  const [bundleInitialFiles, setBundleInitialFiles] = useState<File[] | null>(null);
  const [chainUpsellOpen, setChainUpsellOpen] = useState(false);

  // グローバルドラッグ検知
  useEffect(() => {
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
  const chainLimit = chainLimitFor(planTier);
  const canUseChain = !!user && chainLimit > 0;

  // ── Phase 10: C2PA Worker (Lazy 起動。Free/未ログインは初期化されない) ──
  const c2pa = useC2pa(planTier);

  // ── ドロップ時の状態 ────────────────────────────────────────
  const [c2paManifest, setC2paManifest] = useState<C2paManifest | null>(null);
  const [c2paSignal, setC2paSignal] = useState<'idle' | 'detected' | 'analysing' | 'found' | 'invalid' | 'absent'>('idle');
  const [c2paUpsellOpen, setC2paUpsellOpen] = useState(false);
  const [c2paUpsellDismissed, setC2paUpsellDismissed] = useState(false);

  // ── proofMode 切替時のファイルバリデーション安全装置 ─────────────
  useEffect(() => {
    if (!file) return;
    if (proofMode === 'shareable' && !file.type.startsWith('image/')) {
      setFile(null);
      setPreview(null);
      setC2paManifest(null);
      setC2paSignal('idle');
      setShellError('Shareable Proof は画像ファイル専用です。ファイルをクリアしました。');
      setTimeout(() => setShellError(null), 4200);
    }
  }, [proofMode]);

  // ── 動的 Dropzone accept（proofMode 連動） ──────────────────────
  const dropzoneAccept = useMemo(() => {
    if (proofMode === 'shareable') return { 'image/*': [] };
    return undefined;
  }, [proofMode]);

  /* ═══════════════════════════════════════════════════════════════
     Single Proof 用の通常 onDrop 処理（既存挙動 100% 維持）
     ═══════════════════════════════════════════════════════════════ */
  const ingestSingleFile = useCallback(async (selectedFile: File) => {
    const HARD_LIMIT = 500 * 1024 * 1024; // 500MB
    if (selectedFile.size > HARD_LIMIT) {
      setFile(null);
      setPreview(null);
      setShellError('ブラウザのメモリ制限（500MB）を超過しました。超大容量アセットの証明に対応した次世代エンジンを現在開発中です。');
      setTimeout(() => setShellError(null), 6000);
      return;
    }

    setFile(selectedFile);
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
        setC2paSignal('absent');
      }
    } else {
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

  /* ═══════════════════════════════════════════════════════════════
     Magic Dropzone: 投入ファイル数で Single / Chain を分岐
     ═══════════════════════════════════════════════════════════════ */
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    // ─── Single Proof フロー（1 枚）: 既存挙動を 1ms も変えない ─────
    if (acceptedFiles.length === 1) {
      await ingestSingleFile(acceptedFiles[0]);
      return;
    }

    // ─── Chain of Evidence フロー（2 枚以上） ──────────────────────
    //
    // Chain は画像のみで構成する。非画像ファイルが混入していた場合は
    // 警告して画像のみを採用する（Single 用ファイルとは混在させない）。
    const imageOnly = acceptedFiles.filter((f) => f.type.startsWith('image/'));
    if (imageOnly.length === 0) {
      setShellError('Chain of Evidence は画像ファイル専用です。画像が含まれていません。');
      setTimeout(() => setShellError(null), 5000);
      return;
    }
    if (imageOnly.length < acceptedFiles.length) {
      const dropped = acceptedFiles.length - imageOnly.length;
      setShellError(`非画像ファイル ${dropped} 件を除外して工程証明を開始します。`);
      setTimeout(() => setShellError(null), 4200);
    }

    // ─── Plan Guard: Free / 未ログインは Chain 不可 ────────────────
    if (!canUseChain) {
      setChainUpsellOpen(true);
      return;
    }

    // ─── Hard Cap: プラン上限を超えたら切り捨て + 警告 ─────────────
    let accepted = imageOnly;
    if (imageOnly.length > chainLimit) {
      accepted = imageOnly.slice(0, chainLimit);
      setShellError(
        `${planTier} プランの上限 ${chainLimit} 枚を超えたため、超過 ${imageOnly.length - chainLimit} 枚を切り捨てて開始します。`
      );
      setTimeout(() => setShellError(null), 6000);
    }

    // ─── Composer をフルスクリーンで起動 ───────────────────────────
    //
    // ファイル配列の「最後の 1 枚」が HEAD (完成品) として扱われる。
    // ProcessBundleComposer 側でハイブリッド圧縮が掛かるのは
    // index 0 .. length-2 のみ。
    setBundleInitialFiles(accepted);
  }, [canUseChain, chainLimit, planTier, ingestSingleFile]);

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
        setDeliveryModalFile(file);
      } catch (e) {
        setShellError('ハッシュ計算に失敗しました');
        setTimeout(() => setShellError(null), 4200);
      } finally {
        setIsProcessing(false);
        setProcessStatus('');
      }
      return;
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

      setProcessStatus('ハッシュ計算 & セキュア通信の準備中...');
      const [hashResult, uploadInfo] = await Promise.all([
        hashFile(file),
        requestUploadUrl(file, token)
      ]);

      const fileHash = hashResult.sha256;
      setHash(fileHash);

      setProcessStatus('セキュア領域へ暗号化転送中...');
      await putToSignedUrl(uploadInfo.signedUrl, file);

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
      const certId = result.certificates?.[0]?.id || result.certificate?.id;
      if (!certId) throw new Error("証明書のIDが取得できませんでした。");

      sessionStorage.setItem('tsa_syncing_' + certId, 'true');
      fetch('/api/timestamp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ certId, hash: fileHash }),
        keepalive: true,
      }).catch(err => console.error('[Background TSA] Failed to trigger:', err));

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
      setShellError(errMsg);
      setProcessStatus('エラーが発生しました。もう一度お試しください。');
      setIsProcessing(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     useDropzone — Magic Dropzone (multiple: true)
     ═══════════════════════════════════════════════════════════════ */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: dropzoneAccept,
    multiple: true,
    // maxFiles を撤廃: 上限はプラン側ロジックで動的に判定する
  });

  const computedPhase = shellError ? 'error' : (isProcessing || c2paSignal === 'analysing') ? 'active' : windowDragActive ? 'hover' : 'idle';

  /* ═══════════════════════════════════════════════════════════════
     Chain of Evidence フルスクリーン展開
     ═══════════════════════════════════════════════════════════════ */
  if (bundleInitialFiles && bundleInitialFiles.length >= 2) {
    return (
      <ChainOverlay
        initialFiles={bundleInitialFiles}
        onClose={() => setBundleInitialFiles(null)}
      />
    );
  }

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

        {/* Chain of Evidence Upsell (Free / 未ログインが複数ファイル投入時) */}
        <AnimatePresence>
          {chainUpsellOpen && (
            <ChainUpsell
              onUpgrade={() => setLocation('/pricing')}
              onDismiss={() => setChainUpsellOpen(false)}
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
              subtitle={
                canUseChain
                  ? `1 枚 = 単発証明 / 2 枚以上 = 工程証明 (最大 ${chainLimit} 枚)`
                  : 'Private: 容量無制限 / Shareable: 画像のみ 50MBまで'
              }
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
                {!preview && proofMode === 'private' && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase" style={{ color: PM.success, opacity: 0.7 }}>
                    <Lock className="w-3 h-3" />
                    Private Mode — No data sent to server
                  </p>
                )}
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

            const certId = (res as any).certificates?.[0]?.id || res.certificate?.id || (res as any).id;
            if (!certId || typeof certId !== 'string') {
              throw new Error("証明書は作成されましたが、IDの取得に失敗しました。ダッシュボードをリロードしてください。");
            }
            window.location.href = `/cert/${certId}`;
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

/* ═══════════════════════════════════════════════════════════════════
   ChainOverlay — Chain of Evidence をフルスクリーンで展開する薄いラッパ
   ═══════════════════════════════════════════════════════════════════ */

function ChainOverlay({
  initialFiles,
  onClose,
}: {
  initialFiles: File[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // 🚨 SSRを回避し、クライアント側でのみPortalを起動するためのフラグ
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const overlayContent = (
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(7,6,26,0.95)',
        backdropFilter: 'blur(12px)',
        zIndex: 99999,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="min-h-full px-4 py-8 md:px-8 md:py-12"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(0,212,170,0.12)',
                  border: '1px solid rgba(0,212,170,0.35)',
                  color: PM.success,
                }}
              >
                <Layers3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#A8A0D8]/70 font-bold">
                  Chain of Evidence Studio
                </p>
                <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                  {initialFiles.length} 工程を時系列に連結する
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-[#A8A0D8] hover:text-white border border-[#1C1A38] hover:border-[#6C3EF4]/40 rounded-xl transition-all"
              title="閉じる (ESC)"
            >
              <X className="w-4 h-4" />
              閉じる
            </button>
          </div>

          <ProcessBundleComposer
            certificate={null}
            initialFiles={initialFiles}
            onComplete={() => { /* composer が自前で navigate するため no-op */ }}
          />
        </div>
      </motion.div>
    </div>
  );

  // 🚨 究極の脱出装置 (React Portal): mountedがtrueになった直後に document.body に強制マウント
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(overlayContent, document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   ChainUpsell — Free / 未ログイン状態で複数ファイル投入時の案内
   ═══════════════════════════════════════════════════════════════════ */

function ChainUpsell({
  onUpgrade,
  onDismiss,
}: {
  onUpgrade: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(7,6,26,0.85)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="w-full max-w-md rounded-3xl p-7"
        style={{
          background: '#0a0e27',
          border: `1px solid ${PM.border}`,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(108,62,244,0.18)', border: '1px solid rgba(108,62,244,0.45)' }}
          >
            <Zap className="w-5 h-5" style={{ color: PM.primary }} />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#A8A0D8]">Creator+ Feature</p>
            <h3 className="text-lg font-black text-white tracking-tight">工程証明（Chain of Evidence）</h3>
          </div>
        </div>

        <p className="text-sm text-[#A8A0D8] leading-relaxed mb-5">
          複数枚の制作工程を時系列に連結する「Chain of Evidence」は
          <strong className="text-white"> Creator プラン以上</strong> の限定機能です。
          AI生成への対抗・人間の制作プロセスそのものを証拠化できます。
        </p>

        <ul className="space-y-2 mb-6 text-xs text-[#A8A0D8]">
          {[
            'Creator: 最大 10 工程まで連結',
            'Studio / Business: 最大 150 工程まで連結',
            '途中工程は WebP 圧縮で容量最適化、完成品はオリジナル画質を保持',
          ].map((it) => (
            <li key={it} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00D4AA] shrink-0 mt-0.5" />
              <span>{it}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <button
            onClick={onUpgrade}
            className="w-full py-3 rounded-xl font-bold text-sm text-white"
            style={{
              background: `linear-gradient(135deg, ${PM.primary}, ${PM.success})`,
              boxShadow: `0 8px 24px rgba(108,62,244,0.35)`,
            }}
          >
            プランをアップグレード
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#A8A0D8] hover:text-white transition-colors"
          >
            あとで（単発証明で続行）
          </button>
        </div>
      </motion.div>
    </motion.div>
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
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#00D4AA' }}>
      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
      Content Credentials 検証OK
      {manifest?.issuer && <span className="text-[#A8A0D8]"> · {manifest.issuer}</span>}
    </p>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

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
      style={{ color: PM.textMuted }}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: D.slow / 1000, ease: EASE }}
        className="flex flex-col items-center gap-3"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: PM.surface, border: `1px solid ${PM.border}` }}
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

/* ──────────────────────────────────────────────────────────────────── */

export function SilentProgress({ caption }: { caption?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: PM.surface, border: `1px solid ${PM.border}` }}
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
            style={{ background: `linear-gradient(90deg, ${PM.primary}, ${PM.success})` }}
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