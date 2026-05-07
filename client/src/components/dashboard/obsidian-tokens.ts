/**
 * obsidian-tokens.ts — The Obsidian Desk Design Tokens
 *
 * tailwind.config.js の `pm.*` カラーと完全に整合する単一定義源。
 * UI ラッパーは色・モーション・ボーダーをすべてここから引く。
 * Tailwind クラスでは表現できない RGBA / cubic-bezier / box-shadow を補完するためだけに存在し、
 * Tailwind トークンと重複しない範囲に限定する（再発明の禁止）。
 */

export const PM = {
  /** 黒曜石の背景。tailwind.config.js: pm.background */
  bg: '#07061A',
  /** ドロップゾーンや履歴行のサーフェス */
  surface: 'rgba(255, 255, 255, 0.025)',
  surfaceHover: 'rgba(255, 255, 255, 0.045)',
  surfaceActive: 'rgba(108, 62, 244, 0.06)',

  /** ボーダー（既存 `pm.border` と同義） */
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',

  /** ブランドカラー */
  primary: '#6C3EF4',
  primaryHover: '#8B61FF',
  primarySoft: 'rgba(108, 62, 244, 0.16)',
  primaryRing: 'rgba(108, 62, 244, 0.45)',

  /** Trust / Verified */
  success: '#00D4AA',
  successSoft: 'rgba(0, 212, 170, 0.12)',
  successRing: 'rgba(0, 212, 170, 0.40)',

  /** Warning / NDA */
  warning: '#F0BB38',
  warningSoft: 'rgba(240, 187, 56, 0.12)',

  /** Error */
  error: '#FF453A',
  errorSoft: 'rgba(255, 69, 58, 0.10)',
  errorRing: 'rgba(255, 69, 58, 0.45)',

  /** テキスト階層（pm.text.* と同義） */
  textMain: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.55)',
  textSubtle: 'rgba(255, 255, 255, 0.30)',
  textWhisper: 'rgba(255, 255, 255, 0.16)',
} as const;

/** Apple 基準のイージング（tailwind.config.js: pm-ease と同一） */
export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** モーションは寡黙に。durations は ms 単位で統一する。 */
export const D = {
  fast: 160,
  base: 240,
  slow: 420,
  hero: 720,
} as const;

/** Glow 影。既存 boxShadow.pm-glow-* と整合する。 */
export const GLOW = {
  primary: '0 0 30px rgba(108, 62, 244, 0.18), 0 0 1px rgba(108, 62, 244, 0.40) inset',
  success: '0 0 40px rgba(0, 212, 170, 0.20), 0 0 1px rgba(0, 212, 170, 0.40) inset',
  error: '0 0 28px rgba(255, 69, 58, 0.18), 0 0 1px rgba(255, 69, 58, 0.40) inset',
} as const;
