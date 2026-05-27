/**
 * Portfolio Embed Widget — Live Demo (God Mode)
 * ----------------------------------------------------------------------------
 * LP上で「このバッジを、今すぐ自分のサイトに貼りたい」と思わせるための最終兵器。
 *
 * 左:  Widget Customizer (40%)   — ガラス質感のコックピット
 * 右:  Live Preview      (60%)   — macOSクロームに包まれた架空ポートフォリオ
 *                                   × 9枚の純CSSジェネラティブアート
 *                                   × Verifiedバッジの深海クラゲ脈動
 *                                   × layout アニメで Grid ⇄ Compact が溶ける
 * ----------------------------------------------------------------------------
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  LayoutGrid,
  Lock,
  Monitor,
  Palette,
  Rows3,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  User,
  Zap,
} from 'lucide-react';

/* ─────────────────────── Tokens ─────────────────────── */

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const C = {
  voidBlack: '#07061A',
  purple: '#6C3EF4',
  purpleHi: '#8B61FF',
  teal: '#00D4AA',
  gold: '#F0BB38',
  surface: '#0D0B24',
  surfaceLift: '#13112C',
  border: '#1C1A38',
  borderHi: '#2A2750',
  textMain: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.72)',
  textSubtle: 'rgba(255,255,255,0.45)',
  textWhisper: 'rgba(255,255,255,0.22)',
} as const;

type AccentKey = 'purple' | 'teal' | 'gold';
type ThemeMode = 'dark' | 'light';
type LayoutMode = 'grid' | 'compact';
type ShowCount = 3 | 6 | 9;

const ACCENTS: Record<AccentKey, { hex: string; rgb: string; name: string }> = {
  purple: { hex: '#6C3EF4', rgb: '108,62,244', name: 'Identity' },
  teal: { hex: '#00D4AA', rgb: '0,212,170', name: 'Proof' },
  gold: { hex: '#F0BB38', rgb: '240,187,56', name: 'Founder' },
};

/* ────────────── Generative CSS Artwork (9 unique pieces) ────────────── */

interface ArtworkPiece {
  id: string;
  title: string;
  category: string;
  ago: string;
  background: string;
  mixBlend: CSSProperties['mixBlendMode'];
  overlay?: string;
  hueRotate?: number;
}

const ARTWORKS: ReadonlyArray<ArtworkPiece> = [
  {
    id: 'aurora',
    title: 'Aurora Veil',
    category: 'Generative',
    ago: '2 days ago',
    background: `
      radial-gradient(ellipse 90% 60% at 20% 20%, #7C4DFF 0%, transparent 55%),
      radial-gradient(ellipse 70% 50% at 80% 70%, #00E5C7 0%, transparent 55%),
      conic-gradient(from 210deg at 50% 50%, #1E1B4B 0%, #4338CA 25%, #06B6D4 50%, #1E1B4B 100%)
    `,
    mixBlend: 'screen',
    overlay: `repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 6px)`,
  },
  {
    id: 'ember',
    title: 'Ember Lattice',
    category: 'Type Art',
    ago: '5 days ago',
    background: `
      conic-gradient(from 0deg at 65% 35%, #FF6B35 0deg, #F0BB38 90deg, #6C3EF4 200deg, #FF6B35 360deg),
      radial-gradient(circle at 30% 70%, rgba(0,0,0,0.55) 0%, transparent 60%)
    `,
    mixBlend: 'overlay',
    overlay: `repeating-conic-gradient(from 0deg at 50% 50%, rgba(0,0,0,0.25) 0deg, transparent 8deg 16deg)`,
  },
  {
    id: 'tide',
    title: 'Tide Memory',
    category: 'Photography',
    ago: '1 week ago',
    background: `
      linear-gradient(160deg, #001F3F 0%, #0E7490 45%, #06B6D4 75%, #99F6E4 100%),
      radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.5) 0%, transparent 40%)
    `,
    mixBlend: 'screen',
    overlay: `repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 4px)`,
  },
  {
    id: 'quartz',
    title: 'Quartz Bloom',
    category: '3D / Render',
    ago: '2 weeks ago',
    background: `
      conic-gradient(from 45deg at 50% 50%, #F472B6 0%, #A78BFA 25%, #60A5FA 50%, #F0BB38 75%, #F472B6 100%),
      radial-gradient(circle at 50% 50%, rgba(0,0,0,0.45) 0%, transparent 65%)
    `,
    mixBlend: 'soft-light',
    overlay: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 40%)`,
  },
  {
    id: 'velvet',
    title: 'Velvet Cipher',
    category: 'Brand Design',
    ago: '3 weeks ago',
    background: `
      linear-gradient(135deg, #0B0420 0%, #4C1D95 50%, #DB2777 100%),
      radial-gradient(ellipse at 80% 20%, rgba(240,187,56,0.55) 0%, transparent 50%)
    `,
    mixBlend: 'overlay',
    overlay: `repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 10px)`,
  },
  {
    id: 'chroma',
    title: 'Chroma Drift',
    category: 'Illustration',
    ago: '1 month ago',
    background: `
      conic-gradient(from 180deg at 30% 60%, #22D3EE, #A78BFA, #F472B6, #FBBF24, #22D3EE),
      radial-gradient(circle at 70% 30%, rgba(0,0,0,0.4), transparent 50%)
    `,
    mixBlend: 'screen',
    overlay: `repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 2px, transparent 2px, transparent 10px)`,
  },
  {
    id: 'monolith',
    title: 'Monolith / 03',
    category: 'Editorial',
    ago: '1 month ago',
    background: `
      linear-gradient(180deg, #0F172A 0%, #1E293B 50%, #334155 100%),
      radial-gradient(ellipse at 50% 0%, rgba(108,62,244,0.4) 0%, transparent 55%)
    `,
    mixBlend: 'normal',
    overlay: `repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 8px)`,
  },
  {
    id: 'helios',
    title: 'Helios Bloom',
    category: 'Motion',
    ago: '2 months ago',
    background: `
      radial-gradient(circle at 50% 50%, #FCD34D 0%, #F59E0B 25%, #DC2626 60%, #1E1B4B 100%),
      conic-gradient(from 90deg at 50% 50%, transparent 0deg, rgba(0,0,0,0.4) 90deg, transparent 180deg, rgba(0,0,0,0.4) 270deg, transparent 360deg)
    `,
    mixBlend: 'overlay',
    overlay: `radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.4) 80%)`,
  },
  {
    id: 'glacier',
    title: 'Glacier Edge',
    category: 'Architecture',
    ago: '3 months ago',
    background: `
      linear-gradient(155deg, #DBEAFE 0%, #67E8F9 45%, #1E40AF 100%),
      repeating-linear-gradient(75deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 14px)
    `,
    mixBlend: 'screen',
    overlay: `radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.5), transparent 50%)`,
  },
];

/* ─────────────────── Main Component ─────────────────── */

export default function PortfolioEmbedWidgetDemo(): JSX.Element {
  const reduce = useReducedMotion() ?? false;

  // Customizer state
  const [username, setUsername] = useState('akiko_kurose');
  const [bio, setBio] = useState(
    'Illustrator & Visual Designer · NDA-protected commissions for tech & fashion clients.',
  );
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [count, setCount] = useState<ShowCount>(6);
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [showBadges, setShowBadges] = useState(true);
  const [accent, setAccent] = useState<AccentKey>('teal');

  const [copied, setCopied] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  const embedCode = useMemo(() => {
    return `<script
  src="https://proofmark.jp/widget.js"
  data-user="${username}"
  data-theme="${theme}"
  data-layout="${layout}"
  data-count="${count}"
  data-badges="${showBadges}"
  data-accent="${accent}"
  defer
></script>`;
  }, [username, theme, layout, count, showBadges, accent]);

  const handleCopy = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(embedCode).catch(() => {
        /* ignore */
      });
    }
    setCopied(true);
    setConfettiKey((k) => k + 1);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
  }, [embedCode]);

  return (
    <section
      className="relative w-full"
      style={{ color: C.textMain }}
    >
      <div className="grid gap-5 lg:grid-cols-[40fr_60fr] lg:gap-6">
        {/* ───────────── LEFT: Customizer ───────────── */}
        <Customizer
          username={username}
          setUsername={setUsername}
          bio={bio}
          setBio={setBio}
          theme={theme}
          setTheme={setTheme}
          count={count}
          setCount={setCount}
          layout={layout}
          setLayout={setLayout}
          showBadges={showBadges}
          setShowBadges={setShowBadges}
          accent={accent}
          setAccent={setAccent}
          embedCode={embedCode}
          copied={copied}
          onCopy={handleCopy}
          reduce={reduce}
        />

        {/* ───────────── RIGHT: Live Preview ───────────── */}
        <LivePreview
          username={username}
          bio={bio}
          theme={theme}
          count={count}
          layout={layout}
          showBadges={showBadges}
          accent={accent}
          reduce={reduce}
        />
      </div>

      {/* Confetti */}
      <AnimatePresence>
        {copied && !reduce && <LightweightConfetti key={confettiKey} accent={accent} />}
      </AnimatePresence>
    </section>
  );
}

/* ═══════════════════════ LEFT: Customizer ═══════════════════════ */

interface CustomizerProps {
  username: string;
  setUsername: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  theme: ThemeMode;
  setTheme: (v: ThemeMode) => void;
  count: ShowCount;
  setCount: (v: ShowCount) => void;
  layout: LayoutMode;
  setLayout: (v: LayoutMode) => void;
  showBadges: boolean;
  setShowBadges: (v: boolean) => void;
  accent: AccentKey;
  setAccent: (v: AccentKey) => void;
  embedCode: string;
  copied: boolean;
  onCopy: () => void;
  reduce: boolean;
}

function Customizer(props: CustomizerProps) {
  const {
    username,
    setUsername,
    bio,
    setBio,
    theme,
    setTheme,
    count,
    setCount,
    layout,
    setLayout,
    showBadges,
    setShowBadges,
    accent,
    setAccent,
    embedCode,
    copied,
    onCopy,
    reduce,
  } = props;

  const accentHex = ACCENTS[accent].hex;
  const accentRgb = ACCENTS[accent].rgb;

  return (
    <motion.div
      initial={{ opacity: 0, x: reduce ? 0 : -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduce ? 0 : 0.6, ease: PM_EASE }}
      className="relative rounded-[24px] overflow-hidden"
      style={{
        background:
          'linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 60%, rgba(0,0,0,0.4) 100%)',
        border: `1px solid ${C.border}`,
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.04), 0 30px 80px -40px rgba(0,0,0,0.9)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* corner glow */}
      <div
        aria-hidden
        className="absolute -top-20 -left-20 h-48 w-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: accentHex, opacity: 0.18, transition: 'background 400ms' }}
      />

      <div className="relative p-5 sm:p-6">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: `rgba(${accentRgb}, 0.14)`,
                border: `1px solid rgba(${accentRgb}, 0.32)`,
              }}
            >
              <Sparkles className="h-4 w-4" style={{ color: accentHex }} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold tracking-tight">
                Widget Customizer
              </h3>
              <p
                className="text-[10.5px] font-mono uppercase tracking-[0.22em]"
                style={{ color: C.textSubtle }}
              >
                live · synced
              </p>
            </div>
          </div>

          {/* live indicator */}
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em]"
            style={{
              background: 'rgba(0,212,170,0.10)',
              border: `1px solid rgba(0,212,170,0.30)`,
              color: C.teal,
            }}
          >
            <motion.span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: C.teal, boxShadow: `0 0 8px ${C.teal}` }}
              animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            REAL-TIME
          </div>
        </div>

        {/* ── Username ── */}
        <Field icon={<User className="h-3.5 w-3.5" />} label="Display name">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="akiko_kurose"
            className="w-full bg-transparent text-[14px] font-medium outline-none"
            style={{ color: C.textMain }}
          />
        </Field>

        {/* ── Bio ── */}
        <Field icon={<Code2 className="h-3.5 w-3.5" />} label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            placeholder="Tell the world what you create…"
            className="w-full bg-transparent text-[13px] leading-relaxed outline-none resize-none"
            style={{ color: C.textMain }}
          />
        </Field>

        {/* ── Theme ── */}
        <ControlBlock label="Theme" hint={theme === 'dark' ? 'Obsidian' : 'Linen'}>
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', icon: <Moon className="h-3.5 w-3.5" />, label: 'Dark' },
              { value: 'light', icon: <Sun className="h-3.5 w-3.5" />, label: 'Light' },
            ]}
            accent={accentHex}
          />
        </ControlBlock>

        {/* ── Count ── */}
        <ControlBlock label="Show works" hint={`${count} pieces`}>
          <Segmented
            value={count}
            onChange={(v) => setCount(v as ShowCount)}
            options={[
              { value: 3, label: '3' },
              { value: 6, label: '6' },
              { value: 9, label: '9' },
            ]}
            accent={accentHex}
          />
        </ControlBlock>

        {/* ── Layout ── */}
        <ControlBlock
          label="Layout"
          hint={layout === 'grid' ? 'Editorial Grid' : 'Compact Reel'}
        >
          <Segmented
            value={layout}
            onChange={setLayout}
            options={[
              {
                value: 'grid',
                icon: <LayoutGrid className="h-3.5 w-3.5" />,
                label: 'Grid',
              },
              {
                value: 'compact',
                icon: <Rows3 className="h-3.5 w-3.5" />,
                label: 'Compact',
              },
            ]}
            accent={accentHex}
          />
        </ControlBlock>

        {/* ── Badges toggle ── */}
        <ControlBlock label="Verified badge" hint={showBadges ? 'visible' : 'hidden'}>
          <button
            type="button"
            onClick={() => setShowBadges(!showBadges)}
            className="relative h-7 w-12 rounded-full transition-colors"
            style={{
              background: showBadges
                ? `rgba(${accentRgb}, 0.30)`
                : 'rgba(255,255,255,0.08)',
              border: `1px solid ${
                showBadges ? `rgba(${accentRgb}, 0.55)` : C.border
              }`,
            }}
            aria-pressed={showBadges}
          >
            <motion.span
              className="absolute top-0.5 h-5 w-5 rounded-full flex items-center justify-center"
              style={{
                background: showBadges ? accentHex : '#FFFFFF',
                boxShadow: showBadges
                  ? `0 0 12px rgba(${accentRgb}, 0.6)`
                  : '0 1px 4px rgba(0,0,0,0.4)',
              }}
              animate={{ left: showBadges ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              {showBadges ? (
                <Eye className="h-2.5 w-2.5" color={C.voidBlack} strokeWidth={3} />
              ) : (
                <EyeOff className="h-2.5 w-2.5" color="#6B7280" strokeWidth={3} />
              )}
            </motion.span>
          </button>
        </ControlBlock>

        {/* ── Accent ── */}
        <ControlBlock label="Accent color" hint={ACCENTS[accent].name}>
          <div className="flex items-center gap-2">
            {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
              const a = ACCENTS[k];
              const isActive = k === accent;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAccent(k)}
                  className="relative h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: a.hex,
                    boxShadow: isActive
                      ? `0 0 0 2px ${C.voidBlack}, 0 0 0 4px ${a.hex}, 0 0 22px rgba(${a.rgb}, 0.6)`
                      : `0 6px 16px rgba(${a.rgb}, 0.25)`,
                    transition: 'box-shadow 240ms',
                  }}
                  aria-pressed={isActive}
                  aria-label={a.name}
                >
                  {isActive && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                    >
                      <Check
                        className="h-4 w-4"
                        color={C.voidBlack}
                        strokeWidth={3.5}
                      />
                    </motion.span>
                  )}
                </button>
              );
            })}
          </div>
        </ControlBlock>

        {/* Divider */}
        <div
          className="my-5 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${C.borderHi}, transparent)`,
          }}
        />

        {/* Embed code preview */}
        <div className="mb-3 flex items-center justify-between">
          <p
            className="text-[10.5px] font-mono uppercase tracking-[0.22em]"
            style={{ color: accentHex }}
          >
            <Code2 className="inline h-3 w-3 mr-1.5 -mt-0.5" />
            Embed snippet
          </p>
          <p
            className="text-[9.5px] font-mono uppercase tracking-[0.18em]"
            style={{ color: C.textSubtle }}
          >
            html · 1 line
          </p>
        </div>

        <div
          className="rounded-xl overflow-hidden mb-4"
          style={{
            background: '#06051A',
            border: `1px solid ${C.border}`,
          }}
        >
          <pre
            className="p-3.5 text-[10.5px] leading-[1.65] font-mono overflow-auto max-h-[160px]"
            style={{
              color: 'rgba(255,255,255,0.78)',
              fontVariantLigatures: 'none',
            }}
          >
            <code>
              {embedCode.split('\n').map((line, i) => (
                <div key={i} className="flex">
                  <span
                    className="select-none pr-3 text-right shrink-0"
                    style={{ color: C.textWhisper, width: 22 }}
                  >
                    {i + 1}
                  </span>
                  <span>{colorizeHtml(line, accentHex)}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>

        {/* CTA */}
        <motion.button
          type="button"
          onClick={onCopy}
          whileHover={reduce ? undefined : { scale: 1.02 }}
          whileTap={reduce ? undefined : { scale: 0.98 }}
          className="relative w-full overflow-hidden rounded-xl px-5 py-3.5 text-[14px] font-semibold flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${accentHex} 0%, ${shade(accentHex, -12)} 100%)`,
            color: accent === 'gold' ? C.voidBlack : '#FFFFFF',
            boxShadow: `0 14px 36px -12px rgba(${accentRgb}, 0.7), inset 0 1px 0 rgba(255,255,255,0.22)`,
          }}
        >
          {/* shimmer */}
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-y-0 w-1/3 pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
              }}
              initial={{ left: '-40%' }}
              animate={{ left: '110%' }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                repeatDelay: 1.6,
                ease: 'easeInOut',
              }}
            />
          )}

          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="copied"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: PM_EASE }}
                className="flex items-center gap-2 relative"
              >
                <Check className="h-4 w-4" strokeWidth={3} />
                埋め込みコードをコピーしました
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: PM_EASE }}
                className="flex items-center gap-2 relative"
              >
                <Copy className="h-4 w-4" />
                💻 埋め込みコードをコピー
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <p
          className="mt-3 text-center text-[11px]"
          style={{ color: C.textSubtle }}
        >
          <Lock className="inline h-3 w-3 -mt-0.5 mr-1" />
          サーバーレス・1 行で動作・あらゆるサイトに対応
        </p>
      </div>
    </motion.div>
  );
}

/* ── Customizer subcomponents ── */

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-3 rounded-xl px-3.5 py-2.5"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${C.border}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color: C.textSubtle }}>{icon}</span>
        <span
          className="text-[10px] font-mono uppercase tracking-[0.2em]"
          style={{ color: C.textSubtle }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ControlBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p
          className="text-[10.5px] font-mono uppercase tracking-[0.2em]"
          style={{ color: C.textSubtle }}
        >
          {label}
        </p>
        <p className="text-[12px] truncate" style={{ color: C.textMuted }}>
          {hint}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface SegmentedOption<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  accent,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  accent: string;
}) {
  return (
    <LayoutGroup id={`seg-${options.map((o) => o.value).join('-')}`}>
      <div
        className="relative flex items-center rounded-lg p-0.5"
        style={{
          background: 'rgba(0,0,0,0.35)',
          border: `1px solid ${C.border}`,
        }}
      >
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className="relative z-[1] flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium"
              style={{
                color: isActive ? C.voidBlack : C.textMuted,
                transition: 'color 240ms',
              }}
            >
              {isActive && (
                <motion.span
                  layoutId={`seg-bg-${options.map((o) => o.value).join('-')}`}
                  className="absolute inset-0 rounded-md -z-[1]"
                  style={{
                    background: accent,
                    boxShadow: `0 0 14px rgba(${hexToRgb(accent)}, 0.55)`,
                  }}
                  transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                />
              )}
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ═══════════════════════ RIGHT: Live Preview ═══════════════════════ */

interface LivePreviewProps {
  username: string;
  bio: string;
  theme: ThemeMode;
  count: ShowCount;
  layout: LayoutMode;
  showBadges: boolean;
  accent: AccentKey;
  reduce: boolean;
}

function LivePreview({
  username,
  bio,
  theme,
  count,
  layout,
  showBadges,
  accent,
  reduce,
}: LivePreviewProps) {
  const accentHex = ACCENTS[accent].hex;
  const accentRgb = ACCENTS[accent].rgb;
  const isDark = theme === 'dark';

  // theme tokens for inside the browser chrome
  const t = isDark
    ? {
        page: '#0A0820',
        pageAlt: '#0F0C2A',
        card: 'rgba(255,255,255,0.04)',
        cardBorder: 'rgba(255,255,255,0.08)',
        textMain: '#FFFFFF',
        textMuted: 'rgba(255,255,255,0.62)',
        textSubtle: 'rgba(255,255,255,0.38)',
        divider: 'rgba(255,255,255,0.06)',
      }
    : {
        page: '#FAFAF7',
        pageAlt: '#F2F0EC',
        card: '#FFFFFF',
        cardBorder: 'rgba(0,0,0,0.08)',
        textMain: '#0F0F14',
        textMuted: 'rgba(15,15,20,0.62)',
        textSubtle: 'rgba(15,15,20,0.38)',
        divider: 'rgba(0,0,0,0.06)',
      };

  return (
    <motion.div
      initial={{ opacity: 0, x: reduce ? 0 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduce ? 0 : 0.6, ease: PM_EASE }}
      className="relative"
    >
      {/* aura glow behind the browser */}
      <motion.div
        aria-hidden
        className="absolute -inset-6 rounded-[36px] blur-3xl pointer-events-none"
        animate={
          reduce
            ? undefined
            : {
                opacity: [0.35, 0.6, 0.35],
              }
        }
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: `radial-gradient(ellipse at 30% 20%, rgba(${accentRgb}, 0.45), transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(108,62,244,0.32), transparent 55%)`,
          opacity: 0.45,
        }}
      />

      {/* Browser chrome */}
      <div
        className="relative rounded-[20px] overflow-hidden"
        style={{
          background: isDark ? '#0A0820' : '#FFFFFF',
          border: `1px solid rgba(${accentRgb}, 0.32)`,
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 30px 60px -30px rgba(0,0,0,0.9),
            0 0 80px -20px rgba(${accentRgb}, 0.35)
          `,
        }}
      >
        {/* chrome bar */}
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{
            background: isDark
              ? 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))'
              : 'linear-gradient(180deg, #F0EEEA, #E5E3DE)',
            borderBottom: `1px solid ${
              isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
            }`,
          }}
        >
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: '#FF5F57' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: '#FEBC2E' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: '#28C840' }} />
          </div>

          <div
            className="flex-1 mx-3 rounded-md px-3 py-1 flex items-center gap-2 max-w-md mx-auto"
            style={{
              background: isDark ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${
                isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
              }`,
            }}
          >
            <Lock
              className="h-3 w-3 shrink-0"
              style={{ color: isDark ? C.teal : '#16A34A' }}
            />
            <span
              className="font-mono text-[11px] truncate"
              style={{ color: t.textMuted }}
            >
              https://{username || 'creator'}.studio
              <span style={{ color: t.textSubtle }}>/portfolio</span>
            </span>
            <span className="ml-auto shrink-0">
              <Globe className="h-3 w-3" style={{ color: t.textSubtle }} />
            </span>
          </div>

          <div
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-[0.18em]"
            style={{
              color: accentHex,
              background: `rgba(${accentRgb}, 0.12)`,
              border: `1px solid rgba(${accentRgb}, 0.30)`,
            }}
          >
            <Zap className="h-2.5 w-2.5" />
            powered by ProofMark
          </div>
        </div>

        {/* page body */}
        <div
          className="relative"
          style={{
            background: `radial-gradient(ellipse at 20% -10%, rgba(${accentRgb}, ${
              isDark ? 0.12 : 0.06
            }) 0%, transparent 50%), ${t.page}`,
            minHeight: 560,
          }}
        >
          {/* page header */}
          <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-5">
            <div className="flex items-start gap-4">
              {/* avatar (generative gradient) */}
              <div
                className="relative shrink-0 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl overflow-hidden"
                style={{
                  background: `
                    conic-gradient(from 90deg at 50% 50%, ${accentHex}, #6C3EF4, ${accentHex}),
                    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 50%)
                  `,
                  boxShadow: `0 8px 24px -8px rgba(${accentRgb}, 0.6)`,
                }}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center font-bold text-[22px]"
                  style={{
                    color: '#FFFFFF',
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    fontFamily: '"Poppins", "Inter", sans-serif',
                  }}
                >
                  {(username || 'C').slice(0, 1).toUpperCase()}
                </span>
                {showBadges && (
                  <div
                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center"
                    style={{
                      background: t.page,
                      border: `2px solid ${t.page}`,
                    }}
                  >
                    <div
                      className="h-full w-full rounded-full flex items-center justify-center"
                      style={{
                        background: accentHex,
                        boxShadow: `0 0 10px rgba(${accentRgb}, 0.8)`,
                      }}
                    >
                      <Check
                        className="h-3 w-3"
                        color={accent === 'gold' ? C.voidBlack : '#FFFFFF'}
                        strokeWidth={3.5}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="text-[20px] sm:text-[22px] font-extrabold tracking-tight"
                    style={{ color: t.textMain }}
                  >
                    {username || 'creator'}
                  </h2>
                  {showBadges && (
                    <BreathingBadge
                      accent={accentHex}
                      accentRgb={accentRgb}
                      reduce={reduce}
                      mini
                    />
                  )}
                </div>
                <p
                  className="mt-1.5 text-[13px] leading-relaxed line-clamp-2"
                  style={{ color: t.textMuted }}
                >
                  {bio || '—'}
                </p>
                <div className="mt-2.5 flex items-center gap-3 text-[11px] font-mono">
                  <Stat label="works" value={count} color={t.textMain} sub={t.textSubtle} />
                  <Divider color={t.divider} />
                  <Stat label="verified" value={count} color={accentHex} sub={t.textSubtle} />
                  <Divider color={t.divider} />
                  <Stat label="RFC3161" value="✓" color={accentHex} sub={t.textSubtle} />
                </div>
              </div>
            </div>
          </div>

          {/* divider */}
          <div
            className="mx-6 sm:mx-10 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${t.divider}, transparent)`,
            }}
          />

          {/* works grid */}
          <div className="px-6 sm:px-10 py-5 sm:py-6">
            <div className="mb-4 flex items-center justify-between">
              <h3
                className="text-[12px] font-mono uppercase tracking-[0.22em]"
                style={{ color: t.textSubtle }}
              >
                Verified Works · Latest {count}
              </h3>
              <span
                className="text-[10.5px] font-mono uppercase tracking-[0.2em]"
                style={{ color: accentHex }}
              >
                {layout === 'grid' ? 'editorial grid' : 'compact reel'}
              </span>
            </div>

            <LayoutGroup>
              <motion.div
                layout
                className={
                  layout === 'grid'
                    ? 'grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3'
                    : 'flex flex-col gap-2.5'
                }
                transition={
                  reduce
                    ? { duration: 0 }
                    : { layout: { duration: 0.6, ease: PM_EASE } }
                }
              >
                <AnimatePresence mode="popLayout">
                  {ARTWORKS.slice(0, count).map((art, i) => (
                    <ArtworkCard
                      key={art.id}
                      art={art}
                      index={i}
                      layout={layout}
                      theme={t}
                      isDark={isDark}
                      showBadges={showBadges}
                      accentHex={accentHex}
                      accentRgb={accentRgb}
                      reduce={reduce}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>
          </div>

          {/* footer attribution */}
          <div
            className="mx-6 sm:mx-10 mt-3 mb-6 flex items-center justify-between border-t pt-4 text-[10.5px] font-mono uppercase tracking-[0.2em]"
            style={{ borderColor: t.divider, color: t.textSubtle }}
          >
            <span>© {username || 'creator'}.studio · All works NDA-cleared</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck
                className="h-3 w-3"
                style={{ color: accentHex }}
              />
              proofmark.jp
            </span>
          </div>
        </div>
      </div>

      {/* anchor caption below the chrome */}
      <div className="mt-4 flex items-center justify-between text-[11px] font-mono">
        <span
          className="flex items-center gap-1.5"
          style={{ color: C.textSubtle }}
        >
          <Monitor className="h-3 w-3" />
          live preview · changes apply in real time
        </span>
        <span style={{ color: accentHex }}>{`${count} works · ${layout}`}</span>
      </div>
    </motion.div>
  );
}

/* ─────────── Artwork Card ─────────── */

interface ThemeTokens {
  page: string;
  pageAlt: string;
  card: string;
  cardBorder: string;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  divider: string;
}

function ArtworkCard({
  art,
  index,
  layout,
  theme,
  isDark,
  showBadges,
  accentHex,
  accentRgb,
  reduce,
}: {
  art: ArtworkPiece;
  index: number;
  layout: LayoutMode;
  theme: ThemeTokens;
  isDark: boolean;
  showBadges: boolean;
  accentHex: string;
  accentRgb: string;
  reduce: boolean;
}) {
  const variants: Variants = reduce
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        hidden: { opacity: 0, y: 16, scale: 0.96 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.5, ease: PM_EASE, delay: index * 0.06 },
        },
        exit: { opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.25 } },
      };

  if (layout === 'compact') {
    return (
      <motion.div
        layout
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        whileHover={
          reduce
            ? undefined
            : {
                y: -2,
                transition: { duration: 0.25, ease: PM_EASE },
              }
        }
        className="group relative flex items-center gap-3 rounded-xl p-2 overflow-hidden"
        style={{
          background: theme.card,
          border: `1px solid ${theme.cardBorder}`,
        }}
      >
        {/* thumb */}
        <Thumb
          art={art}
          className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg"
        />

        <div className="flex-1 min-w-0">
          <p
            className="text-[13px] font-semibold truncate"
            style={{ color: theme.textMain }}
          >
            {art.title}
          </p>
          <p
            className="text-[10.5px] font-mono uppercase tracking-[0.18em] truncate"
            style={{ color: theme.textSubtle }}
          >
            {art.category} · {art.ago}
          </p>
        </div>

        {showBadges && (
          <BreathingBadge
            accent={accentHex}
            accentRgb={accentRgb}
            reduce={reduce}
            compact
          />
        )}
      </motion.div>
    );
  }

  // GRID
  return (
    <motion.div
      layout
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={
        reduce
          ? undefined
          : {
              y: -6,
              transition: { type: 'spring', stiffness: 320, damping: 22 },
            }
      }
      className="group relative rounded-2xl overflow-hidden"
      style={{
        background: theme.card,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      {/* under-card glow on hover */}
      <motion.div
        aria-hidden
        className="absolute -inset-2 rounded-[20px] blur-2xl pointer-events-none opacity-0 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse at 50% 80%, rgba(${accentRgb}, 0.45), transparent 60%)`,
          transition: 'opacity 400ms',
          zIndex: -1,
        }}
      />

      {/* artwork */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <Thumb art={art} className="absolute inset-0" />

        {/* badge floats top-right */}
        {showBadges && (
          <div className="absolute top-2.5 right-2.5">
            <BreathingBadge
              accent={accentHex}
              accentRgb={accentRgb}
              reduce={reduce}
            />
          </div>
        )}

        {/* category chip */}
        <div
          className="absolute bottom-2.5 left-2.5 text-[9.5px] font-mono uppercase tracking-[0.22em] px-2 py-0.5 rounded"
          style={{
            background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)',
            color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,15,20,0.75)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {art.category}
        </div>
      </div>

      {/* meta */}
      <div className="px-3 py-2.5">
        <p
          className="text-[12.5px] font-semibold truncate"
          style={{ color: theme.textMain }}
        >
          {art.title}
        </p>
        <p
          className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.18em]"
          style={{ color: theme.textSubtle }}
        >
          {art.ago} · sha-256
        </p>
      </div>
    </motion.div>
  );
}

/* ─────────── Generative Thumb ─────────── */

function Thumb({
  art,
  className,
}: {
  art: ArtworkPiece;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{
        background: art.background,
        backgroundBlendMode: art.mixBlend,
      }}
    >
      {/* second layer with mix-blend */}
      {art.overlay && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: art.overlay,
            mixBlendMode: 'overlay',
            opacity: 0.85,
          }}
        />
      )}

      {/* film grain */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6) 1px, transparent 1px), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '6px 6px, 9px 9px',
          mixBlendMode: 'overlay',
        }}
      />

      {/* vignette */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* signature mark — every piece subtly carries the ProofMark glyph */}
      <div
        aria-hidden
        className="absolute bottom-1.5 right-1.5 text-[8px] font-mono tracking-[0.3em]"
        style={{
          color: 'rgba(255,255,255,0.4)',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        ✦ PM
      </div>
    </div>
  );
}

/* ─────────── Breathing Verified Badge ─────────── */

function BreathingBadge({
  accent,
  accentRgb,
  reduce,
  compact,
  mini,
}: {
  accent: string;
  accentRgb: string;
  reduce: boolean;
  compact?: boolean;
  mini?: boolean;
}) {
  if (mini) {
    return (
      <motion.span
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  `0 0 0 0 rgba(${accentRgb}, 0.55)`,
                  `0 0 0 6px rgba(${accentRgb}, 0)`,
                  `0 0 0 0 rgba(${accentRgb}, 0.55)`,
                ],
              }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-[0.2em]"
        style={{
          background: `rgba(${accentRgb}, 0.14)`,
          border: `1px solid rgba(${accentRgb}, 0.5)`,
          color: accent,
        }}
      >
        <ShieldCheck className="h-2.5 w-2.5" />
        Verified
      </motion.span>
    );
  }

  if (compact) {
    return (
      <motion.span
        animate={
          reduce
            ? undefined
            : {
                scale: [1, 1.04, 1],
                boxShadow: [
                  `0 0 6px rgba(${accentRgb}, 0.35)`,
                  `0 0 14px rgba(${accentRgb}, 0.65)`,
                  `0 0 6px rgba(${accentRgb}, 0.35)`,
                ],
              }
        }
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{
          background: accent,
          border: `1px solid rgba(255,255,255,0.25)`,
        }}
        aria-label="ProofMark Verified"
      >
        <Check
          className="h-3 w-3"
          color={accent.toLowerCase() === '#f0bb38' ? C.voidBlack : '#FFFFFF'}
          strokeWidth={3.5}
        />
      </motion.span>
    );
  }

  // Default (on artwork)
  return (
    <motion.div
      className="relative inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1"
      style={{
        background: 'rgba(7,6,26,0.72)',
        border: `1px solid rgba(${accentRgb}, 0.55)`,
        backdropFilter: 'blur(10px)',
        boxShadow: `0 6px 18px rgba(0,0,0,0.4)`,
      }}
      animate={
        reduce
          ? undefined
          : {
              scale: [1, 1.03, 1],
              boxShadow: [
                `0 6px 18px rgba(0,0,0,0.4), 0 0 0 0 rgba(${accentRgb}, 0.55)`,
                `0 6px 18px rgba(0,0,0,0.4), 0 0 0 8px rgba(${accentRgb}, 0)`,
                `0 6px 18px rgba(0,0,0,0.4), 0 0 0 0 rgba(${accentRgb}, 0.55)`,
              ],
            }
      }
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="flex h-4 w-4 items-center justify-center rounded-full"
        style={{
          background: accent,
          boxShadow: `0 0 10px rgba(${accentRgb}, 0.7)`,
        }}
        animate={
          reduce
            ? undefined
            : { opacity: [1, 0.75, 1] }
        }
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Check
          className="h-2.5 w-2.5"
          color={accent.toLowerCase() === '#f0bb38' ? C.voidBlack : '#FFFFFF'}
          strokeWidth={4}
        />
      </motion.span>
      <span
        className="text-[9.5px] font-mono uppercase tracking-[0.22em]"
        style={{ color: '#FFFFFF' }}
      >
        ProofMark
      </span>
    </motion.div>
  );
}

/* ─────────── tiny helpers ─────────── */

function Stat({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
  sub: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span style={{ color, fontWeight: 600 }}>{value}</span>
      <span
        style={{ color: sub, fontSize: 9.5 }}
        className="uppercase tracking-[0.2em]"
      >
        {label}
      </span>
    </span>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-px"
      style={{ background: color }}
    />
  );
}

/* ─────────── Confetti ─────────── */

function LightweightConfetti({ accent }: { accent: AccentKey }) {
  const pieces = useMemo(() => {
    const palette = [
      ACCENTS[accent].hex,
      '#FFFFFF',
      C.teal,
      C.gold,
      C.purpleHi,
    ];
    return Array.from({ length: 20 }, (_, i) => {
      const seed = i * 1.61803398875;
      const rand = (k: number) => {
        const v = Math.sin(seed * k) * 10000;
        return v - Math.floor(v);
      };
      return {
        id: i,
        left: 8 + rand(1) * 84,
        color: palette[i % palette.length],
        size: 5 + rand(2) * 7,
        delay: rand(3) * 0.3,
        duration: 1.6 + rand(4) * 1.3,
        rotate: rand(5) * 540 - 270,
        drift: rand(6) * 100 - 50,
        shape: i % 3 === 0 ? 'rect' : 'square',
      };
    });
  }, [accent]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p) => {
        const style: CSSProperties = {
          position: 'absolute',
          top: '-24px',
          left: `${p.left}%`,
          width: p.shape === 'rect' ? p.size * 0.55 : p.size,
          height: p.size,
          background: p.color,
          borderRadius: p.shape === 'rect' ? 1 : 2,
          boxShadow: `0 0 6px ${p.color}66`,
        };
        return (
          <motion.div
            key={p.id}
            style={style}
            initial={{ y: -40, x: 0, rotate: 0, opacity: 0 }}
            animate={{
              y: typeof window !== 'undefined' ? window.innerHeight + 60 : 900,
              x: p.drift,
              rotate: p.rotate,
              opacity: [0, 1, 1, 0.9, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: [0.22, 0.61, 0.36, 1],
              times: [0, 0.1, 0.7, 0.9, 1],
            }}
          />
        );
      })}
    </div>
  );
}

/* ─────────── color utils ─────────── */

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function shade(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex).split(',').map(Number);
  const adj = (c: number) => {
    const v = Math.round(c + (percent / 100) * 255);
    return Math.max(0, Math.min(255, v));
  };
  return `#${[adj(r), adj(g), adj(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

/* ─────────── tiny HTML syntax highlight ─────────── */

function colorizeHtml(line: string, accent: string): React.ReactNode {
  // tokenize simple: <tag>, attr=, "value", others
  const parts: Array<{ text: string; color: string }> = [];
  const regex = /(<\/?[\w-]+)|([\w-]+)(?==)|("[^"]*")|(=)|([^<>="]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    if (m[1]) parts.push({ text: m[1], color: C.purpleHi });
    else if (m[2]) parts.push({ text: m[2], color: accent });
    else if (m[3]) parts.push({ text: m[3], color: '#86EFAC' });
    else if (m[4]) parts.push({ text: m[4], color: 'rgba(255,255,255,0.5)' });
    else if (m[5]) parts.push({ text: m[5], color: 'rgba(255,255,255,0.85)' });
  }
  if (parts.length === 0) return <span>{line}</span>;
  return parts.map((p, i) => (
    <span key={i} style={{ color: p.color }}>
      {p.text}
    </span>
  ));
}
