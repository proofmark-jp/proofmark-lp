/**
 * ContentCredentialsSection — God-Mode "C2PA Vault Terminal".
 *
 * Reframed as a secure crypto-vault console:
 *   • frosted glass cards
 *   • monospace numerics / labels
 *   • Identity Purple accent for "technical strictness"
 *   • subtle scanlines + terminal status bar
 *
 * No logic / no props / no behaviour changed.
 */

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeCheck,
  Cpu,
  ExternalLink,
  FileImage,
  Fingerprint,
  Layers3,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wand2,
} from 'lucide-react';
import {
  formatAiUsageLabel,
  formatValidityLabel,
  getC2paSummary,
} from '../../lib/c2pa-schema';

interface Props {
  manifest: unknown;
  compact?: boolean;
}

const PM_EASE = [0.16, 1, 0.3, 1] as const;

export function ContentCredentialsSection({ manifest, compact = false }: Props) {
  const summary = getC2paSummary(manifest);
  const tone = !summary.present
    ? { color: '#A8A0D8', rgb: '168,160,216', Icon: Fingerprint, statusText: 'NO_MANIFEST' }
    : summary.valid === false
    ? { color: '#FF7B7B', rgb: '255,123,123', Icon: ShieldAlert, statusText: 'SIG_BROKEN' }
    : summary.aiUsed === true
    ? { color: '#00D4AA', rgb: '0,212,170', Icon: Wand2, statusText: 'AI_TRACE_FOUND' }
    : { color: '#6C3EF4', rgb: '108,62,244', Icon: BadgeCheck, statusText: 'VAULT_ALIGNED' };
  const Icon = tone.Icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: PM_EASE }}
      aria-labelledby="content-credentials-title"
      className="relative overflow-hidden rounded-3xl border border-[#1C1A38] bg-[#0A0820]/90"
      style={{
        backdropFilter: 'blur(20px)',
        boxShadow:
          '0 30px 80px -40px rgba(108,62,244,0.45), inset 0 0 0 1px rgba(255,255,255,0.025)',
      }}
    >
      {/* ── Vault interior glow ── */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(108,62,244,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(0,212,170,0.12),transparent_42%)]" />

      {/* ── Scanlines ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 4px)',
        }}
      />

      {/* ── Top hairline (RGB chrome) ── */}
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(108,62,244,0.85),rgba(0,212,170,0.85),rgba(240,187,56,0.55),transparent)]" />

      {/* ── Terminal status bar ── */}
      <div
        className="relative flex items-center justify-between px-5 sm:px-6 py-2.5 border-b border-[#1C1A38]"
        style={{ background: 'rgba(0,0,0,0.32)' }}
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3" style={{ color: tone.color }} />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: tone.color }}
          >
            proofmark://vault/c2pa
          </span>
        </div>
        {summary.present && (
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em]">
            <span className="flex items-center gap-1.5" style={{ color: '#A8A0D8' }}>
              <motion.span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: tone.color, boxShadow: `0 0 8px ${tone.color}` }}
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span style={{ color: tone.color }}>{tone.statusText}</span>
            </span>
            <span className="hidden sm:inline text-[#5E5A8A]">|</span>
            <span className="hidden sm:inline text-[#A8A0D8]">
              tty-vault.{summary.present ? '01' : '00'}
            </span>
          </div>
        )}
      </div>

      {/* ── Header ── */}
      <header className={`relative px-5 sm:px-6 ${compact ? 'pt-5 pb-4' : 'pt-6 pb-5'} border-b border-[#1C1A38]`}>
        <div className="flex items-start gap-3.5">
          <motion.span
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl relative"
            style={{
              color: tone.color,
              background: `rgba(${tone.rgb}, 0.10)`,
              border: `1px solid rgba(${tone.rgb}, 0.40)`,
            }}
            animate={{
              boxShadow: [
                `0 0 0 0 rgba(${tone.rgb}, 0.45)`,
                `0 0 0 10px rgba(${tone.rgb}, 0)`,
                `0 0 0 0 rgba(${tone.rgb}, 0.45)`,
              ],
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </motion.span>
          <div className="min-w-0 flex-1">
            <p
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.20em]"
              style={{
                color: tone.color,
                background: `rgba(${tone.rgb}, 0.10)`,
                border: `1px solid rgba(${tone.rgb}, 0.40)`,
              }}
            >
              <Layers3 className="h-3 w-3" aria-hidden="true" />
              Internal Provenance Vault
            </p>
            <h2
              id="content-credentials-title"
              className="mt-2 font-display text-[20px] sm:text-[22px] font-extrabold leading-tight text-white tracking-tight"
            >
              Content Credentials
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#A8A0D8] max-w-2xl">
              外部の RFC3161 タイムスタンプと並行する、画像内部の暗号学的由来情報です。
              署名が壊れていても RFC3161 フローは継続し、ここではその状態のみを開示します。
            </p>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <VaultMetric
            icon={<ShieldCheck className="h-4 w-4" />}
            label="署名状態"
            value={formatValidityLabel(summary.validity)}
            color={tone.color}
            rgb={tone.rgb}
          />
          <VaultMetric
            icon={<Wand2 className="h-4 w-4" />}
            label="AI USAGE"
            value={formatAiUsageLabel(summary)}
            color={summary.aiUsed === true ? '#00D4AA' : '#A8A0D8'}
            rgb={summary.aiUsed === true ? '0,212,170' : '168,160,216'}
          />
          <VaultMetric
            icon={<BadgeCheck className="h-4 w-4" />}
            label="ISSUER"
            value={summary.issuer ?? '未開示'}
            color="#6C3EF4"
            rgb="108,62,244"
          />
          <VaultMetric
            icon={<Cpu className="h-4 w-4" />}
            label="SOFTWARE"
            value={summary.software ?? '未開示'}
            color="#F0BB38"
            rgb="240,187,56"
          />
        </div>

        {summary.present ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1, ease: PM_EASE }}
              className="mt-4 rounded-2xl p-4 sm:p-5 relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, rgba(13,11,36,0.92), rgba(21,29,47,0.88))',
                border: '1px solid #2a2a4e',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
              }}
            >
              {/* corner mark */}
              <div className="absolute top-2 left-2 h-3 w-3 border-t border-l" style={{ borderColor: `rgba(${tone.rgb}, 0.5)` }} />
              <div className="absolute top-2 right-2 h-3 w-3 border-t border-r" style={{ borderColor: `rgba(${tone.rgb}, 0.5)` }} />
              <div className="absolute bottom-2 left-2 h-3 w-3 border-b border-l" style={{ borderColor: `rgba(${tone.rgb}, 0.5)` }} />
              <div className="absolute bottom-2 right-2 h-3 w-3 border-b border-r" style={{ borderColor: `rgba(${tone.rgb}, 0.5)` }} />

              <div className="flex flex-wrap items-start justify-between gap-3 relative">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#A8A0D8] flex items-center gap-1.5">
                    <span style={{ color: tone.color }}>›</span> proofmark · reading
                  </p>
                  <h3 className="mt-1.5 text-[13.5px] sm:text-[14.5px] font-bold text-white leading-snug">
                    {summary.aiUsed === true
                      ? 'AI generation / edit history was declared in the embedded manifest.'
                      : summary.aiUsed === false
                      ? 'The embedded manifest does not declare generative AI usage.'
                      : 'The embedded manifest exists, but AI usage could not be determined.'}
                  </h3>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-[#A8A0D8] font-mono">
                    {summary.issuer ? `Issuer: ${summary.issuer}. ` : ''}
                    {summary.aiProvider ? `Provider: ${summary.aiProvider}. ` : ''}
                    {summary.device ? `Device: ${summary.device}. ` : ''}
                    {summary.manifestLabel ? `Manifest: ${summary.manifestLabel}.` : ''}
                  </p>
                </div>
                <motion.span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.20em] whitespace-nowrap"
                  style={{
                    color: tone.color,
                    background: `rgba(${tone.rgb}, 0.10)`,
                    border: `1px solid rgba(${tone.rgb}, 0.45)`,
                  }}
                  animate={{
                    boxShadow: [
                      `0 0 0 0 rgba(${tone.rgb}, 0.45)`,
                      `0 0 0 7px rgba(${tone.rgb}, 0)`,
                      `0 0 0 0 rgba(${tone.rgb}, 0.45)`,
                    ],
                  }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {summary.valid === false ? 'Fractured but recorded' : summary.aiUsed === true ? 'AI trace embedded' : 'Vault aligned'}
                </motion.span>
              </div>
            </motion.div>

            {summary.valid === false && summary.reason && (
              <div
                className="mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[12px]"
                style={{
                  background: 'rgba(255,123,123,0.08)',
                  border: '1px solid rgba(255,123,123,0.35)',
                  color: '#FFD0D0',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
                }}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="font-mono leading-relaxed">
                  <span className="font-bold tracking-wider uppercase text-[11px] mr-1.5">署名注意:</span>
                  {summary.reason}
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <ConsoleCard
                icon={<FileImage className="h-3.5 w-3.5" />}
                title="ASSERTION SUMMARY"
              >
                {summary.assertionsCount > 0 ? (
                  <p className="text-[12px] leading-relaxed text-[#D8D4F5] font-mono">
                    この作品には{' '}
                    <span className="font-bold text-white tabular-nums">
                      {summary.assertionsCount}
                    </span>{' '}
                    件の assertion が含まれます。Certificate Page では最小限の公開情報だけを表示し、サムネイルやバイナリは送信・保存しません。
                  </p>
                ) : (
                  <p className="text-[12px] leading-relaxed text-[#A8A0D8] font-mono">
                    表示可能な assertion はありません。
                  </p>
                )}
              </ConsoleCard>

              <ConsoleCard
                icon={<Cpu className="h-3.5 w-3.5" />}
                title="INGREDIENT TRACE"
              >
                <p className="text-[12px] leading-relaxed text-[#D8D4F5] font-mono">
                  由来素材: <span className="text-white font-bold tabular-nums">{summary.ingredientsCount}</span> 件
                  {summary.aiProvider ? ` · Provider ${summary.aiProvider}` : ''}
                  {summary.device ? ` · Device ${summary.device}` : ''}
                </p>
              </ConsoleCard>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[11px] text-[#A8A0D8] font-mono">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{
                  background: 'rgba(21,29,47,0.6)',
                  border: '1px solid #2a2a4e',
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#00D4AA]" aria-hidden="true" />
                RFC3161 と独立して記録
              </span>
              {summary.present && (
                <a
                  href="https://contentcredentials.org/verify"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:text-white"
                  style={{
                    background: 'rgba(21,29,47,0.6)',
                    border: '1px solid #2a2a4e',
                  }}
                >
                  外部 C2PA verify
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </>
        ) : (
          <ConsoleCard icon={<Fingerprint className="h-3.5 w-3.5" />} title="VAULT EMPTY">
            <p className="text-[12px] leading-relaxed text-[#A8A0D8] font-mono">
              この作品には Content Credentials は埋め込まれていません。ProofMark は RFC3161 タイムスタンプによる外部証明を維持しつつ、
              C2PA が存在する場合のみ内部由来情報を静かに統合します。
            </p>
          </ConsoleCard>
        )}
      </div>
    </motion.section>
  );
}

function VaultMetric({
  icon,
  label,
  value,
  color,
  rgb,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
  rgb: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: PM_EASE }}
      className="rounded-2xl p-3.5 sm:p-4 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, rgba(21,29,47,0.7), rgba(13,11,36,0.6))',
        border: '1px solid #2a2a4e',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.025)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        aria-hidden
        className="absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl pointer-events-none opacity-50"
        style={{ background: color }}
      />

      <p className="relative flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#A8A0D8]">
        <span style={{ color }} className="flex items-center">
          {icon}
        </span>
        {label}
      </p>
      <p
        className="relative mt-2 text-sm font-semibold leading-snug text-white truncate"
        style={{ fontVariantNumeric: 'tabular-nums' }}
        title={value}
      >
        {value}
      </p>

      {/* underline accent */}
      <div
        className="relative mt-2.5 h-px w-full overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <div
          className="h-full w-1/3"
          style={{
            background: color,
            boxShadow: `0 0 8px rgba(${rgb}, 0.6)`,
          }}
        />
      </div>
    </motion.div>
  );
}

function ConsoleCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: 'rgba(21,29,47,0.55)',
        border: '1px solid #2a2a4e',
        backdropFilter: 'blur(8px)',
      }}
    >
      <p className="mb-2 flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.22em] text-[#A8A0D8]">
        <span className="text-[#6C3EF4]">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}
