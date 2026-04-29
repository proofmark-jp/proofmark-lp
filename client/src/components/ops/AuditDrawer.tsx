/**
 * AuditDrawer — right-side sliding panel that visualises the hash-chained
 * audit log for a single certificate.
 *
 * Triggered from a cert card / list row's "履歴" button. Studio-only surface.
 *
 * Visual contract:
 *   • Glass-card backdrop, vertical timeline with brand purple → teal spine.
 *   • Each row shows: emoji event glyph, actor email (snapshot), human time
 *     (relative + absolute on hover), before→after diff (auto-formatted),
 *     and a tiny green "✓ chained" / red "⚠ broken" indicator at the top.
 *   • Empty state: "まだ履歴はありません". Loading state: shimmer rows.
 *
 * Tamper-evidence:
 *   The server returns chainOk:boolean computed by re-hashing canonical JSON
 *   per row and verifying linked-list integrity. The drawer surfaces that.
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, X, Loader2, Clock3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AUDIT_EVENT_LABELS, type AuditEventType } from '../../lib/proofmark-ops';

// APIコール削減のための簡易インメモリキャッシュ
const auditCache = new Map<string, { logs: AuditRow[], chainOk: boolean }>();

export const clearAuditCache = (certId: string) => auditCache.delete(certId);

interface AuditRow {
  id: string;
  event_type: AuditEventType;
  actor_id: string | null;
  actor_email: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  prev_log_sha256: string | null;
  row_sha256: string;
  created_at: string;
}

interface AuditDrawerProps {
  open: boolean;
  certificateId: string | null;
  certificateTitle?: string | null;
  onClose: () => void;
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const delta = (Date.now() - t) / 1000;
  if (delta < 60) return 'たった今';
  if (delta < 3600) return `${Math.floor(delta / 60)}分前`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}時間前`;
  if (delta < 86400 * 7) return `${Math.floor(delta / 86400)}日前`;
  return new Date(iso).toLocaleDateString('ja-JP');
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) + ' JST';
}

function diffSummary(before: AuditRow['before_state'], after: AuditRow['after_state']): string {
  const b = before ?? {};
  const a = after ?? {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  return keys.map((k) => {
    const bv = (b as Record<string, unknown>)[k];
    const av = (a as Record<string, unknown>)[k];
    if (bv === av) return null;
    const bs = bv === null || bv === undefined ? '—' : String(bv);
    const as = av === null || av === undefined ? '—' : String(av);
    return `${k}: ${bs} → ${as}`;
  }).filter(Boolean).join(' / ');
}

export function AuditDrawer({ open, certificateId, certificateTitle, onClose }: AuditDrawerProps) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [chainOk, setChainOk] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !certificateId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // キャッシュヒット時はAPIを叩かずに即時表示
        if (auditCache.has(certificateId)) {
          const cached = auditCache.get(certificateId)!;
          setLogs(cached.logs);
          setChainOk(cached.chainOk);
          setLoading(false);
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token ?? '';
        const r = await fetch(`/api/certificates/audit?certId=${encodeURIComponent(certificateId)}&limit=100`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
          credentials: 'omit',
        });
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
        
        const fetchedLogs = (body.logs as AuditRow[]) ?? [];
        const fetchedChainOk = Boolean(body.chainOk);
        
        // 成功したらキャッシュに保存
        auditCache.set(certificateId, { logs: fetchedLogs, chainOk: fetchedChainOk });
        
        setLogs(fetchedLogs);
        setChainOk(fetchedChainOk);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? 'load_failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, certificateId]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const grouped = useMemo(() => logs, [logs]); // reserved for future date-grouping

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#07061A]/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-drawer-title"
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[440px] bg-[#0E0B26]/95 border-l border-white/10 shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.8)] flex flex-col"
          >
            <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-white/45 mb-1">
                  Audit Trail
                </p>
                <h2 id="audit-drawer-title" className="text-base font-semibold text-white truncate">
                  {certificateTitle || '証明書の操作履歴'}
                </h2>
                <p className="text-[11px] text-white/40 mt-1">
                  発行・ステータス変更・ダウンロード等を時系列で記録します。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="閉じる"
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Chain status banner */}
            {!loading && !error && (
              <div
                className={[
                  'mx-5 mt-4 rounded-lg px-3 py-2 text-[11px] flex items-center gap-2',
                  chainOk
                    ? 'border border-[#00D4AA]/30 bg-[#00D4AA]/[0.06] text-[#7FE9C7]'
                    : 'border border-[#E74C3C]/40 bg-[#E74C3C]/[0.08] text-[#FCA5A5]',
                ].join(' ')}
                role="status"
              >
                {chainOk ? (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      <strong className="font-semibold">ハッシュチェーン整合</strong>
                      ・ {logs.length} 件の履歴をサーバ側で再計算し、改ざんが無いことを確認しました。
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      <strong className="font-semibold">チェーン不整合を検知しました。</strong>
                      ・ サポートにご連絡ください。reqId はネットワークタブで確認できます。
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-5 proofmark-scrollbar">
              {loading && (
                <div className="space-y-3" role="status" aria-live="polite">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="h-3 w-32 bg-white/5 rounded animate-pulse mb-2" />
                      <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && error && (
                <div className="rounded-lg border border-[#E74C3C]/30 bg-[#E74C3C]/[0.08] px-3 py-2 text-[12px] text-[#FCA5A5]">
                  {error === 'rls_denied' ? '閲覧権限がありません。' : `読み込みに失敗しました（${error}）`}
                </div>
              )}

              {!loading && !error && grouped.length === 0 && (
                <div className="text-center py-12">
                  <Clock3 className="w-6 h-6 text-white/30 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-white/55">まだ履歴はありません。</p>
                  <p className="text-[11px] text-white/35 mt-1">
                    ステータス変更・案件の移動などを行うとここに記録されます。
                  </p>
                </div>
              )}

              {!loading && !error && grouped.length > 0 && (
                <ol className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-[#6C3EF4]/40 before:via-white/10 before:to-[#00D4AA]/30">
                  {grouped.map((row) => {
                    const meta = AUDIT_EVENT_LABELS[row.event_type] ?? {
                      label: row.event_type, verb: 'が操作', emoji: '•',
                    };
                    const summary = diffSummary(row.before_state, row.after_state);
                    return (
                      <li key={row.id} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#0E0B26] border border-white/10 flex items-center justify-center text-[10px]"
                        >
                          {meta.emoji}
                        </span>
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-[12px] font-semibold text-white">
                              <span className="text-[#A8A0D8]">{row.actor_email || '匿名ユーザー'}</span>
                              <span className="text-white/55"> {meta.verb}</span>
                              <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] uppercase tracking-wider text-white/65">
                                {meta.label}
                              </span>
                            </p>
                            <time
                              dateTime={row.created_at}
                              title={formatAbsolute(row.created_at)}
                              className="text-[10px] text-white/45 tabular-nums shrink-0"
                            >
                              {formatRelative(row.created_at)}
                            </time>
                          </div>
                          {summary && (
                            <p className="mt-1.5 text-[11px] text-white/55 break-words">
                              {summary}
                            </p>
                          )}
                          <details className="mt-1.5">
                            <summary className="text-[10px] text-white/30 cursor-pointer hover:text-white/55">
                              詳細ハッシュ
                            </summary>
                            <div className="mt-1 font-mono text-[10px] text-white/40 leading-snug break-all">
                              row: {row.row_sha256.slice(0, 24)}…<br />
                              prev: {row.prev_log_sha256 ? `${row.prev_log_sha256.slice(0, 24)}…` : '— (chain root)'}
                            </div>
                          </details>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <footer className="px-5 py-3 border-t border-white/5 text-[10px] text-white/40 flex items-center gap-2">
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-[#00D4AA]/70" aria-hidden="true" />
              )}
              ProofMark Audit Trail · 各行は SHA-256 でリンクされています
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
