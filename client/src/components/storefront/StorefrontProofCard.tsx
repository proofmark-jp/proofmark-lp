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
  onOpenAudit?: (cert: StorefrontCertModel) => void;
}

const NDA_VISIBILITY = new Set(['unlisted', 'private']);

export function StorefrontProofCard({ cert, chainOk, ndaMode = 'masked', onOpenAudit }: Props) {
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
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
          ) : (
            <NdaMaskCanvas hash={sha} />
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
 * NdaMaskCanvas — 暗号ハッシュを「グリッド模様の機密キャンバス」に変換する。
 * 64 文字の SHA-256 を 8x8 のドットマトリクスに投影し、各セルは hex 値の輝度で
 * 微妙に変化する。NDA を「黒塗り」せず、敬意を持って表現する。
 */
function NdaMaskCanvas({ hash }: { hash: string }) {
  const safe = (hash || '').padEnd(64, '0').slice(0, 64).toLowerCase();
  // 8x8 = 64 dots
  const cells = Array.from(safe).map((ch) => {
    const v = parseInt(ch, 16);
    const opacity = 0.10 + (v / 15) * 0.40;
    return opacity;
  });
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        background:
          'radial-gradient(circle at 30% 25%, rgba(108,62,244,0.18), transparent 65%), radial-gradient(circle at 75% 80%, rgba(0,212,170,0.10), transparent 60%), #0a0e27',
      }}
      aria-hidden="true"
    >
      <div
        className="grid gap-[6px] opacity-70"
        style={{
          gridTemplateColumns: 'repeat(8, 14px)',
          gridTemplateRows: 'repeat(8, 14px)',
        }}
      >
        {cells.map((op, i) => (
          <span
            key={i}
            style={{
              background: `rgba(240, 240, 250, ${op.toFixed(3)})`,
              borderRadius: 3,
              width: 14,
              height: 14,
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#a0a0c0]/70">
        <FileImage className="w-3 h-3" aria-hidden="true" />
        Confidential · Cryptographically Verified
        <EyeOff className="w-3 h-3" aria-hidden="true" />
      </div>
    </div>
  );
}
