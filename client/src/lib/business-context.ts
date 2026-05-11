/**
 * business-context.ts
 * ─────────────────────────────────────────────
 * B2B / B2C ルーティングの SSOT。
 *
 * 設計思想：
 *  - 個人クリエイター向け（B2C）は「開示請求ベース」の特商法で秘匿性を維持。
 *  - 法人決済（B2B）は「完全開示」モードで、法務・経理がワンクリックで承認できる状態に。
 *  - URL/クエリ/プランIDの3つから判定し、Tokushohoページの表示を切り替える。
 *
 *  CTOからのメモ：
 *    Stripe決済画面の特商法表記には「最終的な拘束力」があるため、
 *    B2Bフロー（/business 経由 or Studio/Business プラン決済）では
 *    必ず DISCLOSE_FULL モードで完全な氏名・住所・電話番号を表示すること。
 */

export type DisclosureMode = 'B2C_REQUEST_BASED' | 'B2B_FULL_DISCLOSURE';

/**
 * ルーティング判定ロジック。
 *  - location.pathname が /business で始まる → B2B
 *  - URLSearchParams に context=business が含まれる → B2B
 *  - URLSearchParams に plan=studio または plan=business → B2B
 *  - それ以外 → B2C（デフォルト）
 */
export function detectDisclosureMode(
  pathname: string,
  search: string,
): DisclosureMode {
  if (pathname.startsWith('/business')) return 'B2B_FULL_DISCLOSURE';

  const params = new URLSearchParams(search);
  const ctx = params.get('context');
  const plan = params.get('plan');

  if (ctx === 'business') return 'B2B_FULL_DISCLOSURE';
  if (plan === 'studio' || plan === 'business') return 'B2B_FULL_DISCLOSURE';

  return 'B2C_REQUEST_BASED';
}

/**
 * 特商法の動的レンダリングに使う運営者情報。
 * NOTE: 値そのものは Tokushoho.tsx 側で定数として保持しているため、
 *       本ファイルではキー名（どのフィールドを開示するか）だけ管理する。
 */
export interface DisclosureField {
  /** 表示モード B2C / B2B */
  visibleIn: DisclosureMode[];
  /** B2Cで表示する場合の置換テキスト（B2Cで非開示のフィールド向け） */
  b2cFallback?: string;
}

export const DISCLOSURE_POLICY: Record<string, DisclosureField> = {
  '販売業者':         { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '運営統括責任者':   {
    visibleIn: ['B2B_FULL_DISCLOSURE'],
    b2cFallback: '請求があった場合、書面で開示します（個別開示請求についてを参照）',
  },
  '所在地':           {
    visibleIn: ['B2B_FULL_DISCLOSURE'],
    b2cFallback: '請求があった場合、書面で開示します（個別開示請求についてを参照）',
  },
  'お問い合わせ':     { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '電話番号':         {
    visibleIn: ['B2B_FULL_DISCLOSURE'],
    b2cFallback: '請求に基づき遅滞なく開示します。日常の問い合わせはメールを推奨。',
  },
  '販売価格':         { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '商品代金以外の必要料金': { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '支払方法':         { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '支払時期':         { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '商品の引渡時期':   { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '解約・キャンセル': { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '返品・返金':       { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
  '動作環境':         { visibleIn: ['B2C_REQUEST_BASED', 'B2B_FULL_DISCLOSURE'] },
};

/**
 * 表示判定ヘルパー
 */
export function shouldShowField(
  fieldLabel: string,
  mode: DisclosureMode,
): boolean {
  const ALWAYS_SHOW = [
    '販売業者',
    '運営統括責任者',
    'お問い合わせ',
    '販売価格',
    '支払方法',
    '支払時期',
    '商品の引渡時期',
    '解約・キャンセル',
    '返品・返金',
  ];
  if (ALWAYS_SHOW.includes(fieldLabel)) return true;

  const policy = DISCLOSURE_POLICY[fieldLabel];
  if (!policy) return true; // 未定義は安全側で表示
  return policy.visibleIn.includes(mode);
}

export function getB2CFallback(fieldLabel: string): string | undefined {
  return DISCLOSURE_POLICY[fieldLabel]?.b2cFallback;
}
