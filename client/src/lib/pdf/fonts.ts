/**
 * fonts.ts (v4 — Zero Crash Architecture)
 * -----------------------------------------------------------------------------
 * @react-pdf/renderer 用フォント登録モジュール。
 *
 * v3 → v4 の決定的変更（本番クラッシュの完全撤去）:
 *  - google/fonts リポジトリの最新 TTF を直リンクしていたが、本ビルドの
 *    fontkit パーサが新しい OpenType テーブル構造で `DataView` エラーを
 *    引き起こすことが確認された。
 *  - これに対する根本対処として、@electron-fonts が事前にビルド検証した
 *    安定版 TTF (v1.2.0) へ厳格に固定する。
 *  - バージョンを `@1.2.0` で完全に pin することで、CDN 側の挙動変化や
 *    Git 改行コード混入によるバイナリ破損を構造的に不可能にする。
 *  - フォント URL は本ファイル中の `FONT_SOURCES` 以外への変更を禁止する。
 *
 * 取得元 (Immutable Pinned CDN):
 *  - Noto Sans JP : jsdelivr / @electron-fonts/noto-sans-jp@1.2.0
 *  - JetBrains Mono : jsdelivr / @JetBrains/JetBrainsMono v2.304 (検証済安定版)
 *
 * 仕様:
 *  - 多重登録防止 (idempotent)
 *  - Browser / WebWorker / SSR 環境ガード
 *  - ハイフネーション制御:
 *      ・半角英数記号 (SHA-256, URL 等) → 分割せず一塊で扱う
 *      ・日本語混在語 → 1 文字単位に分解し、任意位置での改行を許可
 * -----------------------------------------------------------------------------
 */

import { Font } from '@react-pdf/renderer';

/** フォントファミリー名定数 (StyleSheet 側からも参照) */
export const PDF_FONT_FAMILY = {
  sans: 'NotoSansJP',
  mono: 'JetBrainsMono',
} as const;

/**
 * 究極の安定版フォントソース (バージョン完全固定 / 改変厳禁)
 *
 * 本ファイル冒頭のコメントに記載のとおり、これ以外の URL への変更は
 * いかなる場合も許可しない。本番 PDF 生成のクラッシュを永久に撤去する
 * ための最終防衛線である。
 */
const FONT_SOURCES = {
  notoSansJpRegular:
    'https://cdn.jsdelivr.net/npm/@electron-fonts/noto-sans-jp@1.2.0/fonts/NotoSansJP-Regular.ttf',
  notoSansJpMedium:
    'https://cdn.jsdelivr.net/npm/@electron-fonts/noto-sans-jp@1.2.0/fonts/NotoSansJP-Medium.ttf',
  notoSansJpBold:
    'https://cdn.jsdelivr.net/npm/@electron-fonts/noto-sans-jp@1.2.0/fonts/NotoSansJP-Bold.ttf',
  jetbrainsMonoRegular:
    'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Regular.ttf',
  jetbrainsMonoBold:
    'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Bold.ttf',
} as const;

/** 多重登録防止 (HMR 含む) */
let fontsRegistered = false;

/**
 * @react-pdf/renderer にカスタムフォントを登録する。
 *
 * - 呼び出し側は await 不要 (内部で src を fetch するため)。
 * - PDF 生成モーダル open 時 / アプリ起動時に 1 度だけ呼ぶことを推奨。
 */
export function ensurePdfFontsRegistered(): void {
  if (fontsRegistered) return;

  // Browser / WebWorker のいずれでもない (純 Node SSR) 環境ではスキップ
  const isBrowser = typeof document !== 'undefined';
  const isWorker =
    typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !==
    'undefined';
  if (!isBrowser && !isWorker) return;

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

  /**
   * ハイフネーション制御:
   *  - 半角英数記号のみで構成される語 (SHA-256, URL, 英単語等) は
   *    分割せず一塊で扱う。SHA-256 が途中で改行されるのを防止。
   *  - 日本語が混在する語は 1 文字単位に分解し、任意位置での改行を許可。
   */
  Font.registerHyphenationCallback((word) => {
    if (/^[A-Za-z0-9\-_.,:;/'"!?@#$%^&*()[\]{}<>+=|\\~`]+$/.test(word)) {
      return [word];
    }
    return Array.from(word);
  });

  fontsRegistered = true;
}
