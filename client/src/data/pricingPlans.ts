/**
 * Pricing SSOT
 * ─────────────────────────────────────────────
 * Home / Pricing / FAQ の値ズレ・特徴ズレを構造的に防ぐ。
 * 価格・機能・対象顧客の単一の正はこのファイルだけ。
 *
 * 設計：
 *  - Free は "本番に足りない" 設計（試用・入口）。
 *  - Spot はアカウント不要のワンショット販売。月額を嫌う層を回収。
 *  - Creator は "案件単位の証拠運用" の主戦場。
 *  - Studio はチーム / 監査 / 案件台帳 で LTV を取りに行く本命。
 *  - Business / API は今は表に出しすぎない（信頼基盤が整うまで保留）。
 */

export type PlanId = 'free' | 'spot' | 'creator' | 'studio' | 'business';

export interface PricingFeature {
  label: string;
  /** include: 含む / exclude: 含まない / planned: 提供予定 */
  state: 'include' | 'exclude' | 'planned';
  highlight?: 'accent' | 'gold' | 'primary';
  tooltip?: string;
  vaultIcon?: boolean;
}

export interface PricingPlan {
  id: PlanId;
  badge?: string;
  recommended?: boolean;
  name: string;
  tagline: string;
  priceLabel: string;
  priceUnit: string;
  audience: string;
  ctaLabel: { authed: string; guest: string };
  ctaHref: { authed: string; guest: string };
  features: PricingFeature[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'FREE',
    priceLabel: '¥0',
    priceUnit: '/ 月',
    audience: 'ProofMarkを試したい個人クリエイター',
    tagline: 'まずは試したい個人向け',
    features: [
      { label: 'Webタイムスタンプ証明 (月3件)', state: 'include' },
      { label: 'OpenSSL 独立検証可能', state: 'include' },
      { label: '※PDF・Evidence Pack発行不可', state: 'exclude' }
    ],
    ctaLabel: { guest: '無料で始める', authed: '現在のプラン' },
    ctaHref: { guest: '/auth?mode=signup', authed: '/dashboard' },
    recommended: false
  },
  {
    id: 'spot',
    name: 'SPOT',
    priceLabel: '¥480',
    priceUnit: '/ 件',
    audience: '単発で1案件だけEvidence Packを使いたい方',
    tagline: 'この1案件だけ、確実に守りたい',
    features: [
      { label: 'Evidence Pack (証明ZIP) 即時発行', state: 'include' },
      { label: 'クライアント納品用 高品質PDF', state: 'include' },
      { label: 'アカウント・カード登録不要', state: 'include' }
    ],
    ctaLabel: { guest: '今すぐ1件発行する', authed: '今すぐ1件発行する' },
    ctaHref: { guest: '/spot-issue', authed: '/spot-issue' },
    recommended: true
  },
  {
    id: 'creator',
    name: 'CREATOR',
    priceLabel: '¥1,480',
    priceUnit: '/ 月',
    audience: '受注クリエイター・有償案件を持つ個人',
    tagline: '毎月納品するプロクリエイター向け',
    features: [
      { label: '納品用 Evidence Pack (月50件)', state: 'include' },
      { label: 'ペルソナ切替 (本名/公開名義)', state: 'include' },
      { label: 'Shareable Proof (公開検証ページ)', state: 'include' }
    ],
    ctaLabel: { guest: '先行特典を予約する', authed: 'プランをアップグレード' },
    ctaHref: { guest: '/auth?mode=signup', authed: '/settings/billing' },
    recommended: false
  },
  {
    id: 'studio',
    name: 'Studio',
    tagline: 'チームで制作・複数案件を一元管理したい人向け',
    priceLabel: '¥4,980',
    priceUnit: '/月',
    audience: '小規模制作会社・チーム',
    ctaLabel: { authed: 'Studioに切り替える', guest: 'Studioを予約する' },
    ctaHref: { authed: '/settings#plan', guest: '/auth?mode=signup&plan=studio' },
    features: [
      { label: 'Creator のすべての機能', state: 'include' },
      { label: '納品用PDF証明書 ＆ Evidence Pack (証拠一式)：月150件発行', state: 'include' },
      { label: 'Evidence Vault (永久不変の原本ストレージ)', state: 'include', highlight: 'accent' },
      { label: '検証ページのホワイトラベル化（自社ロゴ）', state: 'planned' },
      { label: '複数席・監査ログ・Chain of Evidence', state: 'include' },
      { label: '案件単位のクライアント共有', state: 'include' },
    ],
  },
  {
    id: 'business',
    name: 'Business / API',
    tagline: 'API・SLA・商用TSAが必要な制作会社・出版社向け',
    priceLabel: 'お問い合わせ',
    priceUnit: '',
    audience: '制作会社・出版社・プラットフォーム',
    ctaLabel: { authed: '相談する', guest: '相談する' },
    ctaHref: { authed: '/contact', guest: '/contact' },
    features: [
      { label: 'API / Webhook', state: 'include' },
      { label: '商用TSA（GlobalSign/DigiCert級）への切替', state: 'include' },
      { label: 'SLA / DPA', state: 'include' },
      { label: '導入支援・監査証跡 / 長期検証 (LTV)', state: 'include' },
    ],
  },
];

export const FOUNDER_OFFER = {
  text: '※ 先着100名は Creator プラン 3ヶ月無料 + 創設者バッジ',
  highlight: '#BC78FF',
};

/**
 * Pricing 設計の前提（コードを編集する人へのメモ）
 * ─────────────────────────────────────────────
 *  1. 値の正は本ファイルのみ。Home.tsx / Pricing.tsx / Faq.tsx は
 *     PRICING_PLANS を import して描画すること（直書き禁止）。
 *  2. priceLabel と features の文言は、PROOFMARK_COPY と矛盾しないこと。
 *     特に "改ざん不可能" "法的に勝てる" 等の断定は禁止。
 *  3. Creator を ¥1,480 にしているのは「重要なものを安すぎて売らない」
 *     という意思決定。値下げ提案は Mixpanel/Posthog でのCVRデータ取得後に行う。
 *  4. Free は本番運用に足りない設計（PDFとEvidence Packを除外）にする。
 *     "Free無制限" は信頼商品では危険なので避ける。
 */
