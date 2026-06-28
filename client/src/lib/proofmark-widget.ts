// shared/proofmark-widget.ts
/**
 * proofmark-widget.ts — The Parasitic Payload
 * ────────────────────────────────────────────────────────────────
 * Twitter-style oEmbed snippet for ProofMark.
 *
 *   <blockquote class="proofmark-embed" data-proofmark-id="…">
 *     <a href="https://proofmark.jp/cert/…">ProofMark Verified: …</a>
 *   </blockquote>
 *   <script async src="https://proofmark.jp/embed.js" charset="utf-8"></script>
 *
 * Why a <blockquote>?
 *   - SEO crawlers can read the link text BEFORE embed.js hydrates → ranking juice.
 *   - Screen readers see a real anchor → accessibility for free.
 *   - If JS is blocked, users still get a clickable certificate link → graceful.
 *   - embed.js can replace the blockquote with the kinetic iframe at its leisure.
 *
 * No iframe builders. No legacy portfolio HTML. This is the only export.
 */

const PROOFMARK_ORIGIN = 'https://proofmark.jp';

/** Strict HTML-attribute escaper (titles often contain ", &, <, >, '). */
function escapeHtmlAttr(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Conservative ID sanitizer — UUID/slug-safe characters only. */
function sanitizeId(id: string): string {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

/**
 * Build the canonical ProofMark embed snippet.
 *
 * @param id     Certificate id or public_verify_token.
 * @param title  Human-readable work title (used in fallback link text).
 * @returns      Self-contained HTML snippet ready to paste into Notion/STUDIO/etc.
 */
export function buildParasiticSnippet(id: string, title: string): string {
  const safeId = sanitizeId(id);
  const safeTitleAttr = escapeHtmlAttr(title || 'Untitled Work');

  return `<blockquote class="proofmark-embed" data-proofmark-id="${safeId}">
  <a href="${PROOFMARK_ORIGIN}/cert/${safeId}">ProofMark Verified: ${safeTitleAttr}</a>
</blockquote>
<script async src="${PROOFMARK_ORIGIN}/embed.js" charset="utf-8"></script>`;
}
