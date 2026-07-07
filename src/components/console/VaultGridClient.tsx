"use client";

/**
 * src/components/console/VaultGridClient.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * The Evidence Vault — Client Grid (True Absolute Apex Edition)
 *
 * 親 (app/console/page.tsx) が Supabase から Zero-Latency で取得した
 * certificates[] を初期状態とし、The Nervous System (Supabase Realtime) 
 * と結線することで、リロードなしでの状態昇格（Pending -> Sealed）を実現する。
 *
 * ⚡ The Apex Defenses:
 * 1. The Multi-Tenant Shield (Data Bleed防止): Realtime filter による他ユーザーイベントの物理遮断。
 * 2. CSS Injection Defense: accentHex の厳格なHEXサニタイズ。
 * 3. Re-render Cascade Block: VaultCard の完全なメモ化 (React.memo)。
 * 4. Silent Hydration: SSRとCSRの時間ズレによるFlicker（チラつき）の完全抑止。
 * 5. Memory Leak Prevention: Realtime チャンネルの確実な破棄 (cleanup)。
 *
 * 依存: React 19 (Next.js 15) / framer-motion / lucide-react / tailwindcss / supabase-js
 */

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  ArrowUpRight,
  ChevronRight,
  Clock,
  FileBadge,
  Fingerprint,
  Hash,
  Layers,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client'; 

/* ══════════════════════════════════════════════════════════════
 * Types
 * ══════════════════════════════════════════════════════════════ */

export interface Certificate {
  id: string;
  title: string | null;
  file_name: string | null;
  created_at: string;
  certified_at: string | null;
  timestamp_token: string | null;
  is_archived: boolean | null;
}

export interface VaultGridClientProps {
  /** 親 Server Component から渡される初期データ (limit 5 以上の運用にも耐える) */
  initialCerts: Certificate[];
  /** 「View All」の遷移先。デフォルトは /console/all */
  viewAllHref?: string;
  /** アクセントカラーを差し替えたい場合 (デフォルト: #00D4AA) */
  accentHex?: string;
  /** 🚨 The Final Apex Fix: 他者データの混入を防止するユーザーID */
  userId?: string;
}

/* ══════════════════════════════════════════════════════════════
 * Defenses & Helpers
 * ══════════════════════════════════════════════════════════════ */

function sanitizeHex(hex: string | undefined, fallback: string = '#00D4AA'): string {
  if (!hex) return fallback;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex) ? hex : fallback;
}

function isSealed(cert: Certificate): boolean {
  return Boolean(cert.timestamp_token) && Boolean(cert.certified_at);
}

function shortId(id: string): string {
  if (!id) return '—';
  const [head] = id.split('-');
  return (head || id).slice(0, 8);
}

function formatFullDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', 
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diffMs = Date.now() - d;
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

// 🚨 The Apex Fix 4: Hydration Flickerを防ぐマウント検知フック
function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/* ══════════════════════════════════════════════════════════════
 * Motion Variants
 * ══════════════════════════════════════════════════════════════ */

const GRID_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.9 },
  },
  exit: { opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.18 } },
};

/* ══════════════════════════════════════════════════════════════
 * Sub-Components
 * ══════════════════════════════════════════════════════════════ */

function StatusBadge({ sealed, accentHex }: { sealed: boolean; accentHex: string }) {
  if (sealed) {
    return (
      <span
        className="relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] whitespace-nowrap"
        style={{
          background: `rgba(0,212,170,0.10)`,
          border: `1px solid ${accentHex}66`,
          color: accentHex,
        }}
      >
        <ShieldCheck className="w-3 h-3" strokeWidth={2.4} />
        <span>ISSUED · SEALED</span>
        <span
          aria-hidden
          className="absolute -inset-px rounded-full pointer-events-none animate-pulse"
          style={{ boxShadow: `0 0 12px ${accentHex}55` }}
        />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] whitespace-nowrap"
      style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.35)',
        color: '#f59e0b',
      }}
    >
      <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.4} />
      <span>PENDING</span>
    </span>
  );
}

// 🚨 The Final Apex Fix: React.forwardRef と React.memo の完全結合
const VaultCard = React.memo(
  React.forwardRef<HTMLDivElement, { cert: Certificate; accentHex: string }>(
    function VaultCard({ cert, accentHex }, ref) {
      const isMounted = useIsMounted();
      const sealed = isSealed(cert);
      const displayTitle =
        (cert.title && cert.title.trim()) ||
        (cert.file_name && cert.file_name.trim()) ||
        'Untitled Certificate';

      return (
        // 🚨 ここに ref={ref} を貫通させ、Framer MotionにDOMを捕捉させる
        <motion.div ref={ref} variants={CARD_VARIANTS} layout>
          <Link
            href={`/console/${cert.id}`}
            className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-[--pm-accent] rounded-2xl"
            style={{ ['--pm-accent' as string]: accentHex }}
          >
            <motion.article
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.995 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative h-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md transition-colors duration-300 hover:border-zinc-700"
              style={{
                boxShadow:
                  '0 24px 60px -32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset',
              }}
            >
              {/* Top hairline */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px pointer-events-none transition-opacity duration-300"
                style={{
                  background: sealed
                    ? `linear-gradient(90deg, transparent, ${accentHex}, transparent)`
                    : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
                  opacity: sealed ? 0.85 : 0.55,
                }}
              />

              {/* Under-card aura (hover glow) */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-4 -bottom-8 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
                style={{
                  background: sealed
                    ? `radial-gradient(ellipse at 50% 50%, ${accentHex}30, transparent 70%)`
                    : 'radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.18), transparent 70%)',
                }}
              />

              <div className="relative p-5 flex flex-col gap-4 h-full">
                {/* Header: icon + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="relative shrink-0">
                    <div
                      className="p-2.5 rounded-xl border border-zinc-800 bg-black transition-colors duration-300 group-hover:border-[--pm-accent]"
                      style={{ ['--pm-accent' as string]: accentHex }}
                    >
                      {sealed ? (
                        <ShieldCheck
                          className="w-5 h-5 transition-colors duration-300"
                          style={{ color: accentHex }}
                          strokeWidth={2.2}
                        />
                      ) : (
                        <ShieldAlert
                          className="w-5 h-5 text-amber-500 transition-colors duration-300"
                          strokeWidth={2.2}
                        />
                      )}
                    </div>
                    {sealed && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          boxShadow: `0 0 24px ${accentHex}55, 0 0 0 1px ${accentHex}44 inset`,
                        }}
                      />
                    )}
                  </div>
                  <StatusBadge sealed={sealed} accentHex={accentHex} />
                </div>

                {/* Title */}
                <div className="min-w-0">
                  <h3 className="text-white text-[15.5px] font-bold tracking-tight leading-snug line-clamp-2 transition-colors">
                    {displayTitle}
                  </h3>
                  {cert.file_name && cert.file_name !== displayTitle && (
                    <p className="mt-1 font-mono text-[11px] text-zinc-500 truncate">
                      {cert.file_name}
                    </p>
                  )}
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

                {/* Metadata rows */}
                <dl className="grid grid-cols-1 gap-2 text-[11px] font-mono">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="inline-flex items-center gap-1.5 text-zinc-500 uppercase tracking-[0.18em]">
                      <Hash className="w-3 h-3" /> ID
                    </dt>
                    <dd className="text-zinc-300 tabular-nums">
                      {shortId(cert.id)}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <dt className="inline-flex items-center gap-1.5 text-zinc-500 uppercase tracking-[0.18em]">
                      <Clock className="w-3 h-3" /> Created
                    </dt>
                    <dd className="text-zinc-300 tabular-nums text-right">
                      <span>{formatFullDate(cert.created_at)}</span>
                      {isMounted && (
                        <span className="ml-1.5 text-zinc-500">
                          · {formatRelative(cert.created_at)}
                        </span>
                      )}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <dt className="inline-flex items-center gap-1.5 text-zinc-500 uppercase tracking-[0.18em]">
                      <Timer className="w-3 h-3" /> Certified
                    </dt>
                    <dd
                      className="tabular-nums text-right"
                      style={{ color: sealed ? accentHex : '#a1a1aa' }}
                    >
                      {cert.certified_at ? formatFullDate(cert.certified_at) : '待機中'}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <dt className="inline-flex items-center gap-1.5 text-zinc-500 uppercase tracking-[0.18em]">
                      <Fingerprint className="w-3 h-3" /> TSA Token
                    </dt>
                    <dd
                      className="tabular-nums text-right"
                      style={{ color: sealed ? accentHex : '#a1a1aa' }}
                    >
                      {cert.timestamp_token ? 'RFC3161 ✓' : '—'}
                    </dd>
                  </div>
                </dl>

                {/* Footer CTA */}
                <div className="mt-auto pt-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-[0.26em] transition-colors duration-300 text-zinc-500 group-hover:text-white">
                    Open Evidence Detail
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-mono transition-colors duration-300 text-zinc-500 group-hover:text-[--pm-accent]"
                    style={{ ['--pm-accent' as string]: accentHex }}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Bottom hairline */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-px pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accentHex}66, transparent)`,
                }}
              />
            </motion.article>
          </Link>
        </motion.div>
      );
    }
  )
);

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-16 px-4 border border-zinc-800/50 rounded-2xl bg-zinc-900/20"
    >
      <Search className="w-10 h-10 text-zinc-600 mb-4" />
      <p className="text-zinc-300 font-bold mb-1">証明書はまだありません</p>
      <p className="text-sm text-zinc-500">
        最初の動画をアップロードして、ハッシュチェーンを構築してください。
      </p>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
 * Main Component (The Nervous System)
 * ══════════════════════════════════════════════════════════════ */

export default function VaultGridClient({
  initialCerts,
  viewAllHref = '/console/all',
  accentHex: rawAccent = '#00D4AA',
  userId, // 🚨 The Final Apex Fix
}: VaultGridClientProps) {
  
  const accentHex = sanitizeHex(rawAccent);
  const [certs, setCerts] = useState<Certificate[]>(initialCerts);

  useEffect(() => {
    const supabase = createClient();

    // 🚨 The Apex Fix 1: The Multi-Tenant Shield (他人データの完全遮断)
    const channel = supabase
      .channel(`schema-db-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'certificates',
          filter: `user_id=eq.${userId}`, // 物理的に自分のイベント以外を弾く
        },
        (payload) => {
          setCerts((prev) => {
            if (payload.eventType === 'INSERT') {
              const newCert = payload.new as Certificate;
              if (newCert.is_archived) return prev;
              if (prev.some((c) => c.id === newCert.id)) return prev;
              return [newCert, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              const updatedCert = payload.new as Certificate;
              if (updatedCert.is_archived) {
                return prev.filter((c) => c.id !== updatedCert.id);
              }
              return prev.map((c) => (c.id === updatedCert.id ? updatedCert : c));
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((c) => c.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Nervous System] Evidence Vault connected. Shield active.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]); 

  const stats = useMemo(() => {
    let sealed = 0;
    let pending = 0;
    for (const c of certs) {
      if (isSealed(c)) sealed += 1;
      else pending += 1;
    }
    return { sealed, pending, total: certs.length };
  }, [certs]);

  const hasCerts = certs.length > 0;

  return (
    <section
      aria-labelledby="vault-grid-heading"
      className="relative"
      style={{ ['--pm-accent' as string]: accentHex }}
    >
      {/* Section header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileBadge className="w-4 h-4" style={{ color: accentHex }} />
            <h2
              id="vault-grid-heading"
              className="text-xl font-extrabold tracking-tight text-white"
            >
              Recent Certificates
            </h2>
          </div>
          <p className="mt-1 text-[12.5px] text-zinc-500 font-medium max-w-xl">
            クリエイターとしての「時系列の証拠」を1枚1枚封印して保管しています。
            クリックすると Evidence Detail が開きます。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:inline-flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
                Total
              </span>
              <span className="text-[12px] font-mono tabular-nums text-white">
                {stats.total}
              </span>
            </div>
            <span className="h-3 w-px bg-zinc-800" aria-hidden />
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: accentHex }} />
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
                Sealed
              </span>
              <span
                className="text-[12px] font-mono tabular-nums"
                style={{ color: accentHex }}
              >
                {stats.sealed}
              </span>
            </div>
            {stats.pending > 0 && (
              <>
                <span className="h-3 w-px bg-zinc-800" aria-hidden />
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
                    Pending
                  </span>
                  <span className="text-[12px] font-mono tabular-nums text-amber-500">
                    {stats.pending}
                  </span>
                </div>
              </>
            )}
          </div>

          {hasCerts && (
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11.5px] font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--pm-accent]"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Body */}
      <AnimatePresence mode="wait" initial={false}>
        {!hasCerts ? (
          <EmptyState key="empty" />
        ) : (
          <motion.div
            key="grid"
            variants={GRID_VARIANTS}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5"
          >
            <AnimatePresence initial={false}>
              {certs.map((cert) => (
                <VaultCard
                  key={cert.id}
                  cert={cert}
                  accentHex={accentHex}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer meta */}
      {hasCerts && (
        <div className="mt-6 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.24em] text-zinc-600">
          <span>PROOFMARK · EVIDENCE VAULT</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" style={{ color: accentHex }} />
            {stats.sealed} of {stats.total} sealed
          </span>
        </div>
      )}
    </section>
  );
}