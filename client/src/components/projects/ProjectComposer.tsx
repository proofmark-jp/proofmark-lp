/**
 * ProjectComposer — modal dialog to create/edit a project (案件フォルダ).
 *
 * Studio-only surface. Free / Creator users never see this — Progressive
 * Disclosure means "案件" is implicit (free-text) for individuals and
 * becomes a first-class object only when the user is on Studio.
 *
 * Design:
 *   • Glass-card backdrop matching HeroMockup tokens.
 *   • Color palette grid uses the brand palette (purple / teal / amber /
 *     red / blue / pink) so chips read consistently.
 *   • Keyboard: Escape closes, Enter inside name input submits.
 *   • Live validation: trimmed length 1..80, color HEX6.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, FolderKanban, Loader2, X } from 'lucide-react';
import type { ProjectRecord, TeamRecord } from '../../hooks/useStudioOps';

const PRESET_COLORS = [
  '#6C3EF4', // brand purple
  '#00D4AA', // brand teal
  '#F0BB38', // amber (review)
  '#E74C3C', // red (alert)
  '#3B82F6', // blue
  '#EC4899', // pink
  '#A855F7', // light purple
  '#22C55E', // green
];

interface Props {
  open: boolean;
  initial?: Partial<ProjectRecord> | null;
  teams: TeamRecord[];
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    client_name?: string | null;
    color?: string;
    team_id?: string | null;
    due_at?: string | null;
    notes?: string | null;
  }) => Promise<void>;
}

export function ProjectComposer({ open, initial, teams, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<string>(''); // YYYY-MM-DD
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setClientName(initial?.client_name ?? '');
    setColor(initial?.color ?? PRESET_COLORS[0]);
    setTeamId(initial?.team_id ?? null);
    if (initial?.due_at) {
      const d = new Date(initial.due_at);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setDueAt(`${yyyy}-${mm}-${dd}`);
    } else {
      setDueAt('');
    }
    setNotes(initial?.notes ?? '');
    setError(null);
    // Focus on next tick so the spring animation doesn't fight the focus.
    requestAnimationFrame(() => nameRef.current?.focus());
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 80;

  async function handleSubmit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: trimmed,
        client_name: clientName.trim() || null,
        color,
        team_id: teamId,
        due_at: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e) {
      setError((e as Error)?.message ?? '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center px-4 py-12 overflow-y-auto"
          style={{ background: 'rgba(7,6,26,0.78)', backdropFilter: 'blur(8px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="proj-composer-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0E0B26]/95 shadow-[0_60px_120px_-60px_rgba(108,62,244,0.6)]"
          >
            <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}
                >
                  <FolderKanban className="w-4 h-4" />
                </span>
                <div>
                  <h2 id="proj-composer-title" className="text-base font-semibold text-white">
                    {initial?.id ? '案件を編集' : '新規案件'}
                  </h2>
                  <p className="text-[11px] text-white/45">クライアント単位の作業フォルダ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="閉じる"
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="px-6 py-5 space-y-5">
              {/* Name */}
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  案件名 <span className="text-[#F0BB38]">*</span>
                </span>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSubmit(); }}
                  maxLength={80}
                  placeholder="ACME社 / 表紙イラスト 2026-04"
                  className="mt-1.5 w-full rounded-lg bg-white/[0.03] border border-white/10 focus:border-[#6C3EF4]/50 focus:bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors"
                />
                <span className="mt-1 block text-[10px] text-white/35 tabular-nums">{trimmed.length}/80</span>
              </label>

              {/* Client name */}
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  クライアント名（任意）
                </span>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  maxLength={80}
                  placeholder="株式会社ACME"
                  className="mt-1.5 w-full rounded-lg bg-white/[0.03] border border-white/10 focus:border-[#6C3EF4]/50 focus:bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors"
                />
              </label>

              {/* Color picker */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  ラベルカラー
                </span>
                <div className="mt-2 grid grid-cols-8 gap-2" role="radiogroup" aria-label="ラベルカラー">
                  {PRESET_COLORS.map((c) => {
                    const active = c === color;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`色 ${c}`}
                        onClick={() => setColor(c)}
                        className={[
                          'relative h-8 w-full rounded-lg transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0B26] focus-visible:ring-white',
                          active ? 'ring-2 ring-white/80 scale-105' : 'hover:scale-105',
                        ].join(' ')}
                        style={{ background: c }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Team selector (only when user has teams) */}
              {teams.length > 0 && (
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                    チーム（共有範囲）
                  </span>
                  <select
                    value={teamId ?? ''}
                    onChange={(e) => setTeamId(e.target.value || null)}
                    className="mt-1.5 w-full rounded-lg bg-white/[0.03] border border-white/10 focus:border-[#6C3EF4]/50 px-3 py-2.5 text-sm text-white outline-none transition-colors"
                  >
                    <option value="">個人（共有しない）</option>
                    {teams.map((t) => (
                      <option key={t.team_id} value={t.team_id}>
                        {t.team_name} ({t.member_count}/{t.max_seats})
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] text-white/40">
                    チームを選択するとそのメンバー全員が閲覧・編集できます。
                  </span>
                </label>
              )}

              {/* Due date */}
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  納期（任意）
                </span>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="mt-1.5 w-full rounded-lg bg-white/[0.03] border border-white/10 focus:border-[#6C3EF4]/50 px-3 py-2.5 text-sm text-white outline-none transition-colors"
                />
              </label>

              {/* Notes */}
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  メモ（任意）
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="NDA有 / 商用利用範囲 / 納品形式 など"
                  className="mt-1.5 w-full resize-none rounded-lg bg-white/[0.03] border border-white/10 focus:border-[#6C3EF4]/50 focus:bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors"
                />
              </label>

              {error && (
                <div className="rounded-lg border border-[#E74C3C]/30 bg-[#E74C3C]/10 px-3 py-2 text-[12px] text-[#E74C3C]">
                  {error}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 px-6 pb-5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm text-white/65 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!valid || submitting}
                className={[
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold',
                  'bg-gradient-to-r from-[#6C3EF4] to-[#00D4AA] text-[#07061A]',
                  'hover:opacity-95 active:opacity-90 transition-opacity',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0B26] focus-visible:ring-[#00D4AA]',
                ].join(' ')}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {initial?.id ? '保存' : '案件を作成'}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
