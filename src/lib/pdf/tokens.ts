/**
 * tokens.ts (v2)
 * -----------------------------------------------------------------------------
 * PDF 専用デザイントークン — 証券レベル「重厚感と余白美」仕様。
 *
 * v1 からの変更点:
 *  - paper: '#FBFAF7' (クリーム) → '#FFFFFF' (純白)。トナー浪費を完全防止。
 *  - 純白に対し、各シェードを再キャリブレーション。
 *  - 信頼性を高める「Trust Ink」(ほぼ純黒だが青寄り) を新設。
 *
 * 設計指針:
 *  - 国内の証券、登記簿、公正証書に共通する「白紙 + 濃紺ベースのインク」を採用。
 *  - アクセントは ProofMark ブランド (Purple #6C3EF4 / Teal #00D4AA)。
 *  - グレースケールは灰色ではなく **微かに青を含む** ことで上品さを演出。
 * -----------------------------------------------------------------------------
 */

export const PDF_COLORS = {
  /** 紙の基色 — 純白 (トナー浪費なし、印刷時にコントラスト最大) */
  paper: '#FFFFFF',
  /** わずかに沈んだサブ面 (file tree / hash card 用) */
  paperSink: '#F6F7FB',
  /** さらに沈んだ強調面 (verifyCard など) */
  paperDeep: '#0E1024',

  /** 罫線 (薄→中→濃の 3 階調) */
  ruleSoft: '#EEF0F6',
  rule: '#DDE0EC',
  ruleStrong: '#9BA3C2',

  /** 本文インク */
  inkDeep: '#0B0D24', // タイトル・署名 (Trust Ink)
  ink: '#16182E', // 本文 body
  inkMuted: '#5A5E78', // ラベル
  inkSubtle: '#8A8FA8', // フッタ・キャプション
  inkWhisper: '#B8BCD0', // 罫線寄りのテキスト

  /** ブランドアクセント (アプリと共通, 単色のみ) */
  purple: '#6C3EF4',
  purpleDeep: '#4A24C9', // ホバー/濃シェード
  purpleSoft: '#8B6BF7',
  teal: '#00D4AA',
  tealDeep: '#00A88A',
  gold: '#F0BB38',
  goldDeep: '#B6841C',

  /** SEALED スタンプ */
  sealTeal: '#00D4AA',
  sealGold: '#F0BB38',
} as const;

/**
 * @react-pdf は CSS と同じ pt 単位。
 * A4 = 595.28 x 841.89 pt。
 */
export const PDF_LAYOUT = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginX: 56,
  marginTop: 56,
  marginBottom: 56,
} as const;

/**
 * タイポグラフィの行間トークン (証券・法務文書向けの「読ませる」値)。
 *  - tight: タイトル
 *  - body : 通常本文 (1.6 程度) — 宣言文はこれを使う
 *  - airy : 長文セクション・添え状
 */
export const PDF_LEADING = {
  tight: 1.18,
  normal: 1.45,
  body: 1.6,
  airy: 1.8,
} as const;

/** トラッキング (letter-spacing) — 法務文書らしい威圧感のために */
export const PDF_TRACKING = {
  eyebrow: 4.5, // 「DECLARATION」「EVIDENCE OF AUTHENTICITY」
  brand: 3.2, // 「PROOFMARK」 ワードマーク
  label: 2.2, // メタラベル「FILE NAME」など
  small: 1.4,
  none: 0,
} as const;
