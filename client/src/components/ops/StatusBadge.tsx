/**
 * StatusBadge — pill that visualises a certificate's delivery_status.
 *
 * Uses the central token map in lib/proofmark-ops.ts so every Studio
 * surface reads the same colour / label / a11y description.
 */

import { motion } from 'framer-motion';
import { Check, Clock3, Eye, FileEdit, PauseCircle, Send } from 'lucide-react';
import {
  DELIVERY_STATUS_TOKENS,
  type DeliveryStatus,
} from '../../lib/proofmark-ops';

const ICON_MAP: Record<DeliveryStatus, React.ComponentType<{ className?: string }>> = {
  draft: FileEdit,
  in_progress: Clock3,
  review: Eye,
  ready: Send,
  delivered: Check,
  on_hold: PauseCircle,
};

interface StatusBadgeProps {
  status: DeliveryStatus | null | undefined;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onClick?: () => void;
}

export function StatusBadge({ status, size = 'md', interactive, onClick }: StatusBadgeProps) {
  if (!status) {
    return (
      <span
        onClick={interactive ? onClick : undefined}
        className={[
          'inline-flex items-center gap-1.5 rounded-full border border-white/10',
          'bg-white/[0.03] text-white/45',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
          interactive ? 'cursor-pointer hover:border-white/20 hover:text-white/70 transition-colors' : '',
        ].join(' ')}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label="ステータス未設定"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
        未設定
      </span>
    );
  }

  const t = DELIVERY_STATUS_TOKENS[status];
  const Icon = ICON_MAP[status];

  return (
    <motion.span
      onClick={interactive ? onClick : undefined}
      whileHover={interactive ? { scale: 1.02 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`ステータス: ${t.label} — ${t.description}`}
      title={t.description}
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
      }}
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        interactive ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]' : '',
      ].join(' ')}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      {t.label}
    </motion.span>
  );
}
