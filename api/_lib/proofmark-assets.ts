/**
 * proofmark-assets.ts
 *
 * - Satori が必要とする日本語フォント (Noto Sans JP) を Google Fonts から
 *   一度だけ fetch し、Lambda 寿命中はメモリキャッシュ。
 * - ProofMark の Verified バッジ SVG / favicon SVG を「文字列定数」として
 *   直接保持する（FS / network I/O を経由しない＝Vercel の歴史的事故を回避）。
 */

let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

/**
 * Google Fonts CSS API → woff2 ではなく ttf を取りに行く。
 * Satori は ttf / otf を要求するため、user-agent を明示的に古いものにする。
 */
async function fetchGoogleFontTTF(family: string, weight: number): Promise<ArrayBuffer> {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap&subset=japanese`;

    const cssRes = await fetch(cssUrl, {
        headers: {
            // Modern UA → woff2 が返ってきて Satori が読めない
            // 古い UA (IE9) → ttf が返ってくる
            'User-Agent':
                'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
        },
    });
    if (!cssRes.ok) {
        throw new Error(`Google Fonts CSS fetch failed: ${cssRes.status}`);
    }
    const css = await cssRes.text();
    // url(https://...ttf) の最初の 1 件を抜く
    const match = css.match(/url\((https:\/\/[^)]+\.ttf)\)/);
    if (!match) {
        throw new Error('Google Fonts CSS: no TTF url found');
    }
    const ttfRes = await fetch(match[1]);
    if (!ttfRes.ok) {
        throw new Error(`Google Fonts TTF fetch failed: ${ttfRes.status}`);
    }
    return ttfRes.arrayBuffer();
}

export async function loadProofmarkFonts(): Promise<{
    regular: ArrayBuffer;
    bold: ArrayBuffer;
}> {
    if (fontCache) return fontCache;

    const [regular, bold] = await Promise.all([
        fetchGoogleFontTTF('Noto+Sans+JP', 500),
        fetchGoogleFontTTF('Noto+Sans+JP', 800),
    ]);

    fontCache = { regular, bold };
    return fontCache;
}

/* ─────────────────────────────────────────────
 *  Inline SVG strings — 一切 fetch しない
 * ───────────────────────────────────────────── */

/**
 * Verified バッジ (六角石板に check)。Satori で <img src="data:image/svg+xml;..."/>
 * として取り込むため、外部 XML 宣言は除去している。
 */
export const PM_BADGE_VERIFIED_SVG = `
<svg width="72" height="72" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bv-fi" cx="50%" cy="48%" r="52%">
      <stop offset="0%" stop-color="#6C3EF4" stop-opacity=".09"/>
      <stop offset="100%" stop-color="#00D4AA" stop-opacity=".02"/>
    </radialGradient>
    <linearGradient id="bv-ri" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#5830CC"/>
      <stop offset="100%" stop-color="#00B896"/>
    </linearGradient>
    <linearGradient id="bv-ck" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00C49A"/>
      <stop offset="55%" stop-color="#5ED4CB"/>
      <stop offset="100%" stop-color="#D4F0FF"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="#0D0B24"/>
  <polygon points="50,12 82,30 82,70 50,88 18,70 18,30" fill="url(#bv-fi)"/>
  <polygon points="50,12 82,30 82,70 50,88 18,70 18,30" fill="none" stroke="url(#bv-ri)" stroke-width=".6" opacity=".15"/>
  <path d="M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 88,26 L 84,28 L 78,20 Z"
        fill="none" stroke="url(#bv-ri)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>
  <g stroke="#00B896" stroke-linecap="round" opacity=".24">
    <line x1="50" y1="4" x2="50" y2="11" stroke-width="1.1"/>
    <line x1="50" y1="4" x2="50" y2="11" transform="rotate(60,50,50)" stroke-width="1.1"/>
    <line x1="50" y1="4" x2="50" y2="11" transform="rotate(120,50,50)" stroke-width="1.1"/>
    <line x1="50" y1="4" x2="50" y2="11" transform="rotate(180,50,50)" stroke-width="1.1"/>
    <line x1="50" y1="4" x2="50" y2="11" transform="rotate(240,50,50)" stroke-width="1.1"/>
    <line x1="50" y1="4" x2="50" y2="11" transform="rotate(300,50,50)" stroke-width="1.1"/>
  </g>
  <polygon points="18,46 28,46 40,60 78,22 82,27 37,69 24,57" fill="url(#bv-ck)" fill-opacity=".88"/>
</svg>
`.trim();

/**
 * ProofMark シール（favicon-svg と同等）。watermark のメインビジュアル。
 */
export const PM_SEAL_SVG = `
<svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pp32-ri" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#5830CC"/>
      <stop offset="100%" stop-color="#00B896"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="#0D0B24"/>
  <path d="M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 87,25 L 82,29 L 76,18 Z"
        fill="none" stroke="url(#pp32-ri)" stroke-width="3.8"
        stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>
  <polygon points="17,46 27,47 39,62 79,22 83,28 36,70 23,58" fill="#00D4AA"/>
</svg>
`.trim();

/* ─────────────────────────────────────────────
 *  utility: SVG → data: URL (Satori の <img> 用)
 * ───────────────────────────────────────────── */
export function svgToDataUri(svg: string): string {
    // Base64 化（特殊文字エスケープより安全 / Satori の HTML パーサで確実）
    const b64 = Buffer.from(svg, 'utf-8').toString('base64');
    return `data:image/svg+xml;base64,${b64}`;
}
