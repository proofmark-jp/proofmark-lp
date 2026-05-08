"use client";

/**
 * InlineHashDemo.tsx — ブラウザ完結SHA-256ハッシュ体験デモ
 *
 * LP訪問者に「ファイルはサーバーに送られず、ブラウザ内で計算される」ことを
 * 体感させるためのインタラクティブデモ。
 *
 * - ドラッグ＆ドロップ or クリックでファイル選択
 * - モバイル向け: 1タップでサンプルファイルのハッシュ化を体験
 * - done 状態で /spot-issue への導線を表示
 */

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, ShieldCheck, ArrowRight, UploadCloud, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

/* ── Theme tokens ──────────────────────────────────────────────────── */

const THEME = {
  bg: '#07061A',
  surface: 'rgba(108,62,244,0.04)',
  border: '#1C1A38',
  primary: '#6C3EF4',
  accent: '#00D4AA',
  accentRing: 'rgba(0,212,170,0.25)',
  accentSoft: 'rgba(0,212,170,0.08)',
  textMain: '#EEEDF5',
  textMuted: '#7B7896',
  textSubtle: '#5A5775',
} as const;

const EASE = [0.25, 0.1, 0.25, 1.0] as const;

/* ── Types ─────────────────────────────────────────────────────────── */

type Phase = 'idle' | 'hashing' | 'done';

interface HashResult {
  fileName: string;
  fileSize: number;
  hash: string;
  elapsed: number;
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function InlineHashDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState<HashResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* SHA-256 計算（ブラウザ完結） */
  const computeHash = useCallback(async (file: File) => {
    setPhase('hashing');
    setResult(null);

    const t0 = performance.now();
    const buffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    const actualElapsed = Math.round(performance.now() - t0);

    // 👇 追加：計算が早すぎる場合、スキャンアニメーションを見せるために最低でも600ms待たせる
    const minDelay = 600;
    if (actualElapsed < minDelay) {
      await new Promise((r) => setTimeout(r, minDelay - actualElapsed));
    }
    // 👆 ここまで

    setResult({
      fileName: file.name,
      fileSize: file.size,
      hash: hashHex,
      elapsed: actualElapsed, // 実際の驚異的なスピード(ms)は正直に表示する
    });
    setPhase('done');
  }, []);

  /* ファイル選択ハンドラ */
  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      computeHash(file);
    },
    [computeHash],
  );

  /* ドラッグ系イベント */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setIsDragOver(false), []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );



  /* リセット */
  const reset = useCallback(() => {
    setPhase('idle');
    setResult(null);
  }, []);

  return (
    <div
      className="w-full max-w-xl mx-auto rounded-2xl overflow-hidden"
      style={{
        background: THEME.surface,
        border: `1px solid ${THEME.border}`,
      }}
    >
      <AnimatePresence mode="wait">
        {/* ── Idle: ドロップゾーン ──────────────────────────────── */}
        {phase === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {/* ドロップゾーン */}
            <div
              role="button"
              tabIndex={0}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              className="flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 px-6 py-12 sm:py-14 rounded-t-2xl"
              style={{
                borderBottom: `1px dashed ${isDragOver ? THEME.accent : THEME.border}`,
                background: isDragOver
                  ? THEME.accentSoft
                  : 'transparent',
              }}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <motion.div
                animate={{
                  scale: isDragOver ? 1.08 : 1,
                  color: isDragOver ? THEME.accent : THEME.textMuted,
                }}
                transition={{ duration: 0.2 }}
              >
                <UploadCloud className="w-10 h-10 mx-auto mb-4" />
              </motion.div>
              <p
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: THEME.textMain }}
              >
                ファイルをドロップして体験
              </p>
              <p
                className="mt-1.5 text-[12px]"
                style={{ color: THEME.textMuted }}
              >
                ブラウザ内で SHA-256 を計算。サーバーには一切送信されません。
              </p>
            </div>

            {/* 👇 必須追加：モバイルユーザー向け「1タップ体験」ボタン */}
            <div style={{ marginTop: 20, textAlign: 'center', paddingBottom: 20 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginBottom: 8 }}>手元にファイルがない場合は：</p>
              <button
                onClick={() => {
                  const sampleFile = new File(["ProofMark Demo Asset Data 2026"], "sample_artwork.png", { type: "image/png" });
                  handleFile(sampleFile); // ファイル処理関数へ渡す
                }}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#00D4AA", fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}
              >
                サンプル画像で瞬時計算をテストする
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Hashing: プログレス表示 ─────────────────────────── */}
        {phase === 'hashing' && (
          <motion.div
            key="hashing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex flex-col items-center justify-center text-center px-6 py-16"
          >
            {/* スキャンラインアニメーション */}
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-5 overflow-hidden"
              style={{
                background: THEME.bg,
                border: `1px solid ${THEME.border}`,
              }}
            >
              <Hash className="w-7 h-7 relative z-10" style={{ color: THEME.accent }} />
              <motion.div
                className="absolute inset-x-0 h-[2px]"
                initial={{ top: '-4px' }}
                animate={{ top: ['0%', '100%'] }}
                transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
                style={{
                  background: `linear-gradient(90deg, transparent, ${THEME.primary} 40%, ${THEME.accent} 60%, transparent)`,
                }}
              />
            </div>
            <p
              className="text-[14px] font-semibold"
              style={{ color: THEME.textMain }}
            >
              SHA-256 を計算中…
            </p>
            <p
              className="mt-2 text-[11px] tracking-widest uppercase"
              style={{
                color: THEME.textSubtle,
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              }}
            >
              ブラウザ内で処理中
            </p>
          </motion.div>
        )}

        {/* ── Done: ハッシュ結果 + CTA ─────────────────────────── */}
        {phase === 'done' && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="px-6 py-10 sm:py-12"
          >
            {/* 成功ヘッダー */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <ShieldCheck className="w-5 h-5" style={{ color: THEME.accent }} />
              <p
                className="text-[14px] font-bold tracking-tight"
                style={{ color: THEME.accent }}
              >
                ハッシュ計算完了
              </p>
              <span
                className="text-[11px] tabular-nums"
                style={{
                  color: THEME.textSubtle,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                }}
              >
                {result.elapsed}ms
              </span>
            </div>

            {/* ファイル情報 */}
            <div
              className="rounded-xl px-4 py-3 mb-4"
              style={{
                background: THEME.bg,
                border: `1px solid ${THEME.border}`,
              }}
            >
              <p className="text-[12px] font-semibold truncate" style={{ color: THEME.textMain }}>
                {result.fileName}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: THEME.textMuted }}>
                {(result.fileSize / 1024).toFixed(1)} KB
              </p>
            </div>

            {/* ハッシュ値 */}
            <div
              className="rounded-xl px-4 py-3 mb-6 select-all"
              style={{
                background: THEME.bg,
                border: `1px solid ${THEME.border}`,
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              }}
            >
              <p
                className="text-[10px] uppercase tracking-widest mb-1.5"
                style={{ color: THEME.textSubtle }}
              >
                SHA-256
              </p>
              <p
                className="text-[11px] leading-relaxed break-all"
                style={{ color: THEME.accent }}
              >
                {result.hash}
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/spot-issue" className="flex-1">
                <span
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[13px] font-bold tracking-wide transition-opacity hover:opacity-90"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.primary})`,
                    color: '#fff',
                  }}
                >
                  このまま証明書を発行する
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </span>
              </Link>
              <button
                type="button"
                onClick={reset}
                className="py-3 px-4 rounded-xl text-[12px] font-semibold tracking-wide transition-colors"
                style={{
                  background: 'transparent',
                  border: `1px solid ${THEME.border}`,
                  color: THEME.textMuted,
                }}
              >
                別のファイルで試す
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
