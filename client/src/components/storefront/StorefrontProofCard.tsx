/**
 * StorefrontProofCard — 公開プロフィール用「宝石化」された証明書カード。
 *
 * 設計原則:
 *   1. ハッシュ・RFC3161・チェーン整合は「ギーク文字情報」ではなく、
 *      宝石のように 1 行に凝縮した "Trust Strip" として配置する。
 *   2. visibility != 'public' の素材は隠さず、NDA マスクとして
 *      美しく表現する（暗号 SHA-256 グリッドを背景に「機密」を匂わせる）。
 *   3. クリック導線は /cert/<id>。Hover で微妙な lift とアクセントの glow。
 *   4. 配色は CSS 変数 + ハードコード hex (Manus DNA) のみ。
 */

import { motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Eye, EyeOff, FileImage, Hash, Layers3, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import {
  deriveTsaTier,
  shortenHashBlocks,
  formatProofTime,
  NDA_TOKENS,
  type NdaMode,
} from '../../lib/proofmark-storefront';

export interface StorefrontCertModel {
  id: string;
  title: string;
  proven_at: string | null;
  certified_at: string | null;
  sha256: string | null;
  tsa_provider: string | null;
  has_timestamp: boolean;
  proof_mode: string | null;
  visibility: string | null;
  public_image_url: string | null;
  delivery_status: string | null;
  project_id: string | null;
  badge_tier: string | null;
}

interface Props {
  cert: StorefrontCertModel;
  /** 親で監査チェーン整合のフェッチ結果がある場合のみ true / false。未取得は undefined。 */
  chainOk?: boolean;
  ndaMode?: NdaMode;
  /** 現在の閲覧者がこの証明書のオーナーか否か */
  isOwner?: boolean;
  onOpenAudit?: (cert: StorefrontCertModel) => void;
}

const NDA_VISIBILITY = new Set(['unlisted', 'private']);

export function StorefrontProofCard({ cert, chainOk, ndaMode = 'masked', isOwner = false, onOpenAudit }: Props) {
  const isMasked = NDA_VISIBILITY.has(cert.visibility ?? 'public') || ndaMode !== 'open';
  const ndaToken = isMasked ? NDA_TOKENS[ndaMode] : NDA_TOKENS.open;
  const tsa = deriveTsaTier({
    tsa_provider: cert.tsa_provider,
    has_timestamp: cert.has_timestamp,
  });
  const time = formatProofTime(cert.proven_at ?? cert.certified_at);
  const sha = cert.sha256 ?? '';

  return (
    <motion.article
      initial="initial"
      animate="animate"
      whileHover="hover"
      variants={{
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        hover: { y: -3 },
      }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-[calc(0.65rem+2px)] border border-[#2a2a4e] bg-[#151d2f] transition-shadow"
      style={{
        // ホバー時の glow は CSS class で
      }}
      aria-label={`${cert.title} — ${tsa.label}`}
    >
      <a
        href={`/cert/${cert.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e27]"
      >
        {/* ── Visual ─────────────────────────────────────────── */}
        <div className="relative aspect-[4/3] bg-[#0a0e27] overflow-hidden">
          {!isMasked && cert.public_image_url ? (
            <img
              src={cert.public_image_url}
              alt={cert.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : isOwner && cert.public_image_url ? (
            <TranslucentVault imageUrl={cert.public_image_url} />
          ) : isOwner ? (
            <OwnerVault />
          ) : (
            <TheVault />
          )}

          {/* TSA 階層バッジ (右上、宝石) */}
          <span
            className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              color: tsa.color,
              background: tsa.bg,
              border: `1px solid ${tsa.border}`,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            title={tsa.description}
          >
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            {tsa.short}
          </span>

          {/* NDA バッジ (左上) */}
          {isMasked && (
            <span
              className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                color: '#FFD966',
                background: 'rgba(255,217,102,0.12)',
                border: '1px solid rgba(255,217,102,0.40)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
              title={ndaToken.description}
            >
              <Lock className="w-2.5 h-2.5" aria-hidden="true" />
              {ndaToken.label}
            </span>
          )}
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="p-4 sm:p-5">
          <h3
            className="font-display font-bold text-[15px] sm:text-[16px] text-[#f0f0fa] leading-snug truncate"
            title={cert.title}
          >
            {cert.title}
          </h3>

          {/* Trust strip: ハッシュ + 時刻 + Chain integrity */}
          <dl className="mt-3 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center gap-2 text-[#a0a0c0]">
              <Hash className="w-3 h-3 shrink-0" aria-hidden="true" />
              <dt className="sr-only">SHA-256</dt>
              <dd
                className="font-mono tabular-nums text-[#f0f0fa]/80 truncate"
                title={sha}
              >
                {shortenHashBlocks(sha)}
              </dd>
            </div>
            <div className="flex items-center gap-2 text-[#a0a0c0]">
              <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
              <dt className="sr-only">RFC3161</dt>
              <dd className="text-[#f0f0fa]/75">
                {cert.has_timestamp ? 'RFC3161 timestamped' : 'Awaiting TSA'} ·{' '}
                <time
                  dateTime={cert.proven_at ?? cert.certified_at ?? undefined}
                  title={time.absolute}
                  className="text-[#a0a0c0]"
                >
                  {time.relative}
                </time>
              </dd>
            </div>
            {chainOk !== undefined && (
              <div className="flex items-center gap-2">
                <Layers3
                  className="w-3 h-3 shrink-0"
                  aria-hidden="true"
                  style={{ color: chainOk ? '#00D4AA' : '#E74C3C' }}
                />
                <dt className="sr-only">Audit chain</dt>
                <dd
                  className="text-[11px]"
                  style={{ color: chainOk ? '#7FE9C7' : '#FCA5A5' }}
                >
                  {chainOk
                    ? '監査チェーン整合・改ざん検知済'
                    : 'チェーン警告 — 検証ページで詳細を確認'}
                </dd>
              </div>
            )}
          </dl>

          {/* CTA: 検証 / 履歴 */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
              style={{ color: '#00D4AA' }}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              この素材を検証する
            </span>
            {onOpenAudit && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenAudit(cert);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[calc(0.65rem-4px)] border border-[#2a2a4e] hover:border-[#6C3EF4]/60 text-[10px] text-[#a0a0c0] hover:text-[#f0f0fa] transition-colors"
                aria-label="監査履歴を開く"
              >
                <Eye className="w-3 h-3" aria-hidden="true" />
                履歴
              </button>
            )}
          </div>
        </div>
      </a>
    </motion.article>
  );
}

/* ─────────────────────────────────────────────────────────── */

/**
 * The Vault — プレミアムな機密保管庫UX
 * 物理的なチタンや石板の質感を持ち、極秘性を表現する。
 */
function TheVault() {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center cursor-default overflow-hidden"
            style={{
              backgroundColor: '#0a0e27',
              backgroundImage: 'radial-gradient(circle at center, rgba(108,62,244,0.08) 0%, transparent 60%)',
            }}
          >
            {/* 走査線・チタンテクスチャ */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)',
                mixBlendMode: 'overlay',
              }}
            />

            {/* The Lock Mechanism */}
            <div className="relative mb-3 flex items-center justify-center">
              {/* Glow Behind Lock */}
              <motion.div
                variants={{
                  initial: { opacity: 0, scale: 0.8 },
                  animate: { opacity: 0, scale: 0.8 },
                  hover: { opacity: 1, scale: 1 },
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: '0 0 20px rgba(0, 212, 170, 0.4)',
                }}
              />

              <motion.div
                variants={{
                  initial: { y: 0, color: '#6c3ef4', opacity: 0.5 },
                  animate: { y: 0, color: '#6c3ef4', opacity: 0.5 },
                  hover: { y: -4, color: '#00d4aa', opacity: 1 },
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative z-10"
              >
                <Lock className="w-8 h-8" />
              </motion.div>
            </div>

            {/* Typography */}
            <h4 className="relative z-10 font-bold tracking-wide text-[#f0f0fa] text-sm/none mb-1.5 opacity-90">
              NDA Protected
            </h4>
            <p className="relative z-10 font-mono text-[10px] tracking-widest text-[#00d4aa] opacity-70">
              ZERO-KNOWLEDGE ENCRYPTION
            </p>
          </div>
        </Tooltip.Trigger>

        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={8}
            className="z-50 max-w-[280px] px-4 py-3 rounded-xl shadow-2xl text-xs leading-relaxed"
            style={{
              backgroundColor: '#151d2f',
              border: '1px solid #2a2a4e',
              color: '#a0a0c0',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              この作品は機密保持契約（NDA）に基づき、高度な暗号化技術で保護されています。元の画像はクリエイターのローカル環境から一切送信されていません。
            </motion.div>
            <Tooltip.Arrow className="fill-[#2a2a4e] w-3 h-1.5" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/* ─────────────────────────────────────────────────────────── */

/**
 * TranslucentVault — オーナー専用のすりガラスプレビュー。
 * 実画像を極度のBlur + モノクロ化で表示し、中央にウォーターマークを重ねる。
 * これにより「どれがどの案件か」がオーナーにだけ判別できる。
 */
function TranslucentVault({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Blurred + Grayscale actual image */}
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
        style={{
          filter: 'blur(16px) grayscale(100%) opacity(0.6)',
        }}
      />
      {/* Watermark overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0e27]/40">
        <motion.div
          variants={{
            initial: { y: 0, opacity: 0.6 },
            animate: { y: 0, opacity: 0.6 },
            hover: { y: -2, opacity: 1 },
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Lock className="w-6 h-6 text-[#f0f0fa]/60 mb-2 mx-auto" />
        </motion.div>
        <span className="font-bold text-[11px] tracking-wider text-[#f0f0fa]/70 uppercase">
          Owner Preview
        </span>
        <span className="font-mono text-[9px] tracking-widest text-[#00d4aa]/50 uppercase mt-0.5">
          NDA Protected
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

/**
 * OwnerVault — オーナー用の「識別可能な石板」。
 * 実画像URLが存在しない場合でも、本人だけがオーナーと分かる
 * パープルアクセントの石板を表示する。
 */
function OwnerVault() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center cursor-default overflow-hidden"
      style={{
        backgroundColor: '#0a0e27',
        backgroundImage: 'radial-gradient(circle at center, rgba(108,62,244,0.12) 0%, transparent 60%)',
      }}
    >
      {/* 走査線 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)',
          mixBlendMode: 'overlay',
        }}
      />
      <motion.div
        variants={{
          initial: { y: 0, opacity: 0.5 },
          animate: { y: 0, opacity: 0.5 },
          hover: { y: -4, opacity: 1 },
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="mb-3"
      >
        <Lock className="w-8 h-8 text-[#6c3ef4]" />
      </motion.div>
      <h4 className="relative z-10 font-bold tracking-wide text-[#f0f0fa] text-sm/none mb-1 opacity-90">
        NDA Protected
      </h4>
      <span className="font-mono text-[9px] tracking-widest text-[#6c3ef4] opacity-70 uppercase">
        Owner View
      </span>
    </div>
  );
}
