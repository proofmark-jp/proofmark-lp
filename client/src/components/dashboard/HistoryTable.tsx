/**
 * HistoryTable.tsx — The Obsidian Desk · Immutable History
 *
 * 仕様要件:
 *   - 表示項目: サムネイル(アイコン) / ファイル名 / 発行日時 / TxID(短縮) / ステータスバッジ
 *   - メリハリ: ファイル名+ステータスを目立たせる。TxID は等幅フォントで控えめに。
 *   - Skeleton Loading: レイアウトがガタつかない美しいスケルトン。
 *   - Empty State: 最初のアップロードを促す上品な空状態。
 *
 * データ取得は親側で行い、本コンポーネントは静的モック前提のプレゼン層に徹する
 *（フランケンシュタイン化禁止）。型は src/lib/types.ts の Certificate を採用。
 */

import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Clock3,
  ExternalLink,
  Hash,
  ArrowUpRight,
  FileImage,
  Sparkles,
  FileDown,
  FolderKanban,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Certificate, CertificateStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PM, EASE, D } from './obsidian-tokens';

/* ──────────────────────────────────────────────────────────────────────── */

interface HistoryTableProps {
  /** 表示対象の証明書一覧（親で取得済み） */
  certificates: Certificate[];
  /** データ取得中の場合 true。Skeleton を出す。 */
  loading?: boolean;
  /** 行クリック時のハンドラ。指定しなければ verification_url を新規タブで開く */
  onRowClick?: (cert: Certificate) => void;
  /** 1ページあたり最大表示件数（既定 10） */
  pageSize?: number;
  /** ユーザーの課金プラン (free, spot, creator, studio, business) */
  planTier: string;
  /** Evidence Pack 発行ハンドラ */
  onEvidence: (cert: Certificate) => void;
  /** プロジェクト割当ハンドラ */
  onAssignProject: (cert: Certificate) => void;
}

/* ──────────────────────────────────────────────────────────────────────── */

export function HistoryTable({
  certificates,
  loading = false,
  onRowClick,
  pageSize = 10,
  planTier,
  onEvidence,
  onAssignProject,
}: HistoryTableProps) {
  if (loading) return <HistorySkeleton rows={Math.min(5, pageSize)} />;
  if (certificates.length === 0) return <HistoryEmpty />;

  const rows = certificates.slice(0, pageSize);

  return (
    <section
      aria-label="発行済み証明書"
      className="w-full"
    >
      <Header />

      <ul
        role="list"
        className="rounded-2xl overflow-hidden"
        style={{
          background: PM.surface,
          border: `1px solid ${PM.border}`,
        }}
      >
        {rows.map((cert, i) => (
          <HistoryRow
            key={cert.id}
            cert={cert}
            isLast={i === rows.length - 1}
            planTier={planTier}
            onEvidence={onEvidence}
            onAssignProject={onAssignProject}
            onClick={() => {
              if (onRowClick) onRowClick(cert);
            }}
          />
        ))}
      </ul>

      {certificates.length > pageSize && (
        <p
          className="mt-3 text-center text-[11px] tracking-widest uppercase"
          style={{ color: PM.textSubtle }}
        >
          {certificates.length - pageSize} 件 さらに保存されています
        </p>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Header() {
  return (
    <div
      className="hidden sm:grid grid-cols-[40px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-4 px-5 py-3 mb-2 text-[10px] uppercase tracking-[0.18em]"
      style={{ color: PM.textSubtle }}
    >
      <span aria-hidden="true" />
      <span>ファイル / ステータス</span>
      <span>発行日時</span>
      <span>TxID</span>
      <span className="text-right pr-1">操作</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function HistoryRow({
  cert,
  isLast,
  planTier,
  onEvidence,
  onAssignProject,
  onClick,
}: {
  cert: Certificate;
  isLast: boolean;
  planTier: string;
  onEvidence: (cert: Certificate) => void;
  onAssignProject: (cert: Certificate) => void;
  onClick: () => void;
}) {
  const statusBadge = badgeFor(cert.status);

  return (
    <li
      role="listitem"
      style={{
        borderBottom: isLast ? 'none' : `1px solid ${PM.border}`,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: D.base / 1000, ease: EASE }}
        whileHover={{ background: PM.surfaceHover }}
        className={cn(
          'group w-full text-left',
          'grid grid-cols-[40px_minmax(0,1fr)_auto] sm:grid-cols-[40px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]',
          'items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5',
          'transition-colors',
          'focus:outline-none focus-visible:ring-2',
        )}
        style={{
          color: PM.textMain,
        }}
      >
        {/* Thumbnail (icon-only。仕様: 控えめに) */}
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: PM.surface,
            border: `1px solid ${PM.border}`,
            color: PM.textMuted,
          }}
        >
          <FileImage className="w-4 h-4" />
        </span>

        {/* File name + status */}
        <div className="min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (cert.verification_url) {
                window.open(cert.verification_url, '_blank', 'noopener,noreferrer');
              }
            }}
            className="truncate font-semibold text-[14px] sm:text-[14.5px] leading-tight hover:underline text-left block w-full"
            style={{ color: PM.textMain }}
            title={cert.file_name}
          >
            {cert.file_name}
          </button>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[11px] tabular-nums"
              style={{ color: PM.textSubtle }}
            >
              {formatBytes(cert.file_size)}
            </span>
          </div>
        </div>

        {/* Issued at — mobile では status の隣に畳み込む */}
        <div
          className="hidden sm:block text-[12px] tabular-nums"
          style={{ color: PM.textMuted }}
        >
          {cert.issued_at ? formatDate(cert.issued_at) : (
            <span className="inline-flex items-center gap-1.5" style={{ color: PM.textSubtle }}>
              <Clock3 className="w-3 h-3" aria-hidden="true" />
              発行待ち
            </span>
          )}
        </div>

        {/* TxID — Mono 等幅で美しく、かつ控えめ */}
        <div className="hidden sm:flex items-center min-w-0">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] truncate"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${PM.border}`,
              color: PM.textMuted,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
          >
            <Hash className="w-3 h-3 shrink-0" aria-hidden="true" />
            {truncateMiddle(cert.tsa_receipt_id || cert.file_hash, 6, 6)}
          </span>
          {cert.has_c2pa_data && (
            <span
              className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: PM.success }}
              title="Content Credentials (C2PA) を含む"
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              C2PA
            </span>
          )}
        </div>

        {/* Actions */}
        {/* Actions & Status Badge (右端) */}
        <div className="flex items-center justify-end gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 opacity-0 group-hover:opacity-80 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (planTier === 'free') {
                  toast.info("Evidence Packの発行はCreatorプラン以上です。");
                } else {
                  onEvidence(cert);
                }
              }}
              className="p-1 hover:text-white transition-colors flex items-center gap-0.5"
              title="Evidence Pack (ZIP/PDF)"
            >
              <FileDown className="w-4 h-4" />
              {planTier === 'free' ? <span className="text-[9px]">🔒</span> : null}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (planTier === 'free' || planTier === 'spot') {
                  toast.info("案件整理はCreatorプラン以上です。");
                } else {
                  onAssignProject(cert);
                }
              }}
              className="p-1 hover:text-white transition-colors flex items-center gap-0.5"
              title="プロジェクト割当"
            >
              <FolderKanban className="w-4 h-4" />
              {planTier === 'free' || planTier === 'spot' ? <span className="text-[9px]">🔒</span> : null}
            </button>
          </div>
          <StatusBadge {...statusBadge} />
        </div>
      </motion.div>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function StatusBadge({
  label,
  color,
  border,
  bg,
  icon: Icon,
}: ReturnType<typeof badgeFor>) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase"
      style={{
        color,
        border: `1px solid ${border}`,
        background: bg,
      }}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function badgeFor(status: CertificateStatus) {
  switch (status) {
    case 'verified':
      return {
        label: 'Verified',
        color: PM.success,
        border: PM.successRing,
        bg: PM.successSoft,
        icon: ShieldCheck,
      };
    case 'uploading':
      return {
        label: 'Uploading',
        color: PM.primary,
        border: PM.primaryRing,
        bg: PM.primarySoft,
        icon: Clock3,
      };
    case 'processing':
      return {
        label: 'Stamping',
        color: PM.primary,
        border: PM.primaryRing,
        bg: PM.primarySoft,
        icon: Clock3,
      };
    case 'failed':
      return {
        label: 'Failed',
        color: PM.error,
        border: PM.errorRing,
        bg: PM.errorSoft,
        icon: Clock3,
      };
    case 'idle':
    default:
      return {
        label: 'Pending',
        color: PM.textMuted,
        border: PM.border,
        bg: PM.surface,
        icon: Clock3,
      };
  }
}

/* ──────────────────────────────────────────────────────────────────────── */

export function HistorySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section aria-busy="true" aria-live="polite" className="w-full">
      <Header />
      <ul
        role="list"
        className="rounded-2xl overflow-hidden"
        style={{
          background: PM.surface,
          border: `1px solid ${PM.border}`,
        }}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <li
            key={i}
            className="grid grid-cols-[40px_minmax(0,1fr)_auto] sm:grid-cols-[40px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5"
            style={{
              borderBottom: i === rows - 1 ? 'none' : `1px solid ${PM.border}`,
            }}
          >
            <span
              className="w-10 h-10 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${PM.border}`,
              }}
            />
            <div className="min-w-0">
              <Shimmer width="62%" height={12} />
              <div className="mt-2">
                <Shimmer width="38%" height={9} />
              </div>
            </div>
            <div className="hidden sm:block">
              <Shimmer width="80%" height={10} />
            </div>
            <div className="hidden sm:block">
              <Shimmer width="80%" height={10} />
            </div>
            <Shimmer width={40} height={10} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Shimmer({
  width,
  height,
}: {
  width: string | number;
  height: number;
}) {
  return (
    <motion.span
      aria-hidden="true"
      className="block rounded-md"
      initial={{ opacity: 0.55 }}
      animate={{ opacity: [0.55, 0.85, 0.55] }}
      transition={{ duration: 1.4, ease: EASE, repeat: Infinity }}
      style={{
        width,
        height,
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.10), rgba(255,255,255,0.05))',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

export function HistoryEmpty() {
  return (
    <section
      aria-label="まだ証明書がありません"
      className="rounded-2xl text-center px-6 py-16 sm:py-20"
      style={{
        background: PM.surface,
        border: `1px dashed ${PM.borderStrong}`,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: D.slow / 1000, ease: EASE }}
        className="flex flex-col items-center"
      >
        <div
          aria-hidden="true"
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 relative"
          style={{
            background: PM.surface,
            border: `1px solid ${PM.border}`,
          }}
        >
          <FileImage className="w-7 h-7" style={{ color: PM.textMuted }} />
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: PM.bg,
              border: `1px solid ${PM.successRing}`,
              color: PM.success,
            }}
          >
            <Sparkles className="w-3 h-3" />
          </span>
        </div>
        <h3
          className="text-[18px] font-semibold tracking-tight"
          style={{ color: PM.textMain }}
        >
          証明記録がありません
        </h3>
        <p
          className="mt-2 text-[13px] leading-relaxed max-w-md mx-auto"
          style={{ color: PM.textMuted }}
        >
          上のドロップゾーンにファイルを配置して、最初の証明書を発行してください。
        </p>
      </motion.div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Pure helpers                                                              */
/* ──────────────────────────────────────────────────────────────────────── */

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncateMiddle(s: string | undefined | null, head = 6, tail = 6): string {
  if (!s) return '—';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
