/**
 * api/og-vault.ts
 * ──────────────────────────────────────────────────────────────────
 *   ProofMark "The Vault Slab" — SNS シェア用 OGP 画像 (1200 × 630 PNG)
 *
 *   Runtime: Node.js (NOT Edge / NOT @vercel/og)
 *   Render : satori + satori-html + @resvg/resvg-js
 *
 * 履歴的事故への対策:
 *   - @vercel/og / next/og の WASM 解決崩壊を避けるため一切使用しない
 *   - 外部画像 (SVG含む) は fetch せず Raw 文字列を inline 展開
 *   - フォントは module-level cache → 同 Lambda 寿命中の cold start を圧縮
 *   - Supabase 取得失敗時はクラッシュではなく 200 OK のフォールバック OGP
 * ──────────────────────────────────────────────────────────────────
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';

import {
    deriveTrustTier,
    type TrustDescriptor,
} from './_lib/proofmark-trust.js';
import {
    loadProofmarkFonts,
    PM_BADGE_VERIFIED_SVG,
    PM_SEAL_SVG,
    svgToDataUri,
} from './_lib/proofmark-assets.js';
import {
    fetchCertificateForOG,
    type VaultCertificate,
} from './_lib/proofmark-supabase.js';

export const config = { runtime: 'nodejs', maxDuration: 60 };

const WIDTH = 1200;
const HEIGHT = 630;

/* ─────────────────────────────────────────────
 *  Color tokens (obsidian-tokens.ts と完全一致)
 * ───────────────────────────────────────────── */

const PM = {
    bg: '#07061A',
    bgPanel: '#0D0B24',
    border: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.20)',
    primary: '#6C3EF4',
    success: '#00D4AA',
    warning: '#F0BB38',
    textMain: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.62)',
    textWhisper: 'rgba(255,255,255,0.34)',
    founder: '#BC78FF',
} as const;

/* ─────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────── */

function shortenHash(sha256: string): { head: string; tail: string } {
    const clean = sha256.replace(/[^0-9a-f]/gi, '').toLowerCase();
    if (clean.length < 16) return { head: clean, tail: '' };
    return {
        head: clean.slice(0, 24),
        tail: clean.slice(-8),
    };
}

function safeText(value: string | null | undefined, fallback: string): string {
    const trimmed = (value ?? '').trim();
    return trimmed.length === 0 ? fallback : trimmed;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    // YYYY.MM.DD HH:mm JST
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    return fmt.format(date).replace(/-/g, '.').replace(',', '');
}

/* ─────────────────────────────────────────────
 *  Layout builder — Vault Slab
 *
 *  raw HTML/CSS を `html\`` で構築する (JSX 不要)。
 *  Satori は flex のみサポートのため、すべて flex で組む。
 * ───────────────────────────────────────────── */

interface SlabInput {
    title: string;
    sha256: string;
    trust: TrustDescriptor;
    certifiedAt: string;
    authorLabel: string;
    isFounder: boolean;
    proofMode: string | null;
}

function buildVaultSlab(input: SlabInput): ReturnType<typeof html> {
    const hash = shortenHash(input.sha256);
    const sealDataUri = svgToDataUri(PM_SEAL_SVG);
    const badgeDataUri = svgToDataUri(PM_BADGE_VERIFIED_SVG);

    // Status row のチップ群
    const founderChip = input.isFounder
        ? `
      <div style="
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px; border-radius: 999px;
        background: rgba(188,120,255,0.10);
        border: 1px solid rgba(188,120,255,0.40);
        color: ${PM.founder}; font-size: 18px; font-weight: 800;
      ">
        <div style="display:flex;width:8px;height:8px;border-radius:999px;background:${PM.founder};box-shadow:0 0 12px ${PM.founder};"></div>
        FOUNDER
      </div>`
        : '';

    const proofModeChip = input.proofMode
        ? `
      <div style="
        display: flex; align-items: center;
        padding: 8px 14px; border-radius: 999px;
        background: rgba(255,255,255,0.04);
        border: 1px solid ${PM.border};
        color: ${PM.textMuted}; font-size: 18px; font-weight: 500;
        letter-spacing: 0.04em; text-transform: uppercase;
      ">
        ${input.proofMode === 'private' ? 'Private Proof' : 'Shareable Proof'}
      </div>`
        : '';

    return html(`
    <div style="
      display: flex; flex-direction: column;
      width: ${WIDTH}px; height: ${HEIGHT}px;
      background: ${PM.bg};
      font-family: 'Noto Sans JP', sans-serif;
      position: relative; overflow: hidden;
      padding: 56px 60px;
    ">
      <!-- ambient glow -->
      <div style="
        position: absolute; top: -160px; left: -160px;
        width: 540px; height: 540px; border-radius: 999px;
        background: radial-gradient(circle, rgba(108,62,244,0.32) 0%, rgba(108,62,244,0) 70%);
      "></div>
      <div style="
        position: absolute; bottom: -200px; right: -200px;
        width: 620px; height: 620px; border-radius: 999px;
        background: radial-gradient(circle, rgba(0,212,170,0.18) 0%, rgba(0,212,170,0) 70%);
      "></div>

      <!-- subtle grid -->
      <div style="
        position: absolute; inset: 0;
        background:
          linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px) 0 0 / 60px 60px,
          linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px) 0 0 / 60px 60px;
      "></div>

      <!-- Header bar -->
      <div style="
        display: flex; align-items: center; justify-content: space-between;
        position: relative;
      ">
        <div style="display: flex; align-items: center; gap: 16px;">
          <img src="${sealDataUri}" width="56" height="56" />
          <div style="display: flex; flex-direction: column;">
            <div style="
              color: ${PM.textMain}; font-size: 28px; font-weight: 800;
              letter-spacing: -0.01em;
            ">ProofMark</div>
            <div style="
              color: ${PM.textWhisper}; font-size: 14px;
              letter-spacing: 0.30em; text-transform: uppercase; font-weight: 800;
            ">The Vault Slab</div>
          </div>
        </div>

        <div style="
          display: flex; align-items: center; gap: 10px;
          padding: 10px 18px; border-radius: 999px;
          background: ${input.trust.bg};
          border: 1px solid ${input.trust.border};
          color: ${input.trust.color};
          font-weight: 800; font-size: 20px;
        ">
          <div style="
            display:flex; width: 10px; height: 10px; border-radius: 999px;
            background: ${input.trust.color};
            box-shadow: 0 0 16px ${input.trust.color};
          "></div>
          <div style="display:flex;">${input.trust.label}</div>
          <div style="display:flex; color: ${PM.textWhisper}; font-weight: 500;">·</div>
          <div style="display:flex; font-weight: 500; color: ${PM.textMuted};">
            ${input.trust.sublabel}
          </div>
        </div>
      </div>

      <!-- Vault Slab -->
      <div style="
        margin-top: 36px;
        display: flex; flex-direction: column;
        flex: 1;
        position: relative;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%),
          ${PM.bgPanel};
        border: 1px solid ${PM.borderStrong};
        border-radius: 28px;
        padding: 40px 44px;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.06),
          0 30px 80px rgba(0,0,0,0.55);
      ">
        <!-- accent rail -->
        <div style="
          position: absolute; left: 0; top: 32px; bottom: 32px; width: 3px;
          background: linear-gradient(180deg, ${PM.primary} 0%, ${PM.success} 100%);
          border-radius: 999px;
          box-shadow: 0 0 24px rgba(108,62,244,0.55);
        "></div>

        <!-- TITLE row -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
          <div style="display: flex; flex-direction: column; max-width: 760px;">
            <div style="
              display:flex; color: ${PM.textWhisper}; font-size: 16px;
              letter-spacing: 0.30em; text-transform: uppercase; font-weight: 800;
            ">Existence Proof · 提出済み証拠</div>

            <div style="
              display:flex; color: ${PM.textMain}; font-weight: 800;
              font-size: 60px; line-height: 1.08; letter-spacing: -0.02em;
              margin-top: 14px;
            ">${escapeHtml(truncate(input.title, 42))}</div>
          </div>

          <img src="${badgeDataUri}" width="120" height="120" />
        </div>

        <!-- Hash card -->
        <div style="
          display: flex; flex-direction: column;
          margin-top: 26px;
          padding: 20px 22px; border-radius: 18px;
          background: rgba(0,0,0,0.32);
          border: 1px solid ${PM.border};
        ">
          <div style="
            display:flex; color: ${PM.textWhisper}; font-size: 14px;
            font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase;
          ">SHA-256</div>
          <div style="
            display:flex;
            margin-top: 10px;
            color: ${PM.textMain}; font-size: 30px; font-weight: 800;
            font-family: 'Noto Sans JP', monospace;
            letter-spacing: 0.04em;
          ">
            ${hash.head}<span style="color:${PM.textWhisper}; padding: 0 10px;">…</span>${hash.tail}
          </div>
        </div>

        <!-- meta row -->
        <div style="
          display: flex; flex-direction: row; gap: 28px;
          margin-top: 26px;
        ">
          ${metaCell('Certified', input.certifiedAt)}
          ${metaCell('Author', input.authorLabel)}
          ${metaCell('TSA', input.trust.sublabel)}
        </div>

        <!-- footer row -->
        <div style="
          display: flex; align-items: center; justify-content: space-between;
          margin-top: auto;
        ">
          <div style="display: flex; gap: 10px;">
            ${founderChip}
            ${proofModeChip}
            <div style="
              display: flex; align-items: center;
              padding: 8px 14px; border-radius: 999px;
              background: rgba(0,212,170,0.08);
              border: 1px solid rgba(0,212,170,0.30);
              color: ${PM.success}; font-size: 18px; font-weight: 800;
              letter-spacing: 0.06em;
            ">RFC3161 + SHA-256</div>
          </div>

          <div style="
            display: flex; flex-direction: column; align-items: flex-end;
          ">
            <div style="display:flex; color: ${PM.textWhisper}; font-size: 14px;
              letter-spacing: 0.24em; text-transform: uppercase; font-weight: 800;">
              Independent verifiable
            </div>
            <div style="display:flex; color: ${PM.textMain}; font-size: 22px;
              font-weight: 800; margin-top: 4px;">
              proofmark.jp
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
}

function metaCell(label: string, value: string): string {
    return `
    <div style="display:flex; flex-direction: column; flex: 1; min-width: 0;">
      <div style="
        display:flex; color: ${PM.textWhisper}; font-size: 14px;
        font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase;
      ">${escapeHtml(label)}</div>
      <div style="
        display:flex; color: ${PM.textMain}; font-size: 22px;
        font-weight: 800; margin-top: 6px;
      ">${escapeHtml(truncate(value, 28))}</div>
    </div>
  `;
}

/* ─────────────────────────────────────────────
 *  Fallback Slab — Supabase 失敗時
 * ───────────────────────────────────────────── */

function buildFallbackSlab(): ReturnType<typeof html> {
    const sealDataUri = svgToDataUri(PM_SEAL_SVG);
    return html(`
    <div style="
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: ${WIDTH}px; height: ${HEIGHT}px;
      background: ${PM.bg};
      font-family: 'Noto Sans JP', sans-serif;
      position: relative; overflow: hidden;
    ">
      <div style="
        position: absolute; inset: 0;
        background:
          radial-gradient(circle at 22% 30%, rgba(108,62,244,0.30) 0%, rgba(0,0,0,0) 45%),
          radial-gradient(circle at 78% 70%, rgba(0,212,170,0.20) 0%, rgba(0,0,0,0) 45%);
      "></div>

      <img src="${sealDataUri}" width="96" height="96" />
      <div style="
        display:flex; color: ${PM.textMain}; font-size: 72px; font-weight: 800;
        margin-top: 28px; letter-spacing: -0.02em;
      ">ProofMark</div>
      <div style="
        display:flex; color: ${PM.textMuted}; font-size: 30px; font-weight: 500;
        margin-top: 12px; text-align: center;
      ">AI時代の納品信頼インフラ</div>
      <div style="
        display:flex; margin-top: 28px;
        padding: 12px 22px; border-radius: 999px;
        background: rgba(0,212,170,0.08);
        border: 1px solid rgba(0,212,170,0.30);
        color: ${PM.success}; font-size: 20px; font-weight: 800;
        letter-spacing: 0.10em; text-transform: uppercase;
      ">RFC3161 · SHA-256 · Independent Verifiable</div>
    </div>
  `);
}

/* ─────────────────────────────────────────────
 *  Render pipeline
 * ───────────────────────────────────────────── */

async function renderPng(
    tree: ReturnType<typeof html>,
    fonts: { regular: ArrayBuffer; bold: ArrayBuffer },
): Promise<Buffer> {
    const svg = await satori(tree as any, {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
            {
                name: 'Noto Sans JP',
                data: fonts.regular,
                weight: 500,
                style: 'normal',
            },
            {
                name: 'Noto Sans JP',
                data: fonts.bold,
                weight: 800,
                style: 'normal',
            },
        ],
    });

    const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: WIDTH },
        background: PM.bg,
        font: { loadSystemFonts: false },
    });
    return resvg.render().asPng();
}

/* ─────────────────────────────────────────────
 *  Handler
 * ───────────────────────────────────────────── */

export default async function handler(
    req: VercelRequest,
    res: VercelResponse,
): Promise<void> {
    // OG画像の取得は常に GET / HEAD
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        res.status(405).end('Method Not Allowed');
        return;
    }

    const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';

    try {
        const [fonts, cert] = await Promise.all([
            loadProofmarkFonts(),
            id ? fetchCertificateForOG(id) : Promise.resolve(null),
        ]);

        const tree = cert
            ? buildVaultSlab(toSlabInput(cert))
            : buildFallbackSlab();

        const png = await renderPng(tree, fonts);

        res.setHeader('Content-Type', 'image/png');
        res.setHeader(
            'Cache-Control',
            'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        );
        res.setHeader('X-ProofMark-OG', cert ? 'vault' : 'fallback');
        res.status(200).send(png);
    } catch (err) {
        // ここで 500 を返すと SNS クローラに「画像なし」と判定されるため、
        // 何が何でも 200 でフォールバック PNG を返す。
        try {
            const fonts = await loadProofmarkFonts();
            const png = await renderPng(buildFallbackSlab(), fonts);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader(
                'Cache-Control',
                // 失敗 OG は短めに (5min)
                'public, max-age=300, s-maxage=300',
            );
            res.setHeader('X-ProofMark-OG', 'fallback-error');
            res.status(200).send(png);
        } catch (fatalErr) {
            // フォント取得すら落ちた最悪ケース: 1x1 透明 PNG を返す
            // (SNS クローラのリトライを許容)
            const transparent = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                'base64',
            );
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-ProofMark-OG', 'transparent');
            res.status(200).send(transparent);
            // Vercel のログに残す
            // eslint-disable-next-line no-console
            console.error('[og-vault] fatal', err, fatalErr);
        }
    }
}

/* ─────────────────────────────────────────────
 *  Utilities
 * ───────────────────────────────────────────── */

function toSlabInput(cert: VaultCertificate): SlabInput {
    const trust = deriveTrustTier(cert);
    const author = safeText(cert.display_name, '') || safeText(cert.username, 'Anonymous');
    return {
        title: safeText(cert.title, '無題の証拠'),
        sha256: cert.sha256,
        trust,
        certifiedAt: formatDate(cert.certified_at || cert.proven_at),
        authorLabel: `@${author}`,
        isFounder: Boolean(cert.is_founder),
        proofMode: cert.proof_mode,
    };
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return `${str.slice(0, max - 1)}…`;
}
