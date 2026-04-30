/**
 * ProjectShowcaseRail — 公開プロフィール用の案件 (Project) 横断ナビ。
 *
 * Dashboard の ProjectRail と意図的に別実装にしている理由:
 *   • 内部 (Dashboard) 用の ProjectRail は「要対応」「Trusted TSA」など
 *     運用ノイズを含む。Storefront ではそれらを徹底的に排除し、
 *     "Storefront grade" のミニマルな表現に絞る。
 *   • 配色は Manus DNA の CSS 変数 (--card / --border / --primary / --accent)
 *     とアクセント hex (#00d4aa) のみを使う。
 *
 * Progressive Disclosure:
 *   • Studio 以外 (Free / Creator) で projects=[] のときは描画しない。
 *   • All / 案件群 という二段階。クライアントが見るべき粒度に最適化。
 */

import { motion } from 'framer-motion';
import { FolderKanban, ShieldCheck } from 'lucide-react';

export interface ShowcaseProjectModel {
  id: string;
  name: string;
  color: string;
  client_name: string | null;
  certificate_count: number;
  public_summary: string | null;
}

interface Props {
  projects: ShowcaseProjectModel[];
  activeId: string;
  onChange: (id: string) => void;
  totalCount: number;
}

const ALL_ID = '__all__';

export function ProjectShowcaseRail({ projects, activeId, onChange, totalCount }: Props) {
  if (projects.length === 0) return null;

  return (
    <nav
      aria-label="プロジェクトで絞り込む"
      className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 proofmark-scrollbar"
      style={{ scrollSnapType: 'x proximity' }}
    >
      <Chip
        active={activeId === ALL_ID}
        onClick={() => onChange(ALL_ID)}
        name="All Work"
        count={totalCount}
        synthetic
      />
      {projects.map((p) => (
        <Chip
          key={p.id}
          active={activeId === p.id}
          onClick={() => onChange(p.id)}
          name={p.name}
          count={p.certificate_count}
          color={p.color}
          clientName={p.client_name}
        />
      ))}
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

interface ChipProps {
  active: boolean;
  onClick: () => void;
  name: string;
  count: number;
  color?: string;
  clientName?: string | null;
  synthetic?: boolean;
}

function Chip({ active, onClick, name, count, color = '#6C3EF4', clientName, synthetic }: ChipProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      style={{
        borderColor: active ? `${color}80` : '#2a2a4e',
        background: active
          ? `linear-gradient(135deg, ${color}1F, rgba(255,255,255,0.02))`
          : '#0a0e27',
        boxShadow: active ? `0 8px 24px -16px ${color}88` : 'none',
        scrollSnapAlign: 'start',
      }}
      className={[
        'shrink-0 inline-flex items-center gap-2 rounded-full',
        'border px-3 py-1.5 text-[12px] font-semibold tracking-wide',
        'transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e27]',
        active ? 'text-[#f0f0fa]' : 'text-[#a0a0c0] hover:text-[#f0f0fa]',
      ].join(' ')}
      title={clientName ?? undefined}
    >
      {synthetic ? (
        <ShieldCheck className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      )}
      <FolderKanban className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
      <span className="truncate max-w-[180px]">{name}</span>
      <span
        className={[
          'inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
          'min-w-[20px] px-1.5 py-0.5',
          active ? 'bg-white/15 text-[#f0f0fa]' : 'bg-white/[0.04] text-[#a0a0c0]',
        ].join(' ')}
        aria-label={`${count} 件`}
      >
        {count}
      </span>
    </motion.button>
  );
}
