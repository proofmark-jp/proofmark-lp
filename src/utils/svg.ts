/**
 * src/utils/svg.ts
 *
 * SVG文字列定数および純粋な操作関数のモジュール。
 * Edge Runtime, Node.js Runtime, およびフロントエンドブラウザ間で
 * 完全に互換性を持つよう、Web標準APIのみを使用して設計。
 */

export const PM_BADGE_VERIFIED_SVG: string = `
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

export const PM_SEAL_SVG: string = `
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

export function svgToDataUri(svg: string): string {
    // btoa を用いた堅牢な UTF-8 → Base64 エンコーディング。Edge Runtime に完全準拠。
    const encoded: string = encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_: string, p1: string) => {
        return String.fromCharCode(parseInt(p1, 16));
    });
    return `data:image/svg+xml;base64,${btoa(encoded)}`;
}
