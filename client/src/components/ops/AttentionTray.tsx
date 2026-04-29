/**
 * AttentionTray — "今、アクションが必要な案件" を最上段に出す Ops 専用バンド。
 *
 * 表示優先度（attention asc）:
 *   1. review        … クライアント確認待ち
 *   2. in_progress   … 進行中（締切間近のものだけ）
 *   3. ready         … 納品準備完了 → 送信導線を強調
 *   4. delivered/draft/on_hold は表示しない
 *
 * 設計:
 *   - Studio ユーザーで該当が 0 件なら一切描画しない（ノイズ排除）。
 *   - 6 件以上は "+N more" で折りたたむ（描画コスト・視線量を抑制）。
 *   - Card クリックで親 Dashboard の `onFocusCert(cert)` を呼ぶ。
 */

import { motion } from 'framer-motion';
import { ArrowRight, Eye, Send, Sparkles, Calendar } from 'lucide-react';
import {
  DELIVERY_STATUS_TOKENS,
  compareByAttention,
  type DeliveryStatus,
} from '../../lib/proofmark-ops';

interface AttentionItem {
  id: string;
  title: string;
  projectName: string | null;
  projectColor: string | null;
  deliveryStatus: DeliveryStatus | null;
  dueAt: string | null;
  certifiedAt: string | null;
}

interface AttentionTrayProps {
  items: AttentionItem[];
  onFocus: (id: string) => void;
}

function daysFromNow(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

const ICON_FOR_STATUS: Record<DeliveryStatus, React.ComponentType<{ className?: string }>> = {
  draft: Eye, in_progress: Sparkles, review: Eye,
  ready: Send,  delivered: Send,    on_hold: Eye,
};

export function AttentionTray({ items, onFocus }: AttentionTrayProps) {
  // フィルタ: review / ready は常に, in_progress は締切3日以内のみ
  const candidates = items.filter((it) => {
    const s = it.deliveryStatus;
    if (s === 'review' || s === 'ready') return true;
    if (s === 'in_progress') {
      const d = daysFromNow(it.dueAt);
      return d !== null && d <= 3;
    }
    return false;
  });

  if (candidates.length === 0) return null;

  // attention 順 → 残数で newest 補助
  const sorted = [...candidates].sort((a, b) => {
    const c = compareByAttention(a.deliveryStatus, b.deliveryStatus);
    if (c !== 0) return c;
    return (Date.parse(b.certifiedAt ?? '') || 0) - (Date.parse(a.certifiedAt ?? '') || 0);
  });

  const visible = sorted.slice(0, 6);
  const more = sorted.length - visible.length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-label="要アクション案件"
      className="relative mb-6"
    >
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="text-[11px] uppercase tracking-widest text-white/45 font-semibold">
          今すぐ対応 ({sorted.length})
        </h2>
        <span className="text-[10px] text-white/35">requires attention</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((it) => {
          const t = it.deliveryStatus ? DELIVERY_STATUS_TOKENS[it.deliveryStatus] : null;
          const Icon = it.deliveryStatus ? ICON_FOR_STATUS[it.deliveryStatus] : Eye;
          const dDelta = daysFromNow(it.dueAt);
          const overdue = dDelta !== null && dDelta < 0;
          const nearDue = dDelta !== null && dDelta >= 0 && dDelta <= 3;

          return (
            <motion.button
              key={it.id}
              type="button"
              onClick={() => onFocus(it.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              className={[
                'group relative text-left rounded-xl overflow-hidden',
                'border border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.04]',
                'backdrop-blur-md transition-colors p-4',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f] focus-visible:ring-[#00D4AA]',
              ].join(' ')}
              style={{
                boxShadow: t ? `inset 4px 0 0 ${t.color}` : undefined,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  style={{
                    background: t?.bg ?? 'rgba(255,255,255,0.06)',
                    border: `1px solid ${t?.border ?? 'rgba(255,255,255,0.08)'}`,
                    color: t?.color ?? '#A8A0D8',
                  }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: t?.color ?? '#A8A0D8' }}>
                    {t?.label ?? '要対応'}
                  </p>
                  <p className="text-[13px] font-semibold text-white truncate mt-0.5">
                    {it.title || 'Untitled'}
                  </p>
                  <p className="mt-1 text-[11px] text-white/55 truncate flex items-center gap-1.5">
                    {it.projectColor && (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: it.projectColor }}
                      />
                    )}
                    {it.projectName || '未分類'}
                  </p>
                  {(overdue || nearDue) && dDelta !== null && (
                    <p
                      className={[
                        'mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold',
                        overdue ? 'text-[#E74C3C]' : 'text-[#F0BB38]',
                      ].join(' ')}
                    >
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      {overdue ? `締切${Math.abs(dDelta)}日超過` : `あと${dDelta}日`}
                    </p>
                  )}
                </div>
                <ArrowRight
                  className="w-3.5 h-3.5 text-white/35 shrink-0 group-hover:text-white group-hover:translate-x-0.5 transition-all"
                  aria-hidden="true"
                />
              </div>
            </motion.button>
          );
        })}

        {more > 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-4 flex items-center justify-center text-[12px] text-white/45">
            他に {more} 件あります — フィルタを「要確認」に切り替えると表示されます
          </div>
        )}
      </div>
    </motion.section>
  );
}
