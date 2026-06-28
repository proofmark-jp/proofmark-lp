/**
 * WidgetBuilder.tsx — The Human Proof Embed Forge
 * ─────────────────────────────────────────────────────────────────────────────
 * クリエイターが自身のポートフォリオへ「人間の証明」を寄生させるための
 * 単一ファイル・ウィジェット生成 UI。
 *
 * 心理設計
 *  - The Parasitic Payload: blockquote + async script の Zero-CLS スニペット
 *  - The Propaganda: AI 無断学習への威嚇 + 強力な SEO 被リンクの絶対ベネフィット
 *  - Frictionless Copy: ワンクリック → Magnetic Snap + Neon Pulse の官能反応
 *  - Zero-Jank Preview: iframe を Skeleton 越しに滑らかにフェードイン
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Code2,
  Eye,
  Fingerprint,
  Link2,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface WidgetBuilderProps {
  certificateId: string;
  certificateTitle: string;
}

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════ */

const NEON = '#00FFB2';
const PURPLE = '#6C3EF4';
const BG_DEEP = '#050308';
const BORDER_PURPLE = 'rgba(108,62,244,0.3)';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function WidgetBuilder({
  certificateId,
  certificateTitle,
}: WidgetBuilderProps) {
  /* ─── 動的スニペット生成 (Parasitic Payload) ─── */
  const snippet = useMemo(
    () =>
      `<blockquote class="proofmark-embed" data-proofmark-id="${certificateId}">
  <a href="https://proofmark.jp/cert/${certificateId}">ProofMark Verified: ${escapeHtml(certificateTitle)}</a>
</blockquote>
<script async src="https://proofmark.jp/embed.js" charset="utf-8"></script>`,
    [certificateId, certificateTitle],
  );

  /* ─── Copy 状態 ─── */
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const handleCopy = useCallback(async () => {
    setCopyError(null);
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(snippet);
      } else {
        // Legacy fallback
        const ta = document.createElement('textarea');
        ta.value = snippet;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand copy failed');
      }
      setCopied(true);

      // Haptic 微弱フィードバック (対応端末のみ)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(18);
      }

      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 2000);
    } catch (e) {
      setCopyError(
        e instanceof Error
          ? `クリップボードへのアクセスが拒否されました: ${e.message}`
          : 'クリップボードへのアクセスが拒否されました',
      );
    }
  }, [snippet]);

  /* ─── iframe Load 状態 ─── */
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const iframeSrc = `/api/embed?id=${encodeURIComponent(certificateId)}`;

  return (
    <section
      aria-label="ProofMark Embed Widget Builder"
      className="
        relative overflow-hidden
        rounded-[24px]
        border
        p-5 sm:p-7 lg:p-8
      "
      style={{
        backgroundColor: BG_DEEP,
        borderColor: BORDER_PURPLE,
        boxShadow:
          '0 30px 80px -20px rgba(0,0,0,0.85), 0 0 60px -30px rgba(108,62,244,0.45)',
      }}
    >
      {/* ─── 背景: 微かなノイズグリッド ─── */}
      <BackdropPlasma />

      {/* ═════════════════════════════════════════════════════════
         Header — The Human Proof
         ═════════════════════════════════════════════════════════ */}
      <header className="relative z-10 mb-7">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="
              inline-flex items-center gap-1.5
              px-2 py-0.5 rounded-full
              text-[9.5px] font-mono font-bold uppercase
              tracking-[0.24em]
              border
            "
            style={{
              color: NEON,
              borderColor: `${NEON}55`,
              backgroundColor: 'rgba(0,255,178,0.06)',
            }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{
                backgroundColor: NEON,
                boxShadow: `0 0 6px ${NEON}`,
              }}
            />
            EMBED FORGE
          </span>
          <span className="text-[9.5px] font-mono font-bold uppercase tracking-[0.24em] text-white/30">
            · Zero-CLS · SEO Backlink · Anti-Scrape
          </span>
        </div>

        <h2
          className="
            font-mono font-bold
            text-[24px] sm:text-[30px]
            tracking-tight text-white
            leading-[1.12]
          "
          style={{ letterSpacing: '-0.01em' }}
        >
          The{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(110deg, #FFFFFF 0%, ${NEON} 55%, ${PURPLE} 110%)`,
            }}
          >
            Human Proof
          </span>
          {' '}を、あなたのサイトに寄生させる。
        </h2>

        <p
          className="
            mt-3 max-w-2xl
            text-[13px] sm:text-[13.5px] leading-[1.75]
            text-white/55 font-medium
          "
        >
          AI の無断スクレイピングを視覚的に威嚇し、同時にあなたのポートフォリオへ
          <span className="text-white/85"> 強力な SEO 被リンク</span>
          （Zero-CLS 対応）をもたらします。コピペ 1 回。摩擦ゼロ。
        </p>

        {/* Benefit Trio */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <BenefitChip
            icon={<Shield size={12} />}
            label="ANTI-SCRAPE"
            sub="AI 無断学習への視覚的威嚇"
          />
          <BenefitChip
            icon={<Link2 size={12} />}
            label="SEO BACKLINK"
            sub="proofmark.jp からの永続外部リンク"
          />
          <BenefitChip
            icon={<Zap size={12} />}
            label="ZERO-CLS"
            sub="Layout Shift = 0 / Core Web Vitals 安全"
          />
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════
         Body — 2-col: Code (left) | Preview (right)
         ═════════════════════════════════════════════════════════ */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-5">
        {/* ── LEFT: Code Block ── */}
        <div className="flex flex-col min-w-0">
          {/* Section Header */}
          <SectionEyebrow icon={<Code2 size={12} />} label="THE PARASITIC PAYLOAD" />

          <div
            className="
              relative overflow-hidden
              rounded-2xl
              border
              backdrop-blur-md
            "
            style={{
              backgroundColor: '#08060F',
              borderColor: BORDER_PURPLE,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 50px -20px rgba(0,0,0,0.8)',
            }}
          >
            {/* Terminal-like top bar */}
            <div
              className="
                flex items-center justify-between
                px-4 py-2
                border-b
              "
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#FF5577' }}
                />
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#FFB35C' }}
                />
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: NEON }}
                />
                <span className="ml-3 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-white/45">
                  paste-to-portfolio.html
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Fingerprint size={11} className="text-white/35" />
                <code
                  className="text-[10px] font-mono text-white/45 truncate max-w-[140px]"
                  title={certificateId}
                >
                  {certificateId}
                </code>
              </div>
            </div>

            {/* Snippet */}
            <pre
              className="
                m-0
                px-4 py-4
                text-[12px] leading-[1.75]
                font-mono
                text-white/85
                whitespace-pre-wrap
                break-all
              "
              style={{
                fontFamily:
                  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              <SyntaxColoredSnippet code={snippet} />
            </pre>

            {/* Bottom gradient ring on hover */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
              style={{
                backgroundImage: `linear-gradient(90deg, transparent 0%, ${NEON} 50%, transparent 100%)`,
                opacity: 0.4,
              }}
            />
          </div>

          {/* Copy Button */}
          <CopyButton copied={copied} onClick={handleCopy} />

          {/* Copy error */}
          <AnimatePresence>
            {copyError && (
              <motion.div
                key="copy-err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                role="alert"
                className="
                  mt-3 flex items-start gap-2
                  rounded-lg px-3 py-2
                  text-[11.5px] leading-[1.55]
                "
                style={{
                  backgroundColor: 'rgba(255,85,119,0.08)',
                  border: '1px solid rgba(255,85,119,0.45)',
                  color: '#FFC0CC',
                }}
              >
                <AlertTriangle size={13} className="mt-[1px] shrink-0" />
                <span>
                  {copyError} — ブラウザの権限ダイアログを許可するか、コードを手動で選択してコピーしてください。
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Install hint */}
          <p
            className="
              mt-4 text-[10.5px] font-mono uppercase
              tracking-[0.22em]
              text-white/30
            "
          >
            STEP 01 · COPY  →  STEP 02 · PASTE INTO &lt;BODY&gt;  →  STEP 03 · SHIP
          </p>
        </div>

        {/* ── RIGHT: Live Preview ── */}
        <div className="flex flex-col min-w-0">
          <SectionEyebrow icon={<Eye size={12} />} label="ZERO-JANK LIVE PREVIEW" />

          <div
            className="
              relative
              rounded-2xl
              border
              overflow-hidden
              backdrop-blur-md
              flex items-center justify-center
              p-4 sm:p-5
            "
            style={{
              backgroundColor: '#08060F',
              borderColor: BORDER_PURPLE,
              minHeight: 500,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 50px -20px rgba(0,0,0,0.8)',
            }}
          >
            {/* Preview frame container — 400x460 with skeleton overlay */}
            <div
              className="relative"
              style={{ width: '100%', maxWidth: 400, height: 460 }}
            >
              {/* Skeleton (visible until iframe loads) */}
              <AnimatePresence>
                {!previewLoaded && (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden
                    className="absolute inset-0 z-10"
                  >
                    <CyberpunkSkeleton />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Iframe (fades in after onLoad) */}
              <motion.iframe
                title={`ProofMark Embed Preview · ${certificateId}`}
                src={iframeSrc}
                onLoad={() => setPreviewLoaded(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: previewLoaded ? 1 : 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                /* セキュリティ隔離 */
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer-when-downgrade"
                loading="lazy"
                style={{
                  width: '100%',
                  maxWidth: 400,
                  height: 460,
                  border: 'none',
                  borderRadius: 12,
                  backgroundColor: '#0A0716',
                  willChange: 'opacity',
                }}
              />

              {/* Verified watermark (常に最前) */}
              <div
                aria-hidden
                className="
                  pointer-events-none absolute bottom-2 right-2 z-20
                  inline-flex items-center gap-1
                  px-2 py-0.5 rounded-full
                  text-[8.5px] font-mono font-bold uppercase
                  tracking-[0.22em]
                "
                style={{
                  color: NEON,
                  backgroundColor: 'rgba(5,3,8,0.7)',
                  border: `1px solid ${NEON}55`,
                  backdropFilter: 'blur(6px)',
                }}
              >
                <ShieldCheck size={9} />
                LIVE
              </div>
            </div>
          </div>

          {/* Preview caption */}
          <p
            className="
              mt-4 text-[10.5px] font-mono uppercase
              tracking-[0.22em]
              text-white/30
            "
          >
            ISOLATED IFRAME · /api/embed · NO LAYOUT SHIFT
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: CopyButton — Magnetic Snap + Neon Pulse
   ═══════════════════════════════════════════════════════════════ */

interface CopyButtonProps {
  copied: boolean;
  onClick: () => void;
}

function CopyButton({ copied, onClick }: CopyButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={!copied ? { scale: 1.015 } : undefined}
      whileTap={!copied ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      animate={
        copied
          ? {
              scale: [1, 1.04, 1],
              boxShadow: [
                `0 0 0px 0px rgba(0,255,178,0)`,
                `0 0 38px 6px rgba(0,255,178,0.75)`,
                `0 0 18px 2px rgba(0,255,178,0.45)`,
              ],
            }
          : {
              boxShadow: '0 14px 30px -10px rgba(0,0,0,0.7)',
            }
      }
      className={`
        group relative w-full
        mt-4
        inline-flex items-center justify-center gap-3
        px-5 py-3.5 rounded-xl
        font-mono font-bold uppercase
        text-[13px] tracking-[0.22em]
        overflow-hidden
        transition-colors duration-300
        ${copied ? 'cursor-default' : 'cursor-pointer'}
      `}
      style={{
        color: copied ? '#03150E' : '#FFFFFF',
        backgroundColor: copied ? NEON : '#0F0F14',
        backgroundImage: copied
          ? `linear-gradient(135deg, ${NEON} 0%, #5BFFD2 100%)`
          : `linear-gradient(180deg, #15131F 0%, #0B0915 100%)`,
        border: copied
          ? `1px solid ${NEON}`
          : '1px solid rgba(255,255,255,0.12)',
        willChange: 'transform, box-shadow, background-color',
      }}
      aria-live="polite"
      aria-label={copied ? 'コピー完了' : 'スニペットをコピー'}
      disabled={copied}
    >
      {/* Hover glow ring */}
      {!copied && (
        <span
          aria-hidden
          className="
            pointer-events-none absolute inset-0 rounded-xl
            opacity-0 group-hover:opacity-100
            transition-opacity duration-300
          "
          style={{
            boxShadow: `0 0 22px 2px rgba(0,255,178,0.55), 0 0 48px rgba(108,62,244,0.35)`,
          }}
        />
      )}

      {/* Sweep */}
      {!copied && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3"
          style={{
            backgroundImage:
              'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)',
            mixBlendMode: 'overlay',
            transform: 'translateX(-110%)',
            animation: 'wb-sweep 2.6s ease-in-out infinite',
            animationDelay: '0.4s',
          }}
        />
      )}

      {/* Icon (cross-fade Clipboard ↔ Check) */}
      <span
        className="relative inline-flex items-center justify-center"
        aria-hidden
        style={{ width: 18, height: 18 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 22 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check size={18} strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span
              key="clip"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 22 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Clipboard size={16} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {/* Label */}
      <span className="relative z-10">
        {copied ? 'COPIED · READY TO SHIP' : 'COPY SNIPPET TO CLIPBOARD'}
      </span>

      {/* Trailing sparkle on success */}
      <AnimatePresence>
        {copied && (
          <motion.span
            key="sparkle"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10"
            aria-hidden
          >
            <Sparkles size={14} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Keyframes */}
      <style>{`
        @keyframes wb-sweep {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(310%); }
        }
      `}</style>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: SectionEyebrow
   ═══════════════════════════════════════════════════════════════ */

function SectionEyebrow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="
          inline-flex items-center justify-center
          w-5 h-5 rounded
        "
        style={{
          color: NEON,
          backgroundColor: 'rgba(0,255,178,0.08)',
          border: `1px solid ${NEON}45`,
        }}
      >
        {icon}
      </span>
      <span
        className="
          text-[10px] font-mono font-bold uppercase
          tracking-[0.26em]
          text-white/55
        "
      >
        {label}
      </span>
      <span
        className="ml-2 flex-1 h-px"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: BenefitChip
   ═══════════════════════════════════════════════════════════════ */

function BenefitChip({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div
      className="
        flex items-center gap-2.5
        rounded-xl
        px-3 py-2
        border
        backdrop-blur-md
      "
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <span
        className="
          inline-flex items-center justify-center
          w-7 h-7 rounded-lg shrink-0
        "
        style={{
          color: NEON,
          backgroundColor: 'rgba(0,255,178,0.08)',
          border: `1px solid ${NEON}3a`,
        }}
      >
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]"
          style={{ color: NEON }}
        >
          {label}
        </span>
        <span className="text-[10.5px] text-white/55 truncate">{sub}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: CyberpunkSkeleton — Framer Motion pulse
   ═══════════════════════════════════════════════════════════════ */

function CyberpunkSkeleton() {
  return (
    <div
      className="
        relative w-full h-full
        rounded-[12px]
        overflow-hidden
      "
      style={{
        backgroundColor: '#0A0716',
        border: `1px solid ${BORDER_PURPLE}`,
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
      }}
      aria-busy="true"
      aria-label="Loading preview"
    >
      {/* Cyber grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,178,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,178,0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage:
            'radial-gradient(ellipse at center, black 50%, transparent 100%)',
        }}
      />

      {/* Header strip */}
      <div className="p-4 pt-5">
        <motion.div
          className="h-3 w-1/3 rounded"
          animate={{ opacity: [0.25, 0.7, 0.25] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: `linear-gradient(90deg, ${PURPLE}55, ${NEON}55)`,
          }}
        />
        <motion.div
          className="mt-3 h-5 w-3/4 rounded"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.15,
          }}
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* Center artwork placeholder */}
      <div className="px-4">
        <motion.div
          className="mt-2 w-full rounded-lg"
          style={{
            height: 220,
            backgroundImage: `linear-gradient(135deg, rgba(108,62,244,0.18) 0%, rgba(0,255,178,0.10) 100%)`,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
          animate={{
            boxShadow: [
              '0 0 0px 0px rgba(0,255,178,0)',
              '0 0 24px 4px rgba(0,255,178,0.25)',
              '0 0 0px 0px rgba(0,255,178,0)',
            ],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Inner lock glyph */}
          <div className="w-full h-full flex items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.55, 1, 0.55],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ color: NEON }}
            >
              <ShieldCheck size={42} strokeWidth={1.5} />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Hash / meta lines */}
      <div className="px-4 pt-4 space-y-2">
        {[80, 60, 45].map((w, i) => (
          <motion.div
            key={i}
            className="h-2 rounded"
            style={{
              width: `${w}%`,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.12,
            }}
          />
        ))}
      </div>

      {/* Scanline sweep */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-24"
        initial={{ y: '-30%' }}
        animate={{ y: '130%' }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          backgroundImage:
            'linear-gradient(180deg, transparent 0%, rgba(0,255,178,0.18) 50%, transparent 100%)',
          mixBlendMode: 'screen',
          willChange: 'transform',
        }}
      />

      {/* Bottom status strip */}
      <div
        className="
          absolute bottom-0 inset-x-0
          px-3 py-2
          flex items-center justify-between
          text-[9px] font-mono font-bold uppercase
          tracking-[0.22em]
        "
        style={{
          borderTop: `1px solid ${BORDER_PURPLE}`,
          backgroundColor: 'rgba(5,3,8,0.7)',
          color: NEON,
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-1 h-1 rounded-full"
            style={{
              backgroundColor: NEON,
              boxShadow: `0 0 6px ${NEON}`,
            }}
          />
          ESTABLISHING SECURE CHANNEL…
        </span>
        <span className="text-white/40">/api/embed</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: BackdropPlasma — 微かな後光
   ═══════════════════════════════════════════════════════════════ */

function BackdropPlasma() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 70% 50% at 15% 15%, rgba(108,62,244,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 45% at 90% 90%, rgba(0,255,178,0.10) 0%, transparent 65%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: SyntaxColoredSnippet — 極簡易シンタックスハイライト
   ═══════════════════════════════════════════════════════════════ */

function SyntaxColoredSnippet({ code }: { code: string }) {
  // <タグ>, "文字列", 属性名= をネオン/パープルで彩色
  // セキュリティ: code は内部生成のため XSS リスクなし。HTML 表示は escapeHtml 経由で行う。
  const html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // タグ名
    .replace(
      /(&lt;\/?)([a-zA-Z][\w-]*)/g,
      `$1<span style="color:${NEON};font-weight:700">$2</span>`,
    )
    // 属性名
    .replace(
      /\s([a-zA-Z-]+)=/g,
      ` <span style="color:#B5A8FF">$1</span>=`,
    )
    // 文字列
    .replace(
      /"([^"]*)"/g,
      `"<span style="color:#FFD986">$1</span>"`,
    );

  return (
    <code
      // 自前生成のサニタイズ済み文字列のみを描画
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        fontFamily:
          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Utility: escapeHtml — タイトル等の安全埋め込み
   ═══════════════════════════════════════════════════════════════ */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
