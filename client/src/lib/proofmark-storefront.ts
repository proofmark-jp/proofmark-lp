/**
 * proofmark-storefront.ts — Storefront 専用トークンと型 (SSOT 拡張)
 *
 * proofmark-ops.ts と意図的に**分離**している理由:
 *   • ops は内部 (Dashboard) 用の運用語彙、storefront は対外 (PublicProfile)
 *     用の演出語彙。混ぜると lint:copy の境界がぼやける。
 *   • 両者で重複する DeliveryStatus などは ops から re-export してこちらの
 *     名前空間に取り込む（再定義は禁止）。
 */

import {
  DELIVERY_STATUS_TOKENS,
  type DeliveryStatus,
  type StatusToken,
} from './proofmark-ops';

export { DELIVERY_STATUS_TOKENS };
export type { DeliveryStatus, StatusToken };

/* ── Verified Studio バッジ階層 ──────────────────────────────────────── */

export type VerifiedTier = 'unverified' | 'pending' | 'verified';

export interface VerifiedBadgeToken {
  tier: VerifiedTier;
  label: string;
  sublabel: string;
  color: string;
  border: string;
  bg: string;
  description: string;
}

export const VERIFIED_TOKENS: Record<VerifiedTier, VerifiedBadgeToken> = {
  verified: {
    tier: 'verified',
    label: 'Verified Studio',
    sublabel: 'ProofMark 認証済',
    color: '#00D4AA',
    border: 'rgba(0,212,170,0.45)',
    bg: 'rgba(0,212,170,0.10)',
    description:
      'ドメイン所有確認 + 監査チェーンが整合した法人プロフィール。第三者から検証可能。',
  },
  pending: {
    tier: 'pending',
    label: 'Verification Pending',
    sublabel: '認証手続き中',
    color: '#F0BB38',
    border: 'rgba(240,187,56,0.40)',
    bg: 'rgba(240,187,56,0.10)',
    description: 'ドメイン / メールでの所有確認を実施中です。',
  },
  unverified: {
    tier: 'unverified',
    label: 'Self-managed',
    sublabel: '本人申告',
    color: '#A8A0D8',
    border: 'rgba(168,160,216,0.30)',
    bg: 'rgba(168,160,216,0.08)',
    description:
      '本人申告のスタジオ情報。ProofMark による法人認証は完了していません。',
  },
};

/* ── NDA マスクの語彙 ─────────────────────────────────────────────── */

export type NdaMode = 'open' | 'masked' | 'hidden';

export const NDA_TOKENS: Record<NdaMode, { label: string; description: string }> = {
  open: {
    label: '公開実績',
    description: '画像と詳細を公開しています。',
  },
  masked: {
    label: 'NDA 締結中',
    description:
      '機密保持契約により素材は公開できませんが、暗号学的な存在事実は検証できます。',
  },
  hidden: {
    label: '非公開',
    description: '存在のみ。検証情報は公開しません。',
  },
};

/* ── TSA トラスト階層（PublicProfile でも宝石として表示） ──────────── */

export type TsaTier = 'cross' | 'trusted' | 'beta' | 'pending';

export interface TsaTierToken {
  tier: TsaTier;
  label: string;
  short: string;
  color: string;
  bg: string;
  border: string;
  rank: number; // 0 = 最も信頼が高い
  description: string;
}

export const TSA_TIER_TOKENS: Record<TsaTier, TsaTierToken> = {
  cross: {
    tier: 'cross',
    label: 'Cross-anchored',
    short: 'CROSS',
    color: '#FFD966',
    bg: 'rgba(255,217,102,0.10)',
    border: 'rgba(255,217,102,0.40)',
    rank: 0,
    description: '複数の TSA に多重発行された証明。単一障害耐性を持つ最上位の信頼レベル。',
  },
  trusted: {
    tier: 'trusted',
    label: 'Trusted TSA',
    short: 'TRUSTED',
    color: '#00D4AA',
    bg: 'rgba(0,212,170,0.10)',
    border: 'rgba(0,212,170,0.40)',
    rank: 1,
    description:
      '主要トラストストアに収録された商用 TSA による RFC3161 タイムスタンプ。',
  },
  beta: {
    tier: 'beta',
    label: 'Beta TSA',
    short: 'BETA',
    color: '#9BA3D4',
    bg: 'rgba(155,163,212,0.08)',
    border: 'rgba(155,163,212,0.30)',
    rank: 2,
    description:
      'β版 TSA(FreeTSA.org) による発行。RFC3161 として暗号的に有効ですが、商用 TSA への移行を予定。',
  },
  pending: {
    tier: 'pending',
    label: 'Issuing',
    short: 'PENDING',
    color: '#A8A0D8',
    bg: 'rgba(168,160,216,0.06)',
    border: 'rgba(168,160,216,0.25)',
    rank: 3,
    description: 'TSA 発行待ち。数秒以内にタイムスタンプが付与されます。',
  },
};

const TRUSTED_PROVIDERS = new Set(['digicert', 'globalsign', 'seiko', 'sectigo']);

/**
 * tsa_provider / has_timestamp / cross_anchors から TSA 階層を導く SSOT 関数。
 * UI 側で再実装しない (Dashboard の deriveTrustTier と整合)。
 */
export function deriveTsaTier(input: {
  tsa_provider?: string | null;
  has_timestamp?: boolean | null;
  cross_anchors?: number;
}): TsaTierToken {
  if (!input.has_timestamp) return TSA_TIER_TOKENS.pending;
  if ((input.cross_anchors ?? 0) >= 1) return TSA_TIER_TOKENS.cross;
  const provider = (input.tsa_provider ?? '').toLowerCase();
  if (TRUSTED_PROVIDERS.has(provider)) return TSA_TIER_TOKENS.trusted;
  return TSA_TIER_TOKENS.beta;
}

/* ── ハッシュ表示 (公開向け宝石化) ────────────────────────────────── */

/**
 * SHA-256 を 8-4-4-4 形式で短縮表示する。
 * "1F3A B7E2 9C0D 4188" のように 4 文字ブロックで読みやすくする。
 */
export function shortenHashBlocks(hash: string): string {
  if (!hash || hash.length < 16) return hash || '—';
  const lower = hash.toLowerCase();
  const head = lower.slice(0, 4);
  const next = lower.slice(4, 8);
  const tail1 = lower.slice(-8, -4);
  const tail2 = lower.slice(-4);
  return `${head} ${next} … ${tail1} ${tail2}`;
}

/** Time をシステマティックに ISO + 相対表記で返す */
export function formatProofTime(iso?: string | null): { absolute: string; relative: string } {
  if (!iso) return { absolute: '—', relative: '—' };
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { absolute: iso, relative: '—' };
  const d = new Date(iso);
  const absolute = d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }) + ' JST';
  const delta = (Date.now() - t) / 1000;
  let relative: string;
  if (delta < 60) relative = 'たった今';
  else if (delta < 3600) relative = `${Math.floor(delta / 60)}分前`;
  else if (delta < 86400) relative = `${Math.floor(delta / 3600)}時間前`;
  else if (delta < 86400 * 30) relative = `${Math.floor(delta / 86400)}日前`;
  else if (delta < 86400 * 365) relative = `${Math.floor(delta / 86400 / 30)}ヶ月前`;
  else relative = `${Math.floor(delta / 86400 / 365)}年前`;
  return { absolute, relative };
}
