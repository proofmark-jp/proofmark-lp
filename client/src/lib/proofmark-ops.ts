/**
 * proofmark-ops.ts — single source of truth for Studio "Ops OS" tokens.
 *
 * Used by: Dashboard, ProjectRail, StatusBadge, AuditDrawer.
 * All UI components MUST import from here — never re-define labels/colors.
 *
 * Brand discipline: keeps the existing #6C3EF4 (Purple) / #00D4AA (Teal)
 * palette intact and complies with the lint:copy guard (no absolute claims).
 */

export type DeliveryStatus =
  | 'draft'
  | 'in_progress'
  | 'review'
  | 'ready'
  | 'delivered'
  | 'on_hold';

export type ProjectStatus = 'active' | 'on_hold' | 'delivered' | 'archived';

export interface StatusToken {
  key: DeliveryStatus;
  label: string;
  short: string;
  color: string;
  border: string;
  bg: string;
  /** Sort priority — lower = surfaced first ("needs your attention"). */
  attention: number;
  description: string;
}

export const DELIVERY_STATUS_TOKENS: Record<DeliveryStatus, StatusToken> = {
  review: {
    key: 'review',
    label: '要確認',
    short: 'Review',
    color: '#F0BB38',
    border: 'rgba(240,187,56,0.40)',
    bg: 'rgba(240,187,56,0.12)',
    attention: 0,
    description: 'クライアント確認待ち。次のアクションが必要です。',
  },
  in_progress: {
    key: 'in_progress',
    label: '進行中',
    short: 'In Progress',
    color: '#6C3EF4',
    border: 'rgba(108,62,244,0.40)',
    bg: 'rgba(108,62,244,0.12)',
    attention: 1,
    description: '制作中。進捗を更新できます。',
  },
  ready: {
    key: 'ready',
    label: '納品準備完了',
    short: 'Ready',
    color: '#00D4AA',
    border: 'rgba(0,212,170,0.40)',
    bg: 'rgba(0,212,170,0.12)',
    attention: 2,
    description: 'NDA / 検証OK。納品リンクを共有できます。',
  },
  delivered: {
    key: 'delivered',
    label: '納品済',
    short: 'Delivered',
    color: '#00D4AA',
    border: 'rgba(0,212,170,0.55)',
    bg: 'rgba(0,212,170,0.18)',
    attention: 5,
    description: 'クライアントへ送信済。Evidence Pack ログ保持。',
  },
  on_hold: {
    key: 'on_hold',
    label: '保留',
    short: 'On Hold',
    color: '#9BA3D4',
    border: 'rgba(155,163,212,0.35)',
    bg: 'rgba(155,163,212,0.10)',
    attention: 4,
    description: 'クライアント側の事情で停止中。',
  },
  draft: {
    key: 'draft',
    label: '下書き',
    short: 'Draft',
    color: '#A8A0D8',
    border: 'rgba(168,160,216,0.30)',
    bg: 'rgba(168,160,216,0.08)',
    attention: 3,
    description: '受注前 / 作業前のドラフト。',
  },
};

export const DELIVERY_STATUS_ORDER: DeliveryStatus[] = [
  'review',
  'in_progress',
  'ready',
  'delivered',
  'draft',
  'on_hold',
];

/* ── audit ─────────────────────────────────────────────────────────────── */

export type AuditEventType =
  | 'created' | 'updated' | 'status_changed' | 'project_changed'
  | 'archived' | 'restored' | 'deleted'
  | 'evidence_pack_downloaded' | 'shared'
  | 'team_assigned' | 'invitation_accepted';

export const AUDIT_EVENT_LABELS: Record<AuditEventType, { label: string; verb: string; emoji: string }> = {
  created:                   { label: '発行',         verb: 'が証明書を発行',       emoji: '✨' },
  updated:                   { label: '更新',         verb: 'が情報を更新',         emoji: '✏️' },
  status_changed:            { label: 'ステータス変更', verb: 'がステータスを変更',  emoji: '🔁' },
  project_changed:           { label: '案件移動',     verb: 'が案件を変更',         emoji: '📁' },
  archived:                  { label: 'アーカイブ',   verb: 'がアーカイブ',         emoji: '🗄' },
  restored:                  { label: '復元',         verb: 'がアーカイブから復元', emoji: '↩️' },
  deleted:                   { label: '削除',         verb: 'が削除',               emoji: '🗑' },
  evidence_pack_downloaded:  { label: 'Pack取得',     verb: 'が Evidence Pack を取得', emoji: '⬇️' },
  shared:                    { label: '共有',         verb: 'が共有',               emoji: '🔗' },
  team_assigned:             { label: 'チーム移管',   verb: 'がチームへ移管',       emoji: '👥' },
  invitation_accepted:       { label: '招待受諾',     verb: 'が招待を受諾',         emoji: '✅' },
};

/* ── helpers ───────────────────────────────────────────────────────────── */

export function compareByAttention(a: DeliveryStatus | null, b: DeliveryStatus | null): number {
  const aw = a ? DELIVERY_STATUS_TOKENS[a].attention : 99;
  const bw = b ? DELIVERY_STATUS_TOKENS[b].attention : 99;
  return aw - bw;
}

/** Pure CSS-friendly tag list, used in `className` switch statements. */
export const STATUS_DOT_CLASS: Record<DeliveryStatus, string> = {
  draft: 'bg-white/30',
  in_progress: 'bg-[#6C3EF4]',
  review: 'bg-[#F0BB38]',
  ready: 'bg-[#00D4AA]',
  delivered: 'bg-[#00D4AA]',
  on_hold: 'bg-white/40',
};
