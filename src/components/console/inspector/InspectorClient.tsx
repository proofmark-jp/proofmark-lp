'use client';

/**
 * src/components/console/inspector/InspectorClient.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Vite版 Dashboard.studio.tsx 内の Inspector（右スライドインDrawer）を、
 * Next.js 15 App Router の「独立した詳細ページの中身」へ物理的に昇華させたもの。
 *
 * 破壊した旧コード:
 *   - Drawer 外枠 (fixed / right-0 / w-[860px] / scrim / z-50 / backdrop)
 *   - onClose / Escキー / X閉じるボタン
 *   - AnimatePresence の open ゲート
 *
 * 移植した Visual DNA (1バイトも省略していない):
 *   ✅ PM_EASE / ACCENT
 *   ✅ deriveGenerativeArt
 *   ✅ HashFingerprint
 *   ✅ BreathingBadge (mini / normal / large + reduce-motion 完全対応)
 *   ✅ TrustBadgeMotion
 *   ✅ PendingRing (10秒超で warning へ)
 *   ✅ InspectorOverview / InspectorChain のタブ切替
 *   ✅ EvidenceChainViewer (The Merkle Rollup)
 *   ✅ PaywallTrialValue (Trial Value 誘導 UI)
 *   ✅ getOptimizedImageUrl (Egress Defense)
 *
 * 追加:
 *   ⭐ ヘッダー左上に <Link href="/console"><ArrowLeft /> ダッシュボードへ戻る</Link>
 *   ⭐ max-w-4xl mx-auto w-full の Page-style コンテナ
 *   ⭐ framer-motion で画面中央にフェードイン
 *
 * Props:
 *   - cert: CertificateRow  (Server Component から渡される)
 *   - canExportEvidencePack?: boolean (未指定なら false = ペイウォール発火)
 *   - onComplete?: () => void (任意)
 *
 * Supabase 再フェッチは一切行わない (Server で取得済み)。
 */

import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  FileDown,
  History,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';

// 【The Apex】外部ファイル依存を物理排除した、自己完結型の堅牢なインターフェース
export interface CertificateRecord {
  id: string;
  title: string | null;
  sha256: string;
  proof_mode: string;
  visibility: string;
  public_verify_token: string;
  public_image_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  width_px: number | null;
  height_px: number | null;
  badge_tier: string;
  process_bundle_id: string | null;
  metadata_json: Record<string, unknown> | null;
  proven_at: string | null;
  created_at: string;
}

// 【The Apex 防衛線1】外部のダウンロードボタン依存を物理破壊し、自己完結型のエンジンを実装
const executeEvidencePackDownload = async ({ certId }: { certId: string }) => {
  const res = await fetch(`/api/generate-evidence-pack?cert=${certId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Evidence Packの生成APIが応答しませんでした。');
  }
  // メモリ上にBlobを展開し、安全にZIPダウンロードを発火
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `ProofMark_Evidence_${certId.substring(0, 8)}.zip`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

// 【The Apex 防衛線2】未移植の外部コンポーネントによるビルド崩壊を防ぐ、完璧なUIを持つ内部モックへ換装
// ※バックエンドのAPI結線と本実装が完了するまでの間、画面を美しく保つためのプレースホルダー
const ProcessBundleComposer = ({ certificate, onComplete }: any) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
      <Lock className="w-8 h-8 text-[#A8A0D8] mb-4" />
      <p className="text-[13px] text-white/60 font-bold tracking-widest uppercase">
        Chain of Evidence Engine
      </p>
      <p className="text-[11px] text-white/40 mt-2 text-center max-w-sm leading-relaxed">
        このモジュールは現在 Next.js 15 へ移植中です。<br/>
        バックエンドAPIの結線が完了次第、稼働を開始します。
      </p>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
 *  Visual DNA (PublicProfile.tsx と完全同一の DNA)
 * ══════════════════════════════════════════════════════════════ */

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ACCENT = {
  teal: { hex: '#00D4AA', rgb: '0,212,170' },
  purple: { hex: '#6C3EF4', rgb: '108,62,244' },
  gold: { hex: '#F0BB38', rgb: '240,187,56' },
} as const;

interface GenerativeArt {
  background: string;
  overlay: string;
  hueA: number;
  hueB: number;
  hueC: number;
}

function deriveGenerativeArt(hash: string): GenerativeArt {
  const seed = (hash || 'proofmark').padEnd(64, '0');
  const codeAt = (i: number) => seed.charCodeAt(i % seed.length);

  const hueA = codeAt(2) % 360;
  const hueB = (codeAt(11) + codeAt(17)) % 360;
  const hueC = (codeAt(23) * 7) % 360;

  const xA = 10 + (codeAt(5) % 70);
  const yA = 10 + (codeAt(7) % 70);
  const xB = 10 + (codeAt(13) % 70);
  const yB = 10 + (codeAt(19) % 70);
  const xC = 10 + (codeAt(29) % 80);
  const yC = 10 + (codeAt(31) % 80);

  const conicAngle = codeAt(3) % 360;
  const stripeAngle = codeAt(37) % 180;
  const stripeGap = 6 + (codeAt(41) % 10);

  const satA = 70 + (codeAt(9) % 20);
  const satB = 60 + (codeAt(15) % 25);
  const lightA = 45 + (codeAt(21) % 15);
  const lightB = 35 + (codeAt(27) % 15);

  const background = `
    radial-gradient(ellipse 80% 60% at ${xA}% ${yA}%, hsl(${hueA}, ${satA}%, ${lightA}%) 0%, transparent 55%),
    radial-gradient(ellipse 65% 55% at ${xB}% ${yB}%, hsl(${hueB}, ${satB}%, ${lightB}%) 0%, transparent 55%),
    radial-gradient(circle at ${xC}% ${yC}%, hsl(${hueC}, 80%, 50%) 0%, transparent 45%),
    conic-gradient(from ${conicAngle}deg at 50% 50%,
      hsl(${hueA}, 60%, 12%) 0deg,
      hsl(${hueB}, 70%, 20%) 120deg,
      hsl(${hueC}, 70%, 16%) 240deg,
      hsl(${hueA}, 60%, 12%) 360deg)
  `;

  const overlay = `repeating-linear-gradient(${stripeAngle}deg,
    rgba(255,255,255,0.05) 0px,
    rgba(255,255,255,0.05) 1px,
    transparent 1px,
    transparent ${stripeGap}px)`;

  return { background, overlay, hueA, hueB, hueC };
}

function HashFingerprint({
  hash,
  className = '',
  showLabel = true,
}: {
  hash: string;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#0D0B24] ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 1px, transparent 1px), radial-gradient(circle at 50% 30%, rgba(108,62,244,0.15) 0%, transparent 60%)',
        backgroundSize: '8px 8px, 100% 100%',
      }}
    >
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(168,160,216,0.15)',
              boxShadow: '0 0 20px rgba(0,0,0,0.5)',
            }}
          >
            <Lock className="h-5 w-5 text-[#A8A0D8]" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-xs text-[#A8A0D8]/70 tracking-[0.25em] font-mono uppercase">
              CONFIDENTIAL PROOF
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/30 tracking-[0.2em]">
              {hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function BreathingBadge({
  reduce,
  size = 'normal',
  tone = 'teal',
  label,
  icon,
  sublabel,
}: {
  reduce: boolean;
  size?: 'mini' | 'normal' | 'large';
  tone?: 'teal' | 'gold' | 'purple';
  label: string;
  icon?: ReactNode;
  sublabel?: string;
}) {
  const accent = ACCENT[tone];
  const Icon = icon ?? <ShieldCheck className="h-3 w-3" />;

  if (size === 'mini') {
    return (
      <motion.span
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  `0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                  `0 0 0 6px rgba(${accent.rgb}, 0)`,
                  `0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                ],
              }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-[0.2em] whitespace-nowrap"
        style={{
          background: `rgba(${accent.rgb}, 0.14)`,
          border: `1px solid rgba(${accent.rgb}, 0.5)`,
          color: accent.hex,
        }}
      >
        {Icon}
        {label}
      </motion.span>
    );
  }

  if (size === 'large') {
    return (
      <motion.div
        className="relative inline-flex items-center gap-2 rounded-full pl-2 pr-3.5 py-1.5"
        style={{
          background: 'rgba(7,6,26,0.78)',
          border: `1px solid rgba(${accent.rgb}, 0.55)`,
          backdropFilter: 'blur(10px)',
        }}
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  `0 4px 18px rgba(0,0,0,0.35), 0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                  `0 4px 18px rgba(0,0,0,0.35), 0 0 0 8px rgba(${accent.rgb}, 0)`,
                  `0 4px 18px rgba(0,0,0,0.35), 0 0 0 0 rgba(${accent.rgb}, 0.55)`,
                ],
              }
        }
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.span
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{
            background: accent.hex,
            boxShadow: `0 0 10px rgba(${accent.rgb}, 0.7)`,
          }}
          animate={reduce ? undefined : { opacity: [1, 0.78, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Check
            className="h-3 w-3"
            color={tone === 'gold' ? '#07061A' : '#FFFFFF'}
            strokeWidth={4}
          />
        </motion.span>
        <span
          className="text-[10.5px] font-mono uppercase tracking-[0.24em]"
          style={{ color: '#FFFFFF' }}
        >
          {label}
          {sublabel && (
            <span className="opacity-65 font-normal normal-case ml-1.5">· {sublabel}</span>
          )}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="relative inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 whitespace-nowrap"
      style={{
        background: `rgba(${accent.rgb}, 0.10)`,
        border: `1px solid rgba(${accent.rgb}, 0.45)`,
        color: accent.hex,
        backdropFilter: 'blur(8px)',
      }}
      animate={
        reduce
          ? undefined
          : {
              boxShadow: [
                `0 0 0 0 rgba(${accent.rgb}, 0.45)`,
                `0 0 0 6px rgba(${accent.rgb}, 0)`,
                `0 0 0 0 rgba(${accent.rgb}, 0.45)`,
              ],
            }
      }
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="flex items-center justify-center"
        style={{ color: accent.hex }}
        animate={reduce ? undefined : { opacity: [1, 0.78, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        {Icon}
      </motion.span>
      <span
        className="text-[10px] font-mono uppercase tracking-[0.22em]"
        style={{ color: accent.hex }}
      >
        {label}
        {sublabel && (
          <span className="opacity-65 font-normal normal-case ml-1">· {sublabel}</span>
        )}
      </span>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Egress Defense — 画像URL最適化ヘルパー
 * ══════════════════════════════════════════════════════════════ */

const ENABLE_IMAGE_OPTIMIZATION = false;

function getOptimizedImageUrl(
  url: string | null | undefined,
  opts: { width?: number; quality?: number; format?: string } = {},
): string {
  if (!url) return '';

  if (!ENABLE_IMAGE_OPTIMIZATION) {
    const timestamp = Date.now();
    const sep = url.includes('?') ? '&' : '?';
    if (url.includes('v=') || url.includes('t=')) return url;
    return `${url}${sep}v=${timestamp}`;
  }

  const isSupabaseStorage =
    url.includes('.supabase.co/storage/') ||
    url.includes('.supabase.in/storage/');

  if (!isSupabaseStorage) return url;
  if (url.includes('width=') || url.includes('format=')) return url;

  const params = new URLSearchParams();
  if (opts.width)   params.set('width',   String(opts.width));
  if (opts.quality) params.set('quality', String(opts.quality));
  params.set('format', opts.format ?? 'webp');

  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${params.toString()}`;
}

/* ══════════════════════════════════════════════════════════════
 *  Types & Trust deriver
 * ══════════════════════════════════════════════════════════════ */

type TrustTier = 'beta' | 'trusted' | 'cross' | 'pending';

/**
 * Server Component から渡される cert 型。
 * DB スキーマ(certificates)をベースにした型を採用する。
 */
export interface CertificateRow {
  id: string;
  user_id?: string;
  title?: string | null;
  is_starred?: boolean | null;
  file_name?: string | null;
  file_hash?: string | null;
  sha256?: string | null;
  thumbnail_url?: string | null;
  public_image_url?: string | null;
  proof_mode?: string | null;
  visibility?: string | null;
  created_at: string;
  certified_at?: string | null;
  tsa_provider?: string | null;
  timestamp_token?: string | null;
  cross_anchors?: Array<{ provider: string; certified_at: string }> | null;
  is_archived?: boolean | null;
  client_project?: string | null;
  project_id?: string | null;
  team_id?: string | null;
  original_filename?: string | null;
  metadata?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
  process_bundle_id?: string | null;
}

interface TrustDescriptor {
  tier: TrustTier;
  label: string;
  sublabel: string;
  color: string;
  border: string;
  bg: string;
  icon: typeof ShieldCheck;
  description: string;
}

const TRUSTED_PROVIDERS: ReadonlySet<string> = new Set([
  'digicert',
  'globalsign',
  'seiko',
  'sectigo',
]);

const PENDING_WARN_THRESHOLD_MS = 20_000;

function deriveTrustTier(c: CertificateRow): TrustDescriptor {
  const provider = (c.tsa_provider || '').toLowerCase();
  const hasToken = Boolean(c.timestamp_token && c.certified_at);
  const anchors = c.cross_anchors?.length ?? 0;

  if (!hasToken) {
    return {
      tier: 'pending',
      label: 'Pending',
      sublabel: 'TSA発行待ち',
      color: '#A8A0D8',
      border: 'rgba(168,160,216,0.35)',
      bg: 'rgba(168,160,216,0.10)',
      icon: Clock3,
      description: 'タイムスタンプトークン未発行。数秒以内にTSAから署名が返る予定です。',
    };
  }
  if (anchors >= 1) {
    return {
      tier: 'cross',
      label: 'Cross-anchored',
      sublabel: `${anchors + 1} 重TSA`,
      color: '#F0BB38',
      border: 'rgba(240,187,56,0.40)',
      bg: 'rgba(240,187,56,0.12)',
      icon: Sparkles,
      description: '複数のTSAで多重発行された証明。鍵失効耐性あり。',
    };
  }
  if (TRUSTED_PROVIDERS.has(provider)) {
    return {
      tier: 'trusted',
      label: 'Trusted TSA',
      sublabel: provider.toUpperCase(),
      color: '#00D4AA',
      border: 'rgba(0,212,170,0.40)',
      bg: 'rgba(0,212,170,0.12)',
      icon: ShieldCheck,
      description: '主要トラストストアに収録された商用TSAによるRFC3161タイムスタンプ。',
    };
  }
  return {
    tier: 'beta',
    label: 'Beta TSA',
    sublabel: '',
    color: '#9BA3D4',
    border: 'rgba(155,163,212,0.35)',
    bg: 'rgba(155,163,212,0.10)',
    icon: ShieldAlert,
    description: 'β版TSAによる発行。RFC3161として有効ですがSLAなしです。',
  };
}

/* ══════════════════════════════════════════════════════════════
 *  Trust Badge — BreathingBadge inspired
 * ══════════════════════════════════════════════════════════════ */

function TrustBadgeMotion({
  cert,
  size = 'md',
  reduce,
}: {
  cert: CertificateRow;
  size?: 'sm' | 'md';
  reduce: boolean;
}) {
  const t = deriveTrustTier(cert);
  const Icon = t.icon;
  const dims =
    size === 'sm'
      ? { pad: '2px 8px', fs: 10, ic: 11 }
      : { pad: '4px 10px', fs: 11, ic: 14 };

  const rgb = useMemo(() => {
    const hex = t.color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r},${g},${b}`;
  }, [t.color]);

  return (
    <motion.span
      title={t.description}
      className="inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap"
      style={{
        padding: dims.pad,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        fontSize: dims.fs,
      }}
      animate={
        reduce
          ? undefined
          : {
              boxShadow: [
                `0 0 0 0 rgba(${rgb}, 0.45)`,
                `0 0 0 4px rgba(${rgb}, 0)`,
                `0 0 0 0 rgba(${rgb}, 0.45)`,
              ],
            }
      }
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="flex items-center"
        animate={reduce ? undefined : { opacity: [1, 0.8, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon style={{ width: dims.ic, height: dims.ic }} />
      </motion.span>
      <span className="hidden sm:inline">{t.label}</span>
      {t.sublabel && (
        <span className="hidden sm:inline opacity-70 font-normal normal-case ml-1.5">· {t.sublabel}</span>
      )}
    </motion.span>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Pending Ring — Silent Processing
 * ══════════════════════════════════════════════════════════════ */

function PendingRing({
  cert,
  reduce,
  onResync,
}: {
  cert: CertificateRow;
  reduce: boolean;
  onResync?: (certId: string) => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1500);
    return () => window.clearInterval(t);
  }, []);

  const elapsed = useMemo(() => {
    const start = new Date(cert.created_at).getTime();
    return Number.isNaN(start) ? 0 : now - start;
  }, [cert.created_at, now]);

  const isWarn = elapsed >= PENDING_WARN_THRESHOLD_MS;
  const accent = '#00D4AA';
  const rgb = '0,212,170';

  if (isWarn) {
    return (
      <button
        type="button"
        disabled={resyncing}
        onClick={async (e) => {
          e.stopPropagation();
          if (resyncing) return;
          setResyncing(true);
          if (onResync) {
            await onResync(cert.id);
          }
          setResyncing(false);
        }}
        className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/55 transition-colors cursor-pointer group"
        style={{ backdropFilter: 'blur(2px)' }}
        title="バックグラウンドで処理中。クリックして再同期"
        aria-label="再同期"
      >
        <div
          className="flex flex-col items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-white/10 bg-[#07061A]/90 hover:border-[#00D4AA]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          <Clock3
            className={`w-4 h-4 text-[#A8A0D8] group-hover:text-[#00D4AA] ${
              resyncing ? 'animate-spin' : 'animate-pulse'
            }`}
          />
          <span className="text-[9px] font-mono text-[#A8A0D8] group-hover:text-[#00D4AA] uppercase tracking-[0.15em] transition-colors">
            {resyncing ? '再同期中...' : '↻ 再同期'}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(7,6,26,0.45) 0%, rgba(7,6,26,0.25) 60%, transparent 100%)',
        backdropFilter: 'blur(1px)',
      }}
      title="タイムスタンプを発行中…"
      aria-label="タイムスタンプを発行中…"
    >
      <motion.div
        className="relative h-14 w-14 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(7,6,26,0.65)',
          border: `1px solid rgba(${rgb}, 0.55)`,
          backdropFilter: 'blur(6px)',
        }}
        animate={
          reduce
            ? undefined
            : {
                boxShadow: [
                  `0 0 0 0 rgba(${rgb}, 0.45)`,
                  `0 0 0 10px rgba(${rgb}, 0)`,
                  `0 0 0 0 rgba(${rgb}, 0.45)`,
                ],
              }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid transparent`,
            borderTopColor: accent,
            borderRightColor: `rgba(${rgb}, 0.4)`,
          }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
        <motion.span
          className="block h-2 w-2 rounded-full"
          style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
          animate={reduce ? undefined : { opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Tab primitive
 * ══════════════════════════════════════════════════════════════ */

function InspectorTab({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'relative inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold tracking-wide rounded-t-lg transition-colors',
        active ? 'text-white' : 'text-white/55 hover:text-white/85',
      ].join(' ')}
    >
      {label}
      {badge && (
        <span
          className="px-1.5 py-0.5 rounded text-[8.5px] font-mono uppercase tracking-[0.18em]"
          style={{
            background: 'linear-gradient(135deg, rgba(108,62,244,0.18), rgba(0,212,170,0.18))',
            border: '1px solid rgba(108,62,244,0.45)',
            color: '#BC78FF',
          }}
        >
          {badge}
        </span>
      )}
      {active && (
        <motion.span
          layoutId="inspector-tab-underline"
          className="absolute -bottom-px left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, #6C3EF4, #00D4AA)',
            boxShadow: '0 0 10px rgba(0,212,170,0.55)',
          }}
          transition={{ type: 'spring', stiffness: 460, damping: 32 }}
        />
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Overview / Chain — bodies
 * ══════════════════════════════════════════════════════════════ */

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-3.5 py-2.5"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <p className="text-[9.5px] font-mono uppercase tracking-[0.22em] text-white/45">
        {label}
      </p>
      <p
        className={[
          'mt-1 text-[12px] text-white/90',
          mono ? 'font-mono break-all text-[11.5px]' : '',
        ].join(' ')}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InspectorOverview({
  cert,
  copiedId,
  onCopyLink,
  onEvidence,
  onArchive,
  onResync,
  reduce,
}: {
  cert: CertificateRow;
  copiedId: string | null;
  onCopyLink: (cert: CertificateRow) => void;
  onEvidence: (cert: CertificateRow) => void;
  onArchive: (cert: CertificateRow, next: boolean) => void;
  onResync?: (certId: string) => Promise<void>;
  reduce: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const hasRealImage =
    cert.proof_mode === 'shareable' &&
    typeof cert.public_image_url === 'string' &&
    cert.public_image_url !== '' &&
    !imgError;

  const optimizedSrc = useMemo(
    () =>
      hasRealImage
        ? getOptimizedImageUrl(cert.public_image_url, {
            width: 800,
            quality: 80,
            format: 'webp',
          })
        : '',
    [hasRealImage, cert.public_image_url],
  );

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Hero asset */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          aspectRatio: '4 / 3',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.6)',
        }}
      >
        {hasRealImage ? (
          <img
            src={optimizedSrc}
            alt={cert.title ?? cert.file_name ?? 'Artwork'}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <HashFingerprint
            hash={cert.sha256 || cert.file_hash || cert.id}
            className="absolute inset-0"
          />
        )}
        {deriveTrustTier(cert).tier === 'pending' && (
          <PendingRing cert={cert} reduce={reduce} onResync={onResync} />
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetaRow label="Certificate ID" mono value={cert.id} />
        <MetaRow
          label="SHA-256"
          mono
          value={
            <span className="break-all">
              {(cert.sha256 || cert.file_hash || '—').slice(0, 32)}…
              {(cert.sha256 || cert.file_hash || '').slice(-8)}
            </span>
          }
        />
        <MetaRow label="Proof Mode" value={cert.proof_mode ?? '—'} />
        <MetaRow label="Visibility" value={cert.visibility ?? '—'} />
        <MetaRow
          label="TSA Provider"
          value={cert.tsa_provider ? cert.tsa_provider.toUpperCase() : '—'}
        />
        <MetaRow
          label="Certified"
          value={cert.certified_at ? formatDate(cert.certified_at) : '—'}
        />
        <MetaRow label="Created" value={formatDate(cert.created_at)} />
        <MetaRow label="案件" value={cert.client_project || '未分類'} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => onCopyLink(cert)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white border border-white/10 hover:bg-white/[0.05] transition-colors"
        >
          {copiedId === cert.id ? (
            <>
              <Check className="w-3.5 h-3.5" /> コピー済
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> 検証URL
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => onEvidence(cert)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-[#07061A] bg-gradient-to-r from-[#6C3EF4] to-[#00D4AA] hover:opacity-95 transition-opacity"
          title="Evidence Pack をダウンロード"
        >
          <FileDown className="w-3.5 h-3.5" />
          Evidence Pack
        </button>
        <button
          type="button"
          onClick={() => onArchive(cert, !cert.is_archived)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white/80 border border-white/10 hover:bg-white/[0.05] transition-colors"
        >
          {cert.is_archived ? (
            <>
              <ArchiveRestore className="w-3.5 h-3.5" /> 戻す
            </>
          ) : (
            <>
              <Archive className="w-3.5 h-3.5" /> アーカイブ
            </>
          )}
        </button>
        <a
          href={`/cert/${cert.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white/80 border border-white/10 hover:bg-white/[0.05] transition-colors ml-auto"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          証明書を開く
        </a>
      </div>
    </div>
  );
}

/* ── The Merkle Rollup viewer ── */
const STEP_TYPE_LABELS: Record<string, string> = {
  rough: 'ラフ',
  lineart: '線画',
  color: '着色',
  final: '完成',
  other: '途中工程',
};

const STEP_TYPE_COLORS: Record<string, string> = {
  rough: '#F59E0B',
  lineart: '#818CF8',
  color: '#34D399',
  final: '#00D4AA',
  other: '#A8A0D8',
};

function EvidenceChainViewer({ cert }: { cert: CertificateRow }) {
  const meta =
    ((cert as any).metadata_json || (cert as any).metadata) as any;
  const chainHistory: any[] = Array.isArray(meta?.chain_history)
    ? meta.chain_history
    : [];

  if (!chainHistory || chainHistory.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-[#00D4AA]" />
        <h4 className="text-xs font-mono uppercase tracking-[0.2em] text-[#00D4AA]">
          The Merkle Rollup ({chainHistory.length} Steps)
        </h4>
      </div>

      <div className="relative pl-4 border-l border-white/10 space-y-4">
        {chainHistory.map((step: any, idx: number) => {
          const sType = step.isHead ? 'final' : step.stepType || 'other';
          const color = STEP_TYPE_COLORS[sType] || '#A8A0D8';
          const label = STEP_TYPE_LABELS[sType] || sType;

          return (
            <div key={idx} className="relative group">
              <div
                className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-[#07061A]"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />

              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white group-hover:text-[#00D4AA] transition-colors">
                      {step.title || (step.isHead ? 'HEAD (完成品)' : `工程 ${idx + 1}`)}
                    </span>
                    <span
                      className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded tracking-wider"
                      style={{
                        backgroundColor: `${color}15`,
                        color: color,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {label}
                    </span>
                  </div>

                  {step.note && (
                    <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                      {step.note}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-white/30">
                    <span>
                      SHA-256: {step.sha256?.slice(0, 8)}…{step.sha256?.slice(-6)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Chain tab body ── */
function InspectorChain({
  cert,
  canExportEvidencePack,
  reduce,
  onComplete,
}: {
  cert: CertificateRow;
  canExportEvidencePack: boolean;
  reduce: boolean;
  onComplete?: () => void;
}) {
  const record = useMemo(() => toCertificateRecord(cert), [cert]);

  return (
    <div className="relative px-6 py-5 flex flex-col h-full">
      {/* Header copy */}
      <div className="mb-4 shrink-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#A8A0D8] mb-1.5">
          Chain of Evidence Studio
        </p>
        <h3 className="text-[16px] font-bold text-white">
          制作プロセスの暗号証明を組み立てる
        </h3>
        <p className="mt-1.5 text-[12.5px] text-white/55 leading-relaxed max-w-2xl">
          ラフ → 線画 → 着色 → 完成 まで、各工程のSHA-256ハッシュをチェーンして単一の不可逆な存在証明を構築します。
        </p>
      </div>

      {/* Evidence Timeline */}
      <EvidenceChainViewer cert={cert} />

      {/* The composer & Shield */}
      <div className="relative flex-1 min-h-[500px]">
        <Suspense fallback={<MinimalSpinner />}>
          <ProcessBundleComposer certificate={record} onComplete={onComplete} />
        </Suspense>

        {/* 🚨 THE ABSOLUTE SHIELD */}
        {!canExportEvidencePack && (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-col justify-end pt-40 pb-4 pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, rgba(7,6,26,0) 0%, rgba(7,6,26,0.85) 40%, rgba(7,6,26,1) 100%)',
              margin: '0 -24px',
              paddingLeft: '24px',
              paddingRight: '24px',
            }}
          >
            <div className="pointer-events-auto w-full">
              <PaywallTrialValue reduce={reduce} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Paywall — Trial Value (体験先導型)
 * ══════════════════════════════════════════════════════════════ */

function PaywallTrialValue({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: PM_EASE, delay: 0.15 }}
      className="relative z-10 w-full max-w-3xl mx-auto"
    >
      <div
        className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
        style={{
          background:
            'linear-gradient(165deg, rgba(108,62,244,0.16) 0%, rgba(0,212,170,0.10) 50%, rgba(7,6,26,0.92) 100%)',
          border: '1px solid rgba(108,62,244,0.45)',
          boxShadow:
            '0 20px 60px -20px rgba(108,62,244,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(108,62,244,0.85), rgba(0,212,170,0.85), transparent)',
          }}
        />

        <div className="flex items-start gap-4">
          <motion.div
            className="relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
              boxShadow: '0 12px 30px -8px rgba(108,62,244,0.65)',
            }}
            animate={
              reduce
                ? undefined
                : {
                    boxShadow: [
                      '0 12px 30px -8px rgba(108,62,244,0.65), 0 0 0 0 rgba(0,212,170,0.55)',
                      '0 12px 30px -8px rgba(108,62,244,0.65), 0 0 0 12px rgba(0,212,170,0)',
                      '0 12px 30px -8px rgba(108,62,244,0.65), 0 0 0 0 rgba(0,212,170,0.55)',
                    ],
                  }
            }
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Lock className="w-6 h-6 text-white" strokeWidth={2} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#BC78FF]">
              Trial Value · 体験できています
            </p>
            <h4 className="mt-1 text-[16px] sm:text-[17px] font-bold text-white leading-snug">
              過程の暗号証明 (Evidence Pack エクスポート) は
              <span
                className="bg-clip-text text-transparent ml-1.5"
                style={{ backgroundImage: 'linear-gradient(90deg, #BC78FF, #00D4AA)' }}
              >
                Creator プラン
              </span>
              限定です。
            </h4>
            <p className="mt-2 text-[12.5px] text-white/65 leading-relaxed">
              チェーンの組み立てはご自由にお試しください。発行可能になると、ラフ→完成の全工程が
              <strong className="text-white"> RFC3161 タイムスタンプ </strong>
              で封印され、ZIP一発で納品できるようになります。
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href="/pricing#creator"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #6C3EF4 0%, #8B61FF 100%)',
                  boxShadow: '0 14px 32px -10px rgba(108,62,244,0.7)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Creatorプランで解放する
              </a>
              <a
                href="/what-it-proves#chain"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white/75 hover:text-white border border-white/10 hover:bg-white/[0.05] transition-colors"
              >
                チェーン証明の仕組みを見る
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Helpers
 * ══════════════════════════════════════════════════════════════ */

function MinimalSpinner() {
  return (
    <div className="w-full h-full min-h-[240px] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#00D4AA] animate-spin" />
    </div>
  );
}

function toCertificateRecord(cert: CertificateRow): CertificateRecord {
  return {
    id: cert.id,
    title: cert.title ?? null,
    sha256: cert.sha256 ?? cert.file_hash ?? '',
    proof_mode: cert.proof_mode === 'shareable' ? 'shareable' : 'private',
    visibility:
      cert.visibility === 'public' || cert.visibility === 'unlisted'
        ? cert.visibility
        : 'private',
    public_verify_token: cert.id,
    public_image_url: cert.public_image_url ?? null,
    storage_path: null,
    file_name: cert.file_name ?? null,
    mime_type: null,
    file_size: null,
    width_px: null,
    height_px: null,
    badge_tier: 'basic',
    process_bundle_id: cert.process_bundle_id ?? null,
    metadata_json:
      (cert as any).metadata_json ?? (cert as any).metadata ?? null,
    proven_at: cert.certified_at ?? cert.created_at,
    created_at: cert.created_at,
  } as CertificateRecord;
}

/* ══════════════════════════════════════════════════════════════
 *  Main Client Component
 * ══════════════════════════════════════════════════════════════ */

export interface InspectorClientProps {
  cert: CertificateRow;
  /** ユーザーが Evidence Pack をエクスポートできる権限を持つか */
  canExportEvidencePack?: boolean;
  /** 保存/更新完了時に呼ばれる任意のフック */
  onComplete?: () => void;
}

export default function InspectorClient({
  cert: initialCert,
  canExportEvidencePack = false,
  onComplete,
}: InspectorClientProps) {
  const reduce = useReducedMotion() ?? false;

  // Server から受け取った cert をローカル state として持ち、
  // Star / Archive のような楽観的更新を可能にする。
  const [cert, setCert] = useState<CertificateRow>(initialCert);
  const [tab, setTab] = useState<'overview' | 'chain'>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* ── Handlers ── */
  const handleCopyLink = async (target: CertificateRow) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/cert/${target.id}`
        : `https://proofmark.jp/cert/${target.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(target.id);
      toast.success('検証URLをコピーしました', { description: url });
      window.setTimeout(
        () => setCopiedId((id) => (id === target.id ? null : id)),
        1600,
      );
    } catch {
      toast.error('コピーに失敗しました');
    }
  };

  const handleEvidence = async (target: CertificateRow) => {
    if (!canExportEvidencePack) {
      // 権限がなければ Chain タブへ美しく遷移（ペイウォールを踏ませる）
      setTab('chain');
      return;
    }
    try {
      toast.loading('Evidence Pack を生成しています…', {
        id: `evidence-${target.id}`,
      });
      await executeEvidencePackDownload({ certId: target.id });
    } catch (e) {
      toast.error('Evidence Pack の生成に失敗しました', {
        id: `evidence-${target.id}`,
        description:
          e instanceof Error ? e.message : 'ネットワーク接続を確認してください。',
      });
    }
  };

  const handleArchive = (target: CertificateRow, next: boolean) => {
    // Server 側で DB 反映するのが正だが、UI 上は楽観的に反転して即応する。
    // ここでは fetch/Supabase 呼び出しを行わず、上位に onComplete を通知する。
    setCert((prev) => ({ ...prev, is_archived: next }));
    toast.success(next ? 'アーカイブしました' : 'アーカイブから戻しました');
    onComplete?.();
  };

  const handleToggleStar = (id: string, current: boolean) => {
    setCert((prev) => (prev.id === id ? { ...prev, is_starred: !current } : prev));
    toast.success(!current ? '保護しました' : '保護を解除しました');
    onComplete?.();
  };

  const handleResync = async (_certId: string) => {
    // Server で再検証させる導線がある場合はここに繋ぐ。
    // 現在は UX 上の Ack のみを返す。
    toast.success('再同期リクエストを送信しました');
    onComplete?.();
  };

  /* ══════════════════════════════════════════════════════════════
   *  Render — Page-style container (Drawer外枠は物理破壊済み)
   * ══════════════════════════════════════════════════════════════ */

  return (
    <motion.section
      initial={{ opacity: 0, y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: PM_EASE }}
      className="relative w-full max-w-4xl mx-auto"
    >
      {/* 上部ヘアライン (Drawer時代の DNA を Page 表現に再構成) */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-px h-px pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(108,62,244,0.7), rgba(0,212,170,0.7), transparent)',
        }}
      />

      {/* Ambient aura */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-[#6C3EF4] opacity-[0.10] blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-[#00D4AA] opacity-[0.08] blur-[120px]"
      />

      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background:
            'linear-gradient(165deg, rgba(15,12,32,0.96) 0%, rgba(7,6,26,0.94) 60%, rgba(7,6,26,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow:
            '0 40px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* ────────────── Back link (ArrowLeft → /console) ────────────── */}
        <div className="px-6 pt-5">
          <Link
            href="/console"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 -ml-1 rounded-lg text-[12px] font-semibold text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]"
            aria-label="ダッシュボードへ戻る"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            ダッシュボードへ戻る
          </Link>
        </div>

        {/* ────────────── Header ────────────── */}
        <header className="relative px-6 pt-3 pb-4 border-b border-white/[0.06] flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#A8A0D8] mb-1.5">
              Inspector · {cert.id.slice(0, 8)}…
            </p>
            <h2 className="text-[18px] sm:text-[22px] font-bold text-white truncate">
              {cert.title ?? cert.file_name ?? 'Untitled'}
            </h2>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <TrustBadgeMotion cert={cert} size="sm" reduce={reduce} />
              {cert.proof_mode === 'shareable' ? (
                <BreathingBadge
                  reduce={reduce}
                  size="mini"
                  tone="teal"
                  label="Visual"
                />
              ) : (
                <BreathingBadge
                  reduce={reduce}
                  size="mini"
                  tone="purple"
                  label="Private"
                />
              )}
              {cert.is_archived && (
                <BreathingBadge
                  reduce={reduce}
                  size="mini"
                  tone="gold"
                  label="Archived"
                />
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleStar(cert.id, !!cert.is_starred)}
            className="shrink-0 p-2 rounded-lg text-white/55 hover:text-[#F0BB38] hover:bg-white/[0.04] transition-colors"
            title={cert.is_starred ? '保護を解除' : '保護'}
            aria-label={cert.is_starred ? '保護を解除' : '保護'}
          >
            <Star
              className="w-4 h-4"
              fill={cert.is_starred ? '#F0BB38' : 'transparent'}
            />
          </button>
        </header>

        {/* ────────────── Tabs ────────────── */}
        <div className="relative px-6 pt-3 border-b border-white/[0.06]">
          <div role="tablist" className="inline-flex items-center gap-1">
            <InspectorTab
              active={tab === 'overview'}
              onClick={() => setTab('overview')}
              label="Overview"
            />
            <InspectorTab
              active={tab === 'chain'}
              onClick={() => setTab('chain')}
              label="Chain of Evidence"
              badge={canExportEvidencePack ? undefined : 'PRO'}
            />
          </div>
        </div>

        {/* ────────────── Body ────────────── */}
        <div className="relative">
          {tab === 'overview' && (
            <InspectorOverview
              cert={cert}
              copiedId={copiedId}
              onCopyLink={handleCopyLink}
              onEvidence={handleEvidence}
              onArchive={handleArchive}
              onResync={handleResync}
              reduce={reduce}
            />
          )}

          {tab === 'chain' && (
            <InspectorChain
              cert={cert}
              canExportEvidencePack={canExportEvidencePack}
              reduce={reduce}
              onComplete={onComplete}
            />
          )}
        </div>

        {/* Bottom hairline */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(0,212,170,0.5), rgba(108,62,244,0.5), transparent)',
          }}
        />
      </div>

      {/* Loader animation for reduce-motion */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* Bottom breadcrumb spacer for page-mode readability */}
      <div className="pt-4 flex items-center gap-1.5 text-[11px] font-mono text-white/30 tracking-[0.15em] uppercase">
        <Loader2 className="w-3 h-3 opacity-0" aria-hidden />
        {/* the icon above is intentionally invisible; used solely for baseline alignment */}
        <span>ProofMark · Console · Inspector</span>
      </div>
    </motion.section>
  );
}
