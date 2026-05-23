/**
 * InlineHashDemo.tsx
 *
 *  - 左パネル: drop & sample (既存とほぼ同じ)
 *  - 右パネル: CertificatePreview を compact=true で再利用
 *  - 完成後: ¥480 (/spot-issue) と 無料登録 (/auth?mode=signup) の 2 CTA
 *
 *  Lighthouse 90+ 維持 — lazy 配下なのでこのコンポーネント自体も
 *  最小限の依存だけ持つ (no Lottie / no chart libs)。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight, FileImage, Loader2, ShieldCheck, Sparkles, Upload,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import CertificatePreview, {
  type SpotState,
} from './spot/CertificatePreview';

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#07061A"/><stop offset="100%" stop-color="#15132D"/>
  </linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <circle cx="760" cy="220" r="180" fill="#6C3EF4" opacity="0.20"/>
  <circle cx="240" cy="820" r="200" fill="#00D4AA" opacity="0.10"/>
  <rect x="120" y="120" width="784" height="784" rx="48" fill="#0D0B24" stroke="#2A2A4E"/>
  <text x="180" y="540" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="56" font-weight="800">
    ProofMark Sample
  </text>
  <text x="180" y="608" fill="#A8A0D8" font-family="Inter, sans-serif" font-size="32">
    Tap to feel cryptographic existence.
  </text>
</svg>`;

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
  const arr = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0');
  return out;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

export default function InlineHashDemo(): JSX.Element {
  const reduce = useReducedMotion() ?? false;
  const [state, setState] = useState<SpotState>('IDLE');
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* ── hash pipeline ── */
  const runHash = useCallback(async (target: File): Promise<void> => {
    setError(null);
    setFile(target);
    setHash(null);
    setProgress(0);
    setState('HASHING');

    try {
      // クライアント体感のため軽い演出。実 hash は subtle.digest で正確に。
      const buf = await target.arrayBuffer();
      // フェイク段階的進捗 (実速度が速すぎて一瞬で終わる UX を緩和)
      for (let p = 6; p < 84; p += 9) {
        await wait(reduce ? 0 : 70);
        setProgress(p);
      }
      const hex = await sha256Hex(buf);
      setProgress(94);
      await wait(reduce ? 0 : 120);
      setHash(hex);
      setProgress(100);
      setState('PREVIEW');
    } catch (e) {
      console.error(e);
      setError('ハッシュ計算に失敗しました。別のファイルでお試しください。');
      setState('ERROR');
    }
  }, [reduce]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void runHash(f);
    },
    [runHash],
  );

  const onSample = useCallback(async () => {
    const blob = new Blob([SAMPLE_SVG], { type: 'image/svg+xml' });
    const f = new File([blob], 'proofmark-sample.svg', { type: 'image/svg+xml' });
    await runHash(f);
  }, [runHash]);

  const onReset = useCallback(() => {
    setState('IDLE');
    setFile(null);
    setHash(null);
    setProgress(0);
    setError(null);
  }, []);

  /* ── auto-load fallback for SSR ── */
  useEffect(() => () => setDragOver(false), []);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8">
      {/* ── LEFT: drop ── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.55, ease: PM_EASE }}
        className="rounded-[28px] border p-5 sm:p-6"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
          borderColor: dragOver ? '#6C3EF4' : 'rgba(255,255,255,0.08)',
          boxShadow: dragOver
            ? '0 0 0 1px rgba(108,62,244,0.45) inset, 0 0 40px rgba(108,62,244,0.18)'
            : 'none',
          transition: 'box-shadow 200ms, border-color 200ms',
        }}
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="ファイルをドロップしてハッシュ計算"
          className="flex min-h-[260px] w-full cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed px-5 text-center"
          style={{
            borderColor: dragOver ? 'rgba(108,62,244,0.6)' : 'rgba(255,255,255,0.16)',
            background: dragOver ? 'rgba(108,62,244,0.06)' : 'rgba(255,255,255,0.02)',
            transition: 'background 200ms, border-color 200ms',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void runHash(f);
            }}
          />
          <div
            className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border"
            style={{
              borderColor: dragOver ? 'rgba(108,62,244,0.45)' : 'rgba(255,255,255,0.10)',
              background: dragOver ? 'rgba(108,62,244,0.10)' : 'rgba(255,255,255,0.03)',
            }}
          >
            <Upload className="h-6 w-6" style={{ color: dragOver ? '#6C3EF4' : '#FFFFFF' }} />
          </div>
          <p className="text-base font-semibold text-white sm:text-lg">
            ファイルをドロップしてプレビュー
          </p>
          <p className="mt-1.5 text-[12.5px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            画像・PDF・制作ファイルを選ぶと、その場で証明書を組み上げます。
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px]"
             style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
            <ShieldCheck className="h-3 w-3" style={{ color: '#00D4AA' }} />
            原本はサーバーに一切送信されません
          </p>
        </div>

        {/* sample button (mobile-friendly one-tap) */}
        <button
          type="button"
          onClick={onSample}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold md:hidden"
          style={{
            borderColor: 'rgba(108,62,244,0.30)',
            background: 'rgba(108,62,244,0.10)',
            color: '#FFFFFF',
          }}
        >
          <Sparkles className="h-4 w-4" style={{ color: '#6C3EF4' }} /> Test with a sample image
        </button>
        <button
          type="button"
          onClick={onSample}
          className="mt-4 hidden items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium md:inline-flex"
          style={{
            borderColor: 'rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          <FileImage className="h-4 w-4" style={{ color: '#00D4AA' }} />
          Test with a sample image
        </button>

        {state !== 'IDLE' && (
          <button
            type="button"
            onClick={onReset}
            className="mt-3 block w-full text-center text-[11.5px] underline-offset-4 hover:underline"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            別のファイルを試す
          </button>
        )}

        {error && (
          <p
            className="mt-3 rounded-xl border px-3 py-2 text-[12px]"
            style={{
              borderColor: 'rgba(255,69,58,0.30)',
              background: 'rgba(255,69,58,0.06)',
              color: '#FF453A',
            }}
          >
            {error}
          </p>
        )}
      </motion.div>

      {/* ── RIGHT: certificate preview ── */}
      <div className="space-y-4">
        <CertificatePreview
          state={state}
          file={file}
          hash={hash}
          hashProgress={progress}
          compact
        />

        {/* dual CTA on PREVIEW */}
        {state === 'PREVIEW' ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: PM_EASE, delay: 0.1 }}
            className="rounded-[20px] border p-4 sm:p-5"
            style={{
              background:
                'linear-gradient(135deg, rgba(108,62,244,0.10) 0%, rgba(0,212,170,0.06) 100%)',
              borderColor: 'rgba(108,62,244,0.35)',
            }}
          >
            <p className="mb-3 text-[12px]" style={{ color: 'rgba(255,255,255,0.72)' }}>
              プレビューが気に入ったら正式発行へ。Stripe による安全な決済・登録不要。
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/spot-issue"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #6C3EF4 0%, #8B61FF 100%)',
                  boxShadow: '0 12px 28px rgba(108,62,244,0.40)',
                }}
              >
                ¥480 で正式発行する（登録不要）
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth?mode=signup"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-bold"
                style={{
                  borderColor: 'rgba(255,255,255,0.16)',
                  color: '#FFFFFF',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                無料アカウントで発行する
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        ) : null}

        {state === 'HASHING' ? (
          <p
            className="flex items-center justify-center gap-2 text-center text-[12px]"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ローカル環境でハッシュを計算中… ({progress}%)
          </p>
        ) : null}
      </div>
    </div>
  );
}
