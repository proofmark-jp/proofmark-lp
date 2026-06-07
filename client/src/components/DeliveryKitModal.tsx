/**
 * DeliveryKitModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * One-Click Delivery Kit — UI/UX Vanguard
 *
 * DOM Isolation:
 *   - React.createPortal で document.body 直下にマウント。
 *   - 既存 CSS の z-index 干渉を物理排除 (z-[9999])。
 *   - framer-motion <AnimatePresence> でマウント/アンマウントアニメーション。
 *
 * Anti-Auto-Fill:
 *   - autoComplete="off" data-lpignore="true" data-form-type="other"
 *
 * State-Driven Micro-copy:
 *   generating-key → 「暗号鍵を生成中...」
 *   encrypting     → 「Vaultを封印中...」
 *   requesting-url → 「セキュア通信を確立中...」
 *   uploading      → 「暗号化データを転送中...」
 *
 * Ephemeral Password UI:
 *   - 伏せ字 (••••••••) で表示。
 *   - クリックでのみ navigator.clipboard.writeText でコピー。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Lock,
  Shield,
  ShieldOff,
  X,
  Loader2,
} from 'lucide-react';
import { useEncryptedVault } from '../hooks/useEncryptedVault';
import { useQuarantineUpload } from '../hooks/useQuarantineUpload';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface DeliveryKitModalProps {
  /** 暗号化して送信するファイル */
  file: File;
  /** モーダルを閉じるコールバック */
  onClose: () => void;
  /**
   * アップロード完了後のコールバック。
   * quarantinePath, password, clientName, fileHash を渡す（クライアントへの別途伝達用）。
   */
  onComplete?: (payload: {
    quarantinePath: string;
    bucket: string;
    password: string;
    clientName: string;
    fileHash: string;
  }) => void;
}

/* ═══════════════════════════════════════════════════════════════
   MICRO-COPY MAP
   ═══════════════════════════════════════════════════════════════ */

const MICRO_COPY: Record<string, string> = {
  'generating-key': '暗号鍵を生成中...',
  'encrypting':     'Vaultを封印中...',
  'requesting-url': 'セキュア通信を確立中...',
  'uploading':      '暗号化データを転送中...',
};

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/** 伏せ字パスワード表示 + クリップボードコピー */
function EphemeralPassword({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      /* クリップボードへのアクセスが拒否された場合は何もしない */
    }
  }, [password]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#A8A0D8]/60 font-bold">
        復号パスワード (クライアント専用)
      </p>

      <motion.button
        type="button"
        onClick={handleCopy}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`
          w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl
          border transition-all duration-200 cursor-pointer
          ${copied
            ? 'bg-[#00D4AA]/10 border-[#00D4AA]/40'
            : 'bg-white/5 border-white/10 hover:border-[#00D4AA]/30 hover:bg-[#00D4AA]/5'}
        `}
        aria-label="パスワードをクリップボードにコピー"
      >
        {/* 伏せ字表示 — hover では平文を一切表示しない */}
        <span className="font-mono text-sm tracking-[0.35em] text-white/90 select-none">
          {'•'.repeat(password.length)}
        </span>

        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span
              key="copied"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 shrink-0"
            >
              <ClipboardCheck className="w-4 h-4 text-[#00D4AA]" />
              <span className="text-xs font-bold text-[#00D4AA]">コピー済み</span>
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 shrink-0"
            >
              <Copy className="w-4 h-4 text-[#A8A0D8]/50" />
              <span className="text-xs text-[#A8A0D8]/50">クリックでコピー</span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <p className="text-[10px] text-[#A8A0D8]/40 leading-relaxed">
        ⚠️ このパスワードはサーバーに保存されません。クライアントへ別途（メール等）で安全に伝達してください。
      </p>
    </div>
  );
}

/** アニメーション付きプログレスバー */
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-[#6C3EF4] via-[#00D4AA] to-[#6C3EF4]"
        style={{ backgroundSize: '200% 100%' }}
        animate={{
          width: `${Math.round(value * 100)}%`,
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{ width: { duration: 0.4, ease: 'easeOut' }, backgroundPosition: { duration: 2, repeat: Infinity, ease: 'linear' } }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN MODAL INNER COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function DeliveryKitModalInner({
  file,
  onClose,
  onComplete,
}: DeliveryKitModalProps) {
  const vault = useEncryptedVault();
  const upload = useQuarantineUpload();

  const [clientName, setClientName] = useState('');
  const [deliveredPassword, setDeliveredPassword] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  /* ── Body Scroll Lock: モーダル展開中はボディのスクロールを封印 ── */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* ── 処理開始 ── */
  const handleStart = useCallback(async () => {
    if (hasStarted) return;
    setHasStarted(true);

    // Step 1–4: 暗号化
    const vaultResult = await vault.encrypt(file);
    if (!vaultResult) return; // vault.error にセット済み

    // Step 5: Signed URL 取得 → PUT
    const uploadResult = await upload.upload(
      vaultResult.encryptedBlob,
      file.name,
      clientName.trim() || undefined,
    );

    if (uploadResult) {
      setDeliveredPassword(vaultResult.password);

      // ファイルの SHA-256 を計算して onComplete に渡す
      let fileHash = '';
      try {
        const buf = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buf);
        fileHash = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } catch { /* ハッシュ計算に失敗しても送信結果は維持する */ }

      onComplete?.({
        quarantinePath: uploadResult.quarantinePath,
        bucket: uploadResult.bucket,
        password: vaultResult.password,
        clientName: clientName.trim(),
        fileHash,
      });
    }
  }, [hasStarted, file, clientName, vault, upload, onComplete]);

  /* ── 現在のフェーズ統合 ── */
  const activeVaultPhase = vault.phase;
  const activeUploadPhase = upload.phase;

  const isProcessing =
    ['generating-key', 'encrypting'].includes(activeVaultPhase) ||
    ['requesting-url', 'uploading'].includes(activeUploadPhase);

  const isCompleted = activeUploadPhase === 'done' && !!deliveredPassword;
  const hasError = vault.error || upload.error;

  /* ── State-Driven Micro-copy ── */
  const microCopy = (() => {
    if (MICRO_COPY[activeVaultPhase]) return MICRO_COPY[activeVaultPhase];
    if (MICRO_COPY[activeUploadPhase]) return MICRO_COPY[activeUploadPhase];
    return null;
  })();

  /* ── 合算進捗 ── */
  const combinedProgress = (() => {
    if (['generating-key', 'encrypting'].includes(activeVaultPhase)) return 0.15;
    if (activeUploadPhase === 'requesting-url') return 0.3;
    if (activeUploadPhase === 'uploading') return 0.3 + upload.progress * 0.7;
    if (activeUploadPhase === 'done') return 1;
    return 0;
  })();

  /* ── キャンセル ── */
  const handleCancel = useCallback(() => {
    upload.abort();
    onClose();
  }, [upload, onClose]);

  /* ── Escape キーで閉じる ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isProcessing, onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
        onClick={isProcessing ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="One-Click Delivery Kit"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="relative w-full max-w-md pointer-events-auto bg-[#0F0F11] border border-white/10 rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden">

          {/* ── Top accent bar ── */}
          <div className="h-0.5 w-full bg-gradient-to-r from-[#6C3EF4] via-[#00D4AA] to-[#6C3EF4]" />

          {/* ── Header ── */}
          <div className="flex items-start justify-between px-6 pt-6 pb-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-[#00D4AA]" />
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-tight leading-snug">
                  One-Click Delivery Kit
                </h2>
                <p className="text-[11px] text-[#A8A0D8]/60 mt-0.5">
                  AES-256-GCM · PBKDF2 · ブラウザ完結暗号化
                </p>
              </div>
            </div>

            {!isProcessing && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#A8A0D8]/40 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-2"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── Body ── */}
          <div className="px-6 pt-5 pb-6 space-y-5">

            {/* File info */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-[#6C3EF4]/15 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-[#6C3EF4]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-[#A8A0D8]/50 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'application/octet-stream'}
                </p>
              </div>
            </div>

            {/* Client Name input (Anti-Auto-Fill) */}
            {!hasStarted && (
              <div>
                <label
                  htmlFor="delivery-client-name"
                  className="block text-[10px] uppercase tracking-[0.22em] text-[#A8A0D8]/60 font-bold mb-2"
                >
                  クライアント名 (任意)
                </label>
                <input
                  id="delivery-client-name"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="例: 株式会社〇〇 田中様"
                  /* ── Anti-Auto-Fill ── */
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#A8A0D8]/30 focus:outline-none focus:border-[#00D4AA]/50 focus:bg-[#00D4AA]/5 transition-all"
                />
              </div>
            )}

            {/* ── Processing state ── */}
            <AnimatePresence mode="wait">
              {isProcessing && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-3"
                >
                  {/* Micro-copy + spinner */}
                  <div className="flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 text-[#00D4AA] animate-spin shrink-0" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={microCopy}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18 }}
                        className="text-sm font-bold text-[#00D4AA]"
                      >
                        {microCopy}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  {/* Progress bar */}
                  <ProgressBar value={combinedProgress} />

                  <p className="text-[10px] text-[#A8A0D8]/40">
                    {Math.round(combinedProgress * 100)}% — ブラウザ内で暗号化処理中。通信は発生していません。
                  </p>
                </motion.div>
              )}

              {/* ── Success state ── */}
              {isCompleted && deliveredPassword && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Success banner */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                    <CheckCircle2 className="w-5 h-5 text-[#00D4AA] shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-[#00D4AA]">Vault 送信完了</p>
                      <p className="text-[10px] text-[#00D4AA]/70 mt-0.5">
                        暗号化データが安全にアップロードされました
                      </p>
                    </div>
                  </div>

                  {/* Progress bar (full) */}
                  <ProgressBar value={1} />

                  {/* Ephemeral password */}
                  <EphemeralPassword password={deliveredPassword} />

                  {/* Close button */}
                  <motion.button
                    type="button"
                    onClick={onClose}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#00D4AA] to-[#00D4AA]/80 text-sm font-black text-[#07061A] hover:shadow-[0_0_30px_rgba(0,212,170,0.35)] transition-all"
                  >
                    完了
                  </motion.button>
                </motion.div>
              )}

              {/* ── Error state ── */}
              {hasError && !isProcessing && !isCompleted && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30"
                >
                  <ShieldOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-400">処理に失敗しました</p>
                    <p className="text-[11px] text-red-400/70 mt-0.5">
                      {vault.error || upload.error}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── CTA buttons (initial state) ── */}
            {!hasStarted && !isProcessing && !isCompleted && !hasError && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-bold text-[#A8A0D8]/60 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
                >
                  キャンセル
                </button>
                <motion.button
                  type="button"
                  onClick={handleStart}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-sm font-black text-white shadow-[0_0_24px_rgba(108,62,244,0.35)] hover:shadow-[0_0_40px_rgba(108,62,244,0.5)] transition-all"
                >
                  <Lock className="w-4 h-4" />
                  暗号化して送信
                </motion.button>
              </div>
            )}

            {/* ── Cancel button (processing) ── */}
            {isProcessing && (
              <button
                type="button"
                onClick={handleCancel}
                className="w-full py-2.5 rounded-xl border border-white/10 text-sm font-bold text-[#A8A0D8]/50 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
              >
                キャンセル (通信を即時遮断)
              </button>
            )}

            {/* ── Retry (error state) ── */}
            {hasError && !isCompleted && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-bold text-[#A8A0D8]/60 hover:text-white transition-all"
                >
                  閉じる
                </button>
                <button
                  type="button"
                  onClick={() => {
                    vault.reset();
                    upload.reset();
                    setHasStarted(false);
                    setDeliveredPassword(null);
                  }}
                  className="flex-[2] py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white hover:bg-white/10 transition-all"
                >
                  再試行
                </button>
              </div>
            )}
          </div>

          {/* ── Security footer ── */}
          <div className="px-6 pb-5">
            <div className="flex items-center gap-2 text-[10px] text-[#A8A0D8]/30">
              <Shield className="w-3 h-3 shrink-0" />
              <span>
                暗号化はブラウザ内で完結。平文ファイルはサーバーに送信されません。
                鍵は V8 隔離領域に封印 (extractable: false)。
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PORTAL WRAPPER — DOM Isolation via document.body
   ═══════════════════════════════════════════════════════════════ */

export function DeliveryKitModal(props: DeliveryKitModalProps & { isOpen: boolean }) {
  const { isOpen, ...innerProps } = props;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && <DeliveryKitModalInner {...innerProps} />}
    </AnimatePresence>,
    document.body,
  );
}
