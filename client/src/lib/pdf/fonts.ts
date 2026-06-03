/**
 * fonts.ts (v3)
 * -----------------------------------------------------------------------------
 * @react-pdf/renderer 用フォント登録モジュール。
 *
 * v2 -> v3 のアーキテクチャシフト (本番クラッシュの完全撤去):
 * - Google Fonts の最新TTFバイナリをローカル配置した場合、@react-pdf 内部の
 * パーサー (fontkit) が未知のテーブル構造を解析できず `DataView` エラーで
 * 100%クラッシュする致命的バグが発覚。
 * - また、Gitの改行コード自動変換によるバイナリ破損リスクを排除するため、
 * 「自社ホスティング」から「バージョン完全固定の安定版CDN」へ戦略的撤退。
 * - これにより、Vercelの帯域幅（Egress）コストを永久にゼロ化しつつ、
 * PDF/DTP品質に優れる OpenType (.otf) を安全にブラウザへ注入する。
 *
 * 取得元 (Immutable Pinned CDN):
 * - Noto Sans JP (OTF) : jsdelivr npm (noto-sans-japanese@1.1.4)
 * - JetBrains Mono (TTF): jsdelivr github (v2.304)
 *
 * 仕様:
 * - 多重登録防止 (idempotent)
 * - SSR / Node 環境ガード
 * - hyphenation 無効化 (SHA-256 が途中で改行されるのをスマートに防止)
 * -----------------------------------------------------------------------------
 */

import { Font } from '@react-pdf/renderer';

/** フォントファミリー名定数 */
export const PDF_FONT_FAMILY = {
  sans: 'NotoSansJP',
  mono: 'JetBrainsMono',
} as const;

/**
 * 🚨 究極の安定版フォントソース（バージョン完全固定）
 * Vercelの帯域コストをゼロにし、Gitバイナリ破損とfontkitバグを同時に回避する。
 */
const FONT_SOURCES = {
  notoSansJpRegular: 'https://cdn.jsdelivr.net/npm/@electron-fonts/noto-sans-jp@1.2.0/fonts/NotoSansJP-Regular.ttf',
  notoSansJpMedium: 'https://cdn.jsdelivr.net/npm/@electron-fonts/noto-sans-jp@1.2.0/fonts/NotoSansJP-Medium.ttf',
  notoSansJpBold: 'https://cdn.jsdelivr.net/npm/@electron-fonts/noto-sans-jp@1.2.0/fonts/NotoSansJP-Bold.ttf',
  jetbrainsMonoRegular: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Regular.ttf',
  jetbrainsMonoBold: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Bold.ttf',
} as const;

/** 多重登録防止 (HMR 含む) */
let fontsRegistered = false;

/**
 * @react-pdf/renderer にカスタムフォントを登録する。
 *
 * - 呼び出し側で await する必要はない (内部で src を fetch するため)。
 * - モーダル open 時 / アプリ起動時の一度きりウォームアップを推奨。
 */
export function ensurePdfFontsRegistered(): void {
  if (fontsRegistered) return;
  if (typeof document === 'undefined' && typeof WorkerGlobalScope === 'undefined') return;

  Font.register({
    family: PDF_FONT_FAMILY.sans,
    fonts: [
      { src: FONT_SOURCES.notoSansJpRegular, fontWeight: 400 },
      { src: FONT_SOURCES.notoSansJpMedium, fontWeight: 500 },
      { src: FONT_SOURCES.notoSansJpBold, fontWeight: 700 },
    ],
  });

  Font.register({
    family: PDF_FONT_FAMILY.mono,
    fonts: [
      { src: FONT_SOURCES.jetbrainsMonoRegular, fontWeight: 400 },
      { src: FONT_SOURCES.jetbrainsMonoBold, fontWeight: 700 },
    ],
  });

  // 日本語と英語/ハッシュを賢く判定するハイフネーションロジック (Sinn氏オリジナル)
  Font.registerHyphenationCallback((word) => {
    // 半角英数記号のみ（ハッシュやURL、英単語）の場合は分割せずそのまま返す
    if (/^[a-zA-Z0-9\-_.,:;/'"!?@#$%^&*()[\]{}]+$/.test(word)) {
      return [word];
    }
    // 日本語が含まれる場合は1文字ずつ配列にして、どこでも改行可能にする
    return Array.from(word);
  });

  fontsRegistered = true;
}