/**
 * HeroCertificateShowcase.tsx
 * ─────────────────────────────────────────────────────────────
 *  LP Hero 右カラム — CertificatePreview の静的スナップショット版。
 *
 *  目的:
 *    - 「証明書がこういう形で生まれる」と一瞬で理解させる
 *    - Lighthouse 90+ を死守: Framer Motion は入場 fade-in のみ
 *    - 純 CSS のみで float / hash shimmer / glow を表現
 *
 *  ビジュアル言語は CertificatePreview / CertificatePage と同一。
 * ─────────────────────────────────────────────────────────────
 */

import { motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SAMPLE_HASH =
  '90fb4a8a2c47e1b5d3f6c08e7a194d2f5b6a17c84f9e3a02d1b4af3d2c6e8b71';

const ARTWORK_SRC = '/spa/fantasy_artwork_final.jpg';

export default function HeroCertificateShowcase(): JSX.Element {
  const reduce = useReducedMotion() ?? false;

  // リアルタイムタイムスタンプ
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 画面外ロード時のクライアント側でだけ float を有効化
  const floatStyle = useMemo<React.CSSProperties>(() => {
    if (reduce) return {};
    return {
      animation: 'pm-cert-float 6.4s cubic-bezier(0.45,0,0.55,1) infinite',
    };
  }, [reduce]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay: 0.1, ease: PM_EASE }}
      className="relative w-full"
      style={{ perspective: '1100px' }}
    >
      {/* keyframes (scoped via <style>) */}
      <style>{HERO_CERT_KEYFRAMES}</style>

      {/* ambient glow halo behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 50%, rgba(108,62,244,0.32) 0%, rgba(108,62,244,0) 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* card */}
      <div
        className="pm-cert-showcase relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[28px] border p-6 sm:p-8"
        style={{
          background: '#0D0B24',
          borderColor: 'rgba(108,62,244,0.35)',
          boxShadow:
            '0 28px 70px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 80px rgba(108,62,244,0.18)',
          transformStyle: 'preserve-3d',
          ...floatStyle,
        }}
      >
        {/* corner blur orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-[80px]"
          style={{ background: '#6C3EF4' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-20 blur-[80px]"
          style={{ background: '#00D4AA' }}
        />

        {/* header */}
        <div
          className="relative z-10 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-5"
          style={{ borderColor: '#1C1A38' }}
        >
          <div>
            <h3
              className="text-[20px] font-extrabold leading-tight tracking-tight text-white sm:text-[24px]"
              style={{
                fontFamily:
                  "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              CERTIFICATE OF AUTHENTICITY
            </h3>
            <p
              className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: '#A8A0D8' }}
            >
              ProofMark Digital Existence Certificate
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.20em]"
              style={{
                background: 'rgba(0,212,170,0.10)',
                borderColor: 'rgba(0,212,170,0.45)',
                color: '#00D4AA',
              }}
            >
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.20em]"
              style={{
                background: 'rgba(240,187,56,0.08)',
                borderColor: 'rgba(240,187,56,0.45)',
                color: '#F0BB38',
                boxShadow: '0 0 10px rgba(240,187,56,0.20)',
              }}
            >
              <Sparkles className="h-3 w-3" /> Founder
            </span>
          </div>
        </div>

        {/* body */}
        <div className="relative z-10 mt-5 grid grid-cols-[112px_1fr] gap-5 sm:grid-cols-[128px_1fr] sm:gap-6">
          {/* artwork */}
          <div
            className="relative aspect-square w-full overflow-hidden rounded-2xl border"
            style={{ borderColor: '#1C1A38', background: '#07061A' }}
          >
            <img
              src={ARTWORK_SRC}
              alt="ProofMark sample artwork"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(13,11,36,0) 60%, rgba(13,11,36,0.40) 100%)',
              }}
            />
            <span
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.20em]"
              style={{
                background: 'rgba(0,212,170,0.16)',
                borderColor: 'rgba(0,212,170,0.45)',
                color: '#00D4AA',
                backdropFilter: 'blur(8px)',
              }}
            >
              <ShieldCheck className="h-2.5 w-2.5" /> Sealed
            </span>
          </div>

          {/* data column */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* protected asset */}
            <div>
              <Label icon={<FileText className="h-3 w-3" />}>Protected Asset</Label>
              <p className="truncate text-[13px] font-medium text-white sm:text-sm">
                fantasy_artwork_final.jpg
              </p>
            </div>

            {/* SHA-256 with shimmer */}
            <div
              className="rounded-xl border p-3"
              style={{
                borderColor: 'rgba(0,212,170,0.22)',
                background:
                  'linear-gradient(90deg, rgba(0,212,170,0.10) 0%, rgba(0,212,170,0) 100%)',
              }}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#00D4AA' }} />
                <Label color="#00D4AA">SHA-256 Hash Signature</Label>
              </div>
              <p
                className="pm-hash-shimmer block font-mono text-[10.5px] leading-relaxed"
                style={{ wordBreak: 'break-all' }}
              >
                {SAMPLE_HASH}
              </p>
            </div>

            {/* timestamp */}
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" style={{ color: '#F0BB38' }} />
                <Label color="#F0BB38">Digital Timestamp (JST)</Label>
              </div>
              <p
                className="text-[15px] font-bold tracking-tight text-white sm:text-base"
                style={{
                  fontFamily:
                    "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                }}
              >
                {now.toLocaleString('ja-JP', { hour12: false })}
              </p>
              <p className="mt-1 text-[10.5px]" style={{ color: '#A8A0D8' }}>
                改ざん不能な技術で真正性が担保されています
              </p>
            </div>
          </div>
        </div>

        {/* footer */}
        <div
          className="relative z-10 mt-5 flex items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: '#1C1A38' }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em]"
            style={{
              background: 'rgba(0,212,170,0.08)',
              borderColor: 'rgba(0,212,170,0.30)',
              color: '#00D4AA',
            }}
          >
            <ShieldCheck className="h-3 w-3" /> RFC3161 + SHA-256
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="hidden text-[10px] font-bold uppercase tracking-[0.22em] sm:inline"
              style={{ color: '#A8A0D8' }}
            >
              Scan to verify
            </span>
            <div
              className="rounded-md border bg-white p-1.5"
              style={{ borderColor: '#E5E5EA' }}
            >
              <div className="grid grid-cols-9 gap-[1.5px]" style={{ width: 48, height: 48 }}>
                {QR_DEMO_CELLS.map((on, i) => (
                  <span
                    key={i}
                    style={{
                      width: 4,
                      height: 4,
                      background: on ? '#000' : '#fff',
                      borderRadius: 0.5,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
 *  Atoms
 * ───────────────────────────────────────────── */

function Label({
  children,
  color = '#A8A0D8',
  icon,
}: {
  children: React.ReactNode;
  color?: string;
  icon?: React.ReactNode;
}): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.22em]"
      style={{ color }}
    >
      {icon}
      {children}
    </span>
  );
}

/* QR-like decoration cells (pure visual, not scannable) */
const QR_DEMO_CELLS: ReadonlyArray<boolean> = (() => {
  const out: boolean[] = [];
  let seed = 4231;
  for (let i = 0; i < 81; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    out.push(seed / 233280 > 0.46);
  }
  const markers = [
    [0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2],
    [0, 6], [0, 7], [0, 8], [1, 6], [1, 8], [2, 6], [2, 7], [2, 8],
    [6, 0], [6, 1], [6, 2], [7, 0], [7, 2], [8, 0], [8, 1], [8, 2],
  ];
  for (const [r, c] of markers) out[r * 9 + c] = true;
  return out;
})();

/* keyframes — pure CSS, no JS animation cost */
const HERO_CERT_KEYFRAMES = `
@keyframes pm-cert-float {
  0%, 100% { transform: translateY(0px) rotateY(-4deg) rotateX(1.5deg); }
  50%      { transform: translateY(-10px) rotateY(-4deg) rotateX(1.5deg); }
}
@keyframes pm-hash-shimmer-anim {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.pm-hash-shimmer {
  background: linear-gradient(
    90deg,
    rgba(0,212,170,0.45) 0%,
    rgba(0,212,170,1) 50%,
    rgba(0,212,170,0.45) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: pm-hash-shimmer-anim 3.4s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .pm-cert-showcase { animation: none !important; }
  .pm-hash-shimmer  { animation: none !important; -webkit-text-fill-color: #00D4AA; color: #00D4AA; }
}
`;
