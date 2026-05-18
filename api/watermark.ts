/**
 * api/watermark.ts
 * ──────────────────────────────────────────────────────────────────
 *   ProofMark Verified Watermark Badge — クリエイターが作品に
 *   合成するための小型 PNG (透過 / ピル形状)
 *
 *   出力サイズ:
 *     - dark (既定)  : 720 × 200  透過 PNG
 *     - light        : 720 × 200  透過 PNG (背景白系)
 *     - ?size=large  : 1200 × 320
 *     - ?size=small  : 480 × 132
 *
 *   クエリ:
 *     ?id=cert-uuid   公開証明書 ID。指定時は「短縮 ID」を併記
 *     ?label=...      表示テキスト上書き (最大 28 文字)
 *     ?theme=dark|light
 *     ?size=small|medium|large
 *
 *   制約 (歴史的事故再発防止):
 *     - @vercel/og 系は使わない
 *     - Node.js runtime 固定
 *     - 外部 SVG は文字列定数からインライン展開
 * ──────────────────────────────────────────────────────────────────
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';

import {
    loadProofmarkFonts,
    PM_SEAL_SVG,
    svgToDataUri,
} from './_lib/proofmark-assets.js';

export const config = { runtime: 'nodejs', maxDuration: 60 };

type Theme = 'dark' | 'light';
type Size = 'small' | 'medium' | 'large';

interface SizeSpec {
    width: number;
    height: number;
    pillRadius: number;
    paddingX: number;
    paddingY: number;
    sealSize: number;
    primaryFont: number;
    secondaryFont: number;
    idFont: number;
    gap: number;
}

const SIZES: Record<Size, SizeSpec> = {
    small: {
        width: 480, height: 132, pillRadius: 66,
        paddingX: 28, paddingY: 22,
        sealSize: 64, primaryFont: 30, secondaryFont: 14, idFont: 16, gap: 18,
    },
    medium: {
        width: 720, height: 200, pillRadius: 100,
        paddingX: 40, paddingY: 30,
        sealSize: 96, primaryFont: 44, secondaryFont: 18, idFont: 22, gap: 24,
    },
    large: {
        width: 1200, height: 320, pillRadius: 160,
        paddingX: 64, paddingY: 48,
        sealSize: 160, primaryFont: 72, secondaryFont: 26, idFont: 32, gap: 40,
    },
};

interface ThemeSpec {
    bg: string;
    bgGradient: string;
    border: string;
    shadow: string;
    textMain: string;
    textMuted: string;
    accent: string;
}

const THEMES: Record<Theme, ThemeSpec> = {
    dark: {
        bg: '#0D0B24',
        bgGradient:
            'linear-gradient(135deg, rgba(108,62,244,0.18) 0%, rgba(0,212,170,0.10) 100%), #0D0B24',
        border: 'rgba(255,255,255,0.14)',
        shadow: '0 18px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        textMain: '#FFFFFF',
        textMuted: 'rgba(255,255,255,0.62)',
        accent: '#00D4AA',
    },
    light: {
        bg: '#FFFFFF',
        bgGradient:
            'linear-gradient(135deg, rgba(108,62,244,0.10) 0%, rgba(0,212,170,0.08) 100%), #FFFFFF',
        border: 'rgba(13,11,36,0.16)',
        shadow: '0 12px 28px rgba(13,11,36,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
        textMain: '#0D0B24',
        textMuted: 'rgba(13,11,36,0.62)',
        accent: '#00B896',
    },
};

/* ─────────────────────────────────────────────
 *  Layout builder
 * ───────────────────────────────────────────── */

interface PillInput {
    primary: string;       // 例 "ProofMark Verified"
    secondary: string;     // 例 "RFC3161 · SHA-256"
    shortId: string;       // 例 "PM-7F3A-9B2C"
    size: SizeSpec;
    theme: ThemeSpec;
}

function buildPill(input: PillInput): ReturnType<typeof html> {
    const sealDataUri = svgToDataUri(PM_SEAL_SVG);
    const { size: s, theme: t } = input;

    return html(`
    <div style="
      display: flex;
      width: ${s.width}px; height: ${s.height}px;
      background: transparent;
      font-family: 'Noto Sans JP', sans-serif;
      padding: 8px;
    ">
      <div style="
        display: flex; align-items: center; gap: ${s.gap}px;
        flex: 1;
        padding: ${s.paddingY}px ${s.paddingX + 8}px ${s.paddingY}px ${s.paddingX}px;
        border-radius: ${s.pillRadius}px;
        background: ${t.bgGradient};
        border: 1px solid ${t.border};
        box-shadow: ${t.shadow};
      ">
        <!-- Seal -->
        <div style="
          display: flex; align-items: center; justify-content: center;
          width: ${s.sealSize}px; height: ${s.sealSize}px;
          border-radius: 22px;
          background: rgba(0,0,0,0.18);
          border: 1px solid ${t.border};
        ">
          <img src="${sealDataUri}" width="${Math.round(s.sealSize * 0.78)}" height="${Math.round(s.sealSize * 0.78)}" />
        </div>

        <!-- Text stack -->
        <div style="display: flex; flex-direction: column; justify-content: center; flex: 1; min-width: 0;">
          <div style="
            display:flex; align-items: center; gap: 8px;
            color: ${t.textMain}; font-weight: 800;
            font-size: ${s.primaryFont}px; letter-spacing: -0.01em;
            line-height: 1.05;
          ">
            <span style="display:flex;">${escapeHtml(input.primary)}</span>
          </div>

          <div style="
            display:flex; flex-direction: row; align-items: center;
            margin-top: 6px; gap: 10px;
          ">
            <div style="
              display:flex; color: ${t.textMuted};
              font-size: ${s.secondaryFont}px; font-weight: 800;
              letter-spacing: 0.16em; text-transform: uppercase;
            ">${escapeHtml(input.secondary)}</div>

            <div style="
              display:flex; align-items: center;
              padding: 4px 10px; border-radius: 999px;
              background: rgba(0,212,170,0.12);
              border: 1px solid rgba(0,212,170,0.35);
              color: ${t.accent};
              font-size: ${s.idFont}px; font-weight: 800;
              letter-spacing: 0.04em;
              font-family: 'Noto Sans JP', monospace;
            ">${escapeHtml(input.shortId)}</div>
          </div>
        </div>
      </div>
    </div>
  `);
}

/* ─────────────────────────────────────────────
 *  Handler
 * ───────────────────────────────────────────── */

export default async function handler(
    req: VercelRequest,
    res: VercelResponse,
): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        res.status(405).end('Method Not Allowed');
        return;
    }

    const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    const labelRaw = typeof req.query.label === 'string' ? req.query.label.trim() : '';
    const theme: Theme = req.query.theme === 'light' ? 'light' : 'dark';
    const sizeKey: Size =
        req.query.size === 'small'
            ? 'small'
            : req.query.size === 'large'
                ? 'large'
                : 'medium';

    const sizeSpec = SIZES[sizeKey];
    const themeSpec = THEMES[theme];

    const shortId = deriveShortId(id);
    const primary = truncate(labelRaw || 'ProofMark Verified', 28);

    try {
        const fonts = await loadProofmarkFonts();
        const tree = buildPill({
            primary,
            secondary: 'RFC3161 · SHA-256',
            shortId,
            size: sizeSpec,
            theme: themeSpec,
        });

        const svg = await satori(tree as any, {
            width: sizeSpec.width,
            height: sizeSpec.height,
            fonts: [
                { name: 'Noto Sans JP', data: fonts.regular, weight: 500, style: 'normal' },
                { name: 'Noto Sans JP', data: fonts.bold, weight: 800, style: 'normal' },
            ],
        });

        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: sizeSpec.width },
            // 透過 PNG（背景 alpha = 0）
            background: 'rgba(0,0,0,0)',
            font: { loadSystemFonts: false },
        });
        const png = resvg.render().asPng();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader(
            'Cache-Control',
            'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        );
        res.setHeader(
            'Content-Disposition',
            `inline; filename="proofmark-watermark-${shortId.toLowerCase()}.png"`,
        );
        res.setHeader('X-ProofMark-Watermark', `${theme}-${sizeKey}`);
        res.status(200).send(png);
    } catch (err) {
        // フォントすら落ちた場合は 1x1 透明 PNG（ダウンロードは失敗扱いでよい）
        const transparent = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            'base64',
        );
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-ProofMark-Watermark', 'fallback-transparent');
        res.status(200).send(transparent);
        // eslint-disable-next-line no-console
        console.error('[watermark] failed', err);
    }
}

/* ─────────────────────────────────────────────
 *  Utilities
 * ───────────────────────────────────────────── */

function deriveShortId(id: string): string {
    // UUID v4 を想定。先頭 4 文字 + 中間 4 文字を取って PM-XXXX-YYYY に整形。
    const clean = id.replace(/[^0-9a-z]/gi, '').toUpperCase();
    if (clean.length < 8) return 'PM-PROOF-MARK';
    return `PM-${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
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
