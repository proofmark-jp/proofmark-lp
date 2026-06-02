/**
 * fonts.ts (v2)
 * -----------------------------------------------------------------------------
 * @react-pdf/renderer 用フォント登録モジュール。
 *
 * v1 からの変更点 (本番クラッシュ要因の撤去):
 *  - Google Fonts CDN (gstatic) からの動的ロードを廃止。
 *  - 自社ホスティング絶対パス (/fonts/...) に変更し、
 *    CDN 障害・CORS・トラッカーブロックによる読込失敗リスクを排除。
 *  - 本番 deploy 時に public/fonts/ に下記 5 ファイルを配置することが前提。
 *
 * 配置すべきファイル:
 *   public/fonts/
 *   ├── NotoSansJP-Regular.ttf
 *   ├── NotoSansJP-Medium.ttf
 *   ├── NotoSansJP-Bold.ttf
 *   ├── JetBrainsMono-Regular.ttf
 *   └── JetBrainsMono-Bold.ttf
 *
 * 取得元 (deploy 時のみ):
 *   - https://fonts.google.com/noto/specimen/Noto+Sans+JP (SIL OFL 1.1)
 *   - https://fonts.google.com/specimen/JetBrains+Mono   (SIL OFL 1.1)
 *
 * 仕様:
 *  - 多重登録防止 (idempotent)
 *  - SSR / Node 環境ガード
 *  - hyphenation 無効化 (SHA-256 が途中で改行されるのを防止)
 * -----------------------------------------------------------------------------
 */

import { Font } from '@react-pdf/renderer';

/** フォントファミリー名定数 */
export const PDF_FONT_FAMILY = {
  sans: 'NotoSansJP',
  mono: 'JetBrainsMono',
} as const;

/**
 * 自社ホスティング絶対パス。
 *
 * Vercel/Next/Vite いずれも `public/` 配下は `/fonts/...` で配信される。
 * もし配信ベースパスが異なる場合 (例: `/static/fonts/...`) は
 * 環境変数 `import.meta.env.VITE_FONTS_BASE` 等で書き換えられるよう
 * `FONT_BASE` に集約してある。
 */
const FONT_BASE = '/fonts';

// ブラウザのオリジン（URL）を動的に取得して絶対パス化する
const getBaseUrl = () => typeof window !== 'undefined' ? window.location.origin : '';

const FONT_SOURCES = {
  notoSansJpRegular: `${getBaseUrl()}/fonts/NotoSansJP-Regular.ttf`,
  notoSansJpMedium: `${getBaseUrl()}/fonts/NotoSansJP-Medium.ttf`,
  notoSansJpBold: `${getBaseUrl()}/fonts/NotoSansJP-Bold.ttf`,
  jetbrainsMonoRegular: `${getBaseUrl()}/fonts/JetBrainsMono-Regular.ttf`,
  jetbrainsMonoBold: `${getBaseUrl()}/fonts/JetBrainsMono-Bold.ttf`,
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

  // 日本語と英語/ハッシュを賢く判定するハイフネーションロジック
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
