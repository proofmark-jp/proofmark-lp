/**
 * ProjectRail — horizontal scrollable rail of "案件チップ".
 *
 * Progressive Disclosure:
 *   • Free / Creator users still see the rail (it's the same UX they had
 *     before — ad-hoc text-based `client_project`), but no team labels.
 *   • Studio users get full project objects with colour, due date, status
 *     and an inline "+ 案件" button to create new folders.
 *
 * Brand: Glassmorphism background, #6C3EF4 / #00D4AA accents, Framer Motion
 * spring on selection. No box-shadow heavier than the existing dashboard
 * KPI cards.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FolderKanban, Plus, Sparkles, Calendar, BadgeCheck } from 'lucide-react';
import type { ProjectRecord } from '../../hooks/useStudioOps';

export interface ProjectChipModel {
  id: string;
  name: string;
  count: number;
  color?: string;
  trustedCount?: number;
  needsAttention?: number;
  dueAt?: string | null;
  /** True for the synthetic "未分類 / All" buckets. */
  synthetic?: boolean;
}

interface ProjectRailProps {
  chips: ProjectChipModel[];
  activeId: string;
  onChange: (id: string) => void;
  isStudio: boolean;
  /** Studio only: open the "create project" composer. */
  onCreate?: () => void;
  /** Studio only: real project records (used when chips reference one). */
  projects?: ProjectRecord[];
}

function daysFromNow(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

export function ProjectRail({ chips, activeId, onChange, isStudio, onCreate, projects }: ProjectRailProps) {
  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    (projects ?? []).forEach((p) => m.set(p.id, p.color));
    return m;
  }, [projects]);

  return (
    <nav
      aria-label="案件フィルタ"
      className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 proofmark-scrollbar"
      style={{ scrollSnapType: 'x proximity' }}
    >
      {chips.map((c) => {
        const active = c.id === activeId;
        const color = c.color ?? colorMap.get(c.id) ?? '#6C3EF4';
        const dDelta = daysFromNow(c.dueAt);
        const nearDue = dDelta !== null && dDelta <= 3 && dDelta >= 0;
        const overdue = dDelta !== null && dDelta < 0;

        return (
          <motion.button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={active}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              borderColor: active ? `${color}88` : 'rgba(255,255,255,0.08)',
              boxShadow: active ? `0 8px 24px -12px ${color}55` : 'none',
              background: active
                ? `linear-gradient(135deg, ${color}22, rgba(255,255,255,0.02))`
                : 'rgba(255,255,255,0.03)',
              scrollSnapAlign: 'start',
            }}
            className={[
              'shrink-0 inline-flex items-center gap-2 rounded-full',
              'border px-3 py-1.5 text-[12px] font-semibold tracking-wide',
              'backdrop-blur-md transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f] focus-visible:ring-[#00D4AA]',
              active ? 'text-white' : 'text-white/70 hover:text-white',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: color }}
            />
            <FolderKanban className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
            <span className="truncate max-w-[160px]">{c.name}</span>
            <span
              className={[
                'inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                'min-w-[20px] px-1.5 py-0.5',
                active ? 'bg-white/15 text-white' : 'bg-white/[0.04] text-white/55',
              ].join(' ')}
              aria-label={`${c.count} 件`}
            >
              {c.count}
            </span>

            {/* Studio-only sub-indicators */}
            {isStudio && c.needsAttention !== undefined && c.needsAttention > 0 && (
              <span
                title={`要確認 ${c.needsAttention} 件`}
                className="inline-flex items-center gap-0.5 text-[10px] text-[#F0BB38]"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                {c.needsAttention}
              </span>
            )}
            {isStudio && c.trustedCount !== undefined && c.trustedCount > 0 && (
              <span
                title={`Trusted TSA ${c.trustedCount} 件`}
                className="inline-flex items-center gap-0.5 text-[10px] text-[#00D4AA]"
              >
                <BadgeCheck className="w-3 h-3" aria-hidden="true" />
                {c.trustedCount}
              </span>
            )}
            {isStudio && (overdue || nearDue) && (
              <span
                title={overdue ? '締切超過' : '締切間近'}
                className={[
                  'inline-flex items-center gap-0.5 text-[10px]',
                  overdue ? 'text-[#E74C3C]' : 'text-[#F0BB38]',
                ].join(' ')}
              >
                <Calendar className="w-3 h-3" aria-hidden="true" />
                {overdue ? `${Math.abs(dDelta!)}日超過` : `${dDelta}日`}
              </span>
            )}
          </motion.button>
        );
      })}

      {isStudio && onCreate && (
        <motion.button
          type="button"
          onClick={onCreate}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className={[
            'shrink-0 inline-flex items-center gap-1.5 rounded-full',
            'border border-dashed border-[#6C3EF4]/40 bg-[#6C3EF4]/[0.06]',
            'px-3 py-1.5 text-[12px] font-semibold text-[#A8A0D8]',
            'hover:border-[#6C3EF4]/70 hover:text-white hover:bg-[#6C3EF4]/[0.12]',
            'transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3EF4]',
          ].join(' ')}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          新規案件
        </motion.button>
      )}
    </nav>
  );
}
