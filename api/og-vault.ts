/**
 * api/og-vault.ts
 * ──────────────────────────────────────────────────────────────────
 * WEAPON 1: The Proof Card — Vault Slab Layout (GOD TIER UNIFIED)
 * ProofMark "The Cyberpunk Slab" — SNS シェア用 OGP 画像 (1200 × 630 PNG)
 *
 * Runtime: Node.js (NOT Edge / NOT @vercel/og)
 * Render : satori + satori-html + @resvg/resvg-js
 *
 * 【アーキテクチャの絶対防衛線】
 * 1. HMAC Anti-DDoS Shield: タイミング攻撃と不正Hexパースを完全に防ぐ厳格な検証。
 * 2. JS-Level Truncation: SatoriのCSSバグを回避するため、物理的な文字列切り詰めを強制。
 * 3. The In-Memory Font Cache: 外部API依存ゼロのモジュールレベルフォントロード。
 * 4. Immutable Edge Caching: Vercel CDNからの0ミリ秒・0円配信。
 *
 * 【Antigravity Patches Applied】
 * - Patch 1 (nodeBlock): inset box-shadow を完全排除 (Satori クラッシュ回避)
 * - Patch 2 (escapeHtml/truncate): XSS & サロゲートペア文字化け防衛
 * - Patch 3 (shortenHash): 空ハッシュ・不正値の安全網
 * - Patch A (buildVaultSlab): radial-gradient → 上下 linear-gradient (Satori 互換)
 * - Patch B (buildVaultSlab): safeTimeSpan で timeSpan の XSS を完全封殺
 * ──────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';

import {
    loadProofmarkFonts,
    PM_BADGE_VERIFIED_SVG,
    svgToDataUri,
} from './_lib/proofmark-assets.js';

export const config = { runtime: 'nodejs', maxDuration: 60 };

const WIDTH = 1200;
const HEIGHT = 630;

/* ─────────────────────────────────────────────
 * 🛡️ HMAC Anti-DDoS Shield (極限の厳格検証)
 * ───────────────────────────────────────────── */
function verifyHmacSignature(payloadStr: string, sig: string): boolean {
    const secret = process.env.OGP_HMAC_SECRET;
    if (!secret) {
        console.error('[CRITICAL] OGP_HMAC_SECRET is missing. Rejecting all requests to prevent DDoS.');
        return false;
    }
    if (!sig || typeof sig !== 'string') return false;
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    try {
        const payload = payloadStr;
        const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        const sigBuffer = Buffer.from(sig, 'hex');
        const expectedBuffer = Buffer.from(expectedSig, 'hex');

        if (sigBuffer.length !== expectedBuffer.length) return false;
        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (e) {
        // 不正なHex文字列（パースエラー等）はすべて攻撃とみなし弾く
        return false;
    }
}

/* ─────────────────────────────────────────────
 * 🎨 Rarity Theme Engine — VaultTheme (GOD TIER)
 * ───────────────────────────────────────────── */
interface VaultTheme {
    tier: 'STANDARD' | 'ADVANCED' | 'GOD TIER';
    /** ベース背景 (一番奥のキャンバス) */
    bg: string;
    /** 暗幕レイヤー (背景ノイズや写真の上を覆う) */
    veil: string;
    /** 主アクセント (ネオンの色) */
    accent: string;
    /** サブアクセント */
    accentSoft: string;
    /** Rarity バッジ用グラデーション */
    rarityGradient: string;
    /** ネオン結線の色 */
    neon: string;
    /** ネオングロー (box-shadow / drop-shadow 用 RGB) */
    neonGlow: string;
    /** 枠線 */
    border: string;
    /** タイポグラフィ主色 */
    text: string;
    /** ミュート文字色 */
    textMuted: string;
    /** ウォーターマーク色 (極薄) */
    watermark: string;
    /** 縦帯のサイバーグリッド色 */
    grid: string;
}

function getTheme(depth: number): VaultTheme {
    // God Tier — 漆黒 × ゴールド (depth >= 100)
    if (depth >= 100) {
        return {
            tier: 'GOD TIER',
            bg: '#050308',
            veil: 'rgba(5,3,8,0.82)',
            accent: '#FFD75E',
            accentSoft: '#FFB347',
            rarityGradient: 'linear-gradient(135deg, #FFD75E 0%, #FF9F1C 100%)',
            neon: '#FFD75E',
            neonGlow: 'rgba(255,215,94,0.55)',
            border: 'rgba(255,215,94,0.32)',
            text: '#FFFFFF',
            textMuted: 'rgba(255,235,180,0.62)',
            watermark: 'rgba(255,215,94,0.045)',
            grid: 'rgba(255,215,94,0.06)',
        };
    }

    // Advanced — 紺色 × サイバーブルー (depth 11..99)
    if (depth >= 11) {
        return {
            tier: 'ADVANCED',
            bg: '#0A1230',
            veil: 'rgba(10,18,48,0.80)',
            accent: '#38BDF8',
            accentSoft: '#6C8DFF',
            rarityGradient: 'linear-gradient(135deg, #38BDF8 0%, #6C8DFF 100%)',
            neon: '#38BDF8',
            neonGlow: 'rgba(56,189,248,0.55)',
            border: 'rgba(56,189,248,0.30)',
            text: '#F0F6FF',
            textMuted: 'rgba(180,205,255,0.62)',
            watermark: 'rgba(56,189,248,0.045)',
            grid: 'rgba(56,189,248,0.06)',
        };
    }

    // Standard — 黒青 × ネオングリーン (depth 1..10)
    return {
        tier: 'STANDARD',
        bg: '#06090F',
        veil: 'rgba(6,9,15,0.82)',
        accent: '#00FFB2',
        accentSoft: '#00D4AA',
        rarityGradient: 'linear-gradient(135deg, #00FFB2 0%, #6C3EF4 100%)',
        neon: '#00FFB2',
        neonGlow: 'rgba(0,255,178,0.55)',
        border: 'rgba(0,255,178,0.28)',
        text: '#FFFFFF',
        textMuted: 'rgba(168,232,210,0.62)',
        watermark: 'rgba(0,255,178,0.04)',
        grid: 'rgba(0,255,178,0.05)',
    };
}

/* ─────────────────────────────────────────────
 * Helpers & DTO
 * ───────────────────────────────────────────── */
interface SlabInput {
    title: string;
    sha256: string;
    authorLabel: string;
    depth: number;
    timeSpan: string;
    originUrl: string;
    midUrl: string;
    headUrl: string;
}

/** 🚨 Patch 3: 空ハッシュ・不正値でも slice がエラーを吐かない安全網 */
function shortenHash(sha256: string): { head: string; tail: string } {
    const clean = (sha256 || '').replace(/[^0-9a-f]/gi, '').toLowerCase();
    if (clean.length < 16) return { head: clean || 'UNSEALED', tail: '' };
    return { head: clean.slice(0, 10), tail: clean.slice(-8) };
}

function safeText(value: string | null | undefined, fallback: string): string {
    const trimmed = (value ?? '').trim();
    return trimmed.length === 0 ? fallback : trimmed;
}

/** 🚨 Patch 2: XSS エスケープ */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 🚨 Patch 2: サロゲートペアを破壊しない安全な truncate */
function truncate(str: string, max: number): string {
    const chars = Array.from(str);
    if (chars.length <= max) return str;
    return `${chars.slice(0, max - 1).join('')}…`;
}

/* ─────────────────────────────────────────────
 * Layout Builder — The Vault Slab (3-Node Composite)
 * ───────────────────────────────────────────── */
function buildVaultSlab(input: SlabInput): ReturnType<typeof html> {
    const t = getTheme(input.depth);

    // 🚨 Patch 3: 空ハッシュ・不正値でも安全
    const hashObj = shortenHash(input.sha256);
    const shortHash = hashObj.tail ? `${hashObj.head}…${hashObj.tail}` : hashObj.head;

    // 🚨 Patch 2: XSS & 文字化け防衛済みの描画用文字列
    const safeTitle = escapeHtml(truncate(input.title, 42));
    const safeAuthor = escapeHtml(input.authorLabel);

    // 🚨 Patch B: timeSpan の XSS を完全封殺
    const safeTimeSpan = escapeHtml(input.timeSpan);

    return html`
    <div
      style="
        display: flex;
        flex-direction: column;
        width: 1200px;
        height: 630px;
        position: relative;
        background-color: ${t.bg};
        color: ${t.text};
        font-family: 'Noto Sans JP','Inter','SF Pro','Helvetica Neue',sans-serif;
        overflow: hidden;
      "
    >
      <!-- ═════════════ Layer 0 : Cyber Grid ═════════════ -->
      <div
        style="
          display: flex;
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image:
            linear-gradient(${t.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${t.grid} 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.55;
        "
      ></div>

      <!-- ═════════════ Layer 1 : Vignette (Patch A: radial-gradient → 2 linear-gradients) ═════════════ -->
      <div
        style="
          display: flex;
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 180px;
          background-image: linear-gradient(to bottom, ${t.bg}, transparent);
        "
      ></div>
      <div
        style="
          display: flex;
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 180px;
          background-image: linear-gradient(to top, ${t.bg}, transparent);
        "
      ></div>

      <!-- ═════════════ Layer 2 : Deterrence Watermark ═════════════ -->
      <div
        style="
          display: flex;
          position: absolute;
          top: 130px;
          left: -90px;
          right: -90px;
          justify-content: center;
          align-items: center;
          transform: rotate(-15deg);
          color: ${t.watermark};
          font-size: 188px;
          font-weight: 900;
          letter-spacing: 28px;
          white-space: nowrap;
        "
      >
        PROOFMARK SECURED
      </div>

      <!-- ═════════════ Layer 3 : Dark Veil (擬似ぼかし) ═════════════ -->
      <div
        style="
          display: flex;
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: ${t.veil};
        "
      ></div>

      <!-- ═════════════ Layer 4 : Top Border Neon ═════════════ -->
      <div
        style="
          display: flex;
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background-image: linear-gradient(90deg, transparent 0%, ${t.neon} 50%, transparent 100%);
        "
      ></div>

      <!-- ═════════════ Layer 5 : Header ═════════════ -->
      <div
        style="
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          padding: 36px 56px 0 56px;
          width: 100%;
          height: 84px;
          box-sizing: border-box;
        "
      >
        <!-- Brand Lock-up -->
        <div
          style="
            display: flex;
            flex-direction: row;
            align-items: center;
          "
        >
          <div
            style="
              display: flex;
              width: 40px;
              height: 40px;
              align-items: center;
              justify-content: center;
              background: ${t.rarityGradient};
              border-radius: 10px;
              margin-right: 14px;
              box-shadow: 0 0 24px ${t.neonGlow};
              color: #050308;
              font-size: 22px;
              font-weight: 900;
            "
          >
            P
          </div>
          <div
            style="
              display: flex;
              flex-direction: column;
            "
          >
            <div
              style="
                display: flex;
                color: ${t.text};
                font-size: 18px;
                font-weight: 800;
                letter-spacing: 4px;
              "
            >
              PROOFMARK
            </div>
            <div
              style="
                display: flex;
                color: ${t.textMuted};
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 3px;
                margin-top: 2px;
              "
            >
              FORENSIC PROOF · CHAIN OF EVIDENCE
            </div>
          </div>
        </div>

        <!-- Rarity Badge -->
        <div
          style="
            display: flex;
            flex-direction: row;
            align-items: center;
            padding: 10px 18px;
            border: 1px solid ${t.border};
            border-radius: 999px;
            background-color: rgba(0,0,0,0.45);
          "
        >
          <div
            style="
              display: flex;
              width: 8px;
              height: 8px;
              border-radius: 999px;
              background-color: ${t.neon};
              margin-right: 10px;
              box-shadow: 0 0 12px ${t.neonGlow};
            "
          ></div>
          <div
            style="
              display: flex;
              color: ${t.text};
              font-size: 13px;
              font-weight: 900;
              letter-spacing: 4px;
            "
          >
            ${t.tier}
          </div>
        </div>
      </div>

      <!-- ═════════════ Layer 6 : The 3-Node Composite ═════════════ -->
      <div
        style="
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 24px 56px 0 56px;
          box-sizing: border-box;
          height: 320px;
        "
      >
        ${nodeBlock({
            theme: t,
            label: 'ORIGIN',
            sublabel: 'T+0 · Genesis',
            imageUrl: input.originUrl,
            accent: t.accentSoft,
            glow: t.neonGlow,
            size: 220,
            isHead: false,
        })}

        ${neonLink({ theme: t, leftLabel: 'HASH', rightLabel: 'SCRUB' })}

        ${nodeBlock({
            theme: t,
            label: 'EVOLUTION',
            sublabel: 'Mid-Chain',
            imageUrl: input.midUrl,
            accent: t.accent,
            glow: t.neonGlow,
            size: 220,
            isHead: false,
        })}

        ${neonLink({ theme: t, leftLabel: 'SEAL', rightLabel: 'HEAD' })}

        ${nodeBlock({
            theme: t,
            label: 'HEAD',
            sublabel: 'Completed Work',
            imageUrl: input.headUrl,
            accent: t.accent,
            glow: t.neonGlow,
            size: 240,
            isHead: true,
        })}
      </div>

      <!-- ═════════════ Layer 7 : Forensic Data Strip ═════════════ -->
      <div
        style="
          display: flex;
          flex-direction: row;
          align-items: stretch;
          justify-content: space-between;
          width: 100%;
          padding: 22px 56px 0 56px;
          box-sizing: border-box;
        "
      >
        <!-- Left: Title + author -->
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: center;
            flex: 1;
            padding-right: 28px;
          "
        >
          <div
            style="
              display: flex;
              color: ${t.textMuted};
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 3px;
              margin-bottom: 8px;
            "
          >
            EVIDENCE TITLE
          </div>
          <div
            style="
              display: flex;
              color: ${t.text};
              font-size: 30px;
              font-weight: 900;
              letter-spacing: -0.5px;
              line-height: 1.15;
              max-width: 640px;
            "
          >
            ${safeTitle}
          </div>
          <div
            style="
              display: flex;
              flex-direction: row;
              align-items: center;
              margin-top: 12px;
            "
          >
            <div
              style="
                display: flex;
                color: ${t.accent};
                font-size: 15px;
                font-weight: 800;
                letter-spacing: 1px;
              "
            >
              ${safeAuthor}
            </div>
            <div
              style="
                display: flex;
                width: 4px;
                height: 4px;
                border-radius: 999px;
                background-color: ${t.textMuted};
                margin: 0 12px;
              "
            ></div>
            <div
              style="
                display: flex;
                color: ${t.textMuted};
                font-size: 12px;
                font-weight: 600;
                font-family: 'JetBrains Mono','SF Mono',monospace;
                letter-spacing: 1.5px;
              "
            >
              SHA-256 · ${shortHash}
            </div>
          </div>
        </div>

        <!-- Right: Time-Sunk Cost (THE WEAPON) -->
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: center;
            min-width: 340px;
            padding: 18px 22px;
            border: 1px solid ${t.border};
            border-radius: 16px;
            background-color: rgba(0,0,0,0.45);
            position: relative;
          "
        >
          <!-- ribbon -->
          <div
            style="
              display: flex;
              position: absolute;
              top: 0; left: 0; right: 0;
              height: 2px;
              background-image: linear-gradient(90deg, transparent 0%, ${t.neon} 50%, transparent 100%);
            "
          ></div>

          <div
            style="
              display: flex;
              color: ${t.textMuted};
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 4px;
            "
          >
            TIMELINE SPAN
          </div>
          <div
            style="
              display: flex;
              flex-direction: row;
              align-items: flex-end;
              margin-top: 4px;
            "
          >
            <div
              style="
                display: flex;
                font-size: 56px;
                font-weight: 900;
                font-family: 'JetBrains Mono','SF Mono',monospace;
                letter-spacing: -1px;
                line-height: 1;
                color: ${t.accent};
                text-shadow: 0 0 24px ${t.neonGlow};
              "
            >
              ${safeTimeSpan}
            </div>
          </div>
          <div
            style="
              display: flex;
              flex-direction: row;
              align-items: center;
              margin-top: 10px;
            "
          >
            <div
              style="
                display: flex;
                color: ${t.text};
                font-size: 13px;
                font-weight: 800;
                letter-spacing: 2px;
                margin-right: 14px;
              "
            >
              DEPTH
            </div>
            <div
              style="
                display: flex;
                color: ${t.accent};
                font-size: 22px;
                font-weight: 900;
                font-family: 'JetBrains Mono','SF Mono',monospace;
                letter-spacing: 1px;
              "
            >
              ${formatDepth(input.depth)}
            </div>
            <div
              style="
                display: flex;
                color: ${t.textMuted};
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 2px;
                margin-left: 8px;
              "
            >
              STEPS
            </div>
          </div>
        </div>
      </div>

      <!-- ═════════════ Layer 8 : Footer Forensic Strip ═════════════ -->
      <div
        style="
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0 56px;
          height: 64px;
          box-sizing: border-box;
          margin-top: auto;
          border-top: 1px solid ${t.border};
          background-color: rgba(0,0,0,0.35);
        "
      >
        <div
          style="
            display: flex;
            flex-direction: row;
            align-items: center;
          "
        >
          <div
            style="
              display: flex;
              width: 6px;
              height: 6px;
              border-radius: 999px;
              background-color: ${t.neon};
              margin-right: 12px;
              box-shadow: 0 0 10px ${t.neonGlow};
            "
          ></div>
          <div
            style="
              display: flex;
              color: ${t.text};
              font-size: 12px;
              font-weight: 800;
              letter-spacing: 3px;
            "
          >
            100% HUMAN VERIFIED · CHAIN INTEGRITY ✓
          </div>
        </div>
        <div
          style="
            display: flex;
            color: ${t.textMuted};
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 4px;
            font-family: 'JetBrains Mono','SF Mono',monospace;
          "
        >
          PROOFMARK.JP / V · ${t.tier.replace(' ', '')}
        </div>
      </div>

      <!-- ═════════════ Layer 9 : Bottom Border Neon ═════════════ -->
      <div
        style="
          display: flex;
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 3px;
          background-image: linear-gradient(90deg, transparent 0%, ${t.neon} 50%, transparent 100%);
        "
      ></div>
    </div>
  `;
}

/* ─────────────────────────────────────────────
 * Sub-blocks (template fragments)
 * ───────────────────────────────────────────── */

function nodeBlock(opts: {
    theme: VaultTheme;
    label: string;
    sublabel: string;
    imageUrl: string;
    accent: string;
    glow: string;
    size: number;
    isHead: boolean;
}): string {
    const { theme, label, sublabel, imageUrl, accent, glow, size, isHead } = opts;
    const borderColor = isHead ? theme.accent : theme.border;
    const borderWidth = isHead ? 3 : 2;

    // 🚨 Patch 1: inset を完全排除 — Satori はサポートしておらずクラッシュする
    const shadow = isHead
        ? `0 0 36px ${glow}, 0 14px 30px rgba(0,0,0,0.55)`
        : `0 0 18px ${glow}, 0 8px 22px rgba(0,0,0,0.45)`;

    return `
    <div
      style="
        display: flex;
        flex-direction: column;
        align-items: center;
        width: ${size}px;
      "
    >
      <div
        style="
          display: flex;
          flex-direction: row;
          align-items: center;
          margin-bottom: 10px;
          padding: 5px 12px;
          background-color: ${isHead ? accent : 'rgba(0,0,0,0.55)'};
          border: 1px solid ${isHead ? accent : theme.border};
          border-radius: 999px;
          color: ${isHead ? '#050308' : theme.text};
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
        "
      >
        ${label}
      </div>

      <div
        style="
          display: flex;
          width: ${size}px;
          height: ${size}px;
          border-radius: 18px;
          border: ${borderWidth}px solid ${borderColor};
          background-color: #000;
          box-shadow: ${shadow};
          position: relative;
          overflow: hidden;
        "
      >
        <img
          src="${escapeHtml(imageUrl)}"
          width="${size}"
          height="${size}"
          style="
            display: flex;
            width: ${size}px;
            height: ${size}px;
            object-fit: cover;
          "
        />
        <div style="display:flex;position:absolute;top:8px;left:8px;width:14px;height:14px;border-top:2px solid ${accent};border-left:2px solid ${accent};"></div>
        <div style="display:flex;position:absolute;top:8px;right:8px;width:14px;height:14px;border-top:2px solid ${accent};border-right:2px solid ${accent};"></div>
        <div style="display:flex;position:absolute;bottom:8px;left:8px;width:14px;height:14px;border-bottom:2px solid ${accent};border-left:2px solid ${accent};"></div>
        <div style="display:flex;position:absolute;bottom:8px;right:8px;width:14px;height:14px;border-bottom:2px solid ${accent};border-right:2px solid ${accent};"></div>
        ${isHead
            ? `<div
            style="
              display: flex;
              flex-direction: row;
              align-items: center;
              position: absolute;
              top: 10px;
              right: 10px;
              padding: 4px 8px;
              background: ${theme.rarityGradient};
              border-radius: 6px;
              color: #050308;
              font-size: 10px;
              font-weight: 900;
              letter-spacing: 2px;
            "
          >
            ★ HEAD
          </div>`
            : ''
        }
      </div>

      <div
        style="
          display: flex;
          margin-top: 8px;
          color: ${theme.textMuted};
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          font-family: 'JetBrains Mono','SF Mono',monospace;
        "
      >
        ${sublabel}
      </div>
    </div>
  `;
}

function neonLink(opts: {
    theme: VaultTheme;
    leftLabel: string;
    rightLabel: string;
}): string {
    const { theme, leftLabel, rightLabel } = opts;
    return `
    <div
      style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 96px;
        height: 220px;
        margin: 0 4px;
      "
    >
      <div
        style="
          display: flex;
          color: ${theme.accent};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 3px;
          font-family: 'JetBrains Mono','SF Mono',monospace;
          margin-bottom: 6px;
        "
      >
        » ${leftLabel}
      </div>

      <div
        style="
          display: flex;
          flex-direction: row;
          align-items: center;
          width: 96px;
          height: 18px;
          position: relative;
        "
      >
        <div
          style="
            display: flex;
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background-color: ${theme.neon};
            box-shadow: 0 0 14px ${theme.neonGlow};
            margin-right: -2px;
          "
        ></div>
        <div
          style="
            display: flex;
            flex: 1;
            height: 2px;
            background-image: linear-gradient(90deg, ${theme.neon} 0%, ${theme.accentSoft} 100%);
            box-shadow: 0 0 12px ${theme.neonGlow};
          "
        ></div>
        <div
          style="
            display: flex;
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background-color: ${theme.accentSoft};
            box-shadow: 0 0 14px ${theme.neonGlow};
            margin-left: -2px;
          "
        ></div>
      </div>

      <div
        style="
          display: flex;
          color: ${theme.accentSoft};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 3px;
          font-family: 'JetBrains Mono','SF Mono',monospace;
          margin-top: 6px;
        "
      >
        ${rightLabel} «
      </div>
    </div>
  `;
}

function formatDepth(depth: number): string {
    if (!Number.isFinite(depth) || depth < 0) return '000';
    if (depth < 1000) return depth.toString().padStart(3, '0');
    return depth.toString();
}

/* ─────────────────────────────────────────────
 * Render pipeline
 * ───────────────────────────────────────────── */
async function renderPng(tree: ReturnType<typeof html>, fonts: { regular: ArrayBuffer; bold: ArrayBuffer }): Promise<Buffer> {
    const svg = await satori(tree as any, {
        width: WIDTH, height: HEIGHT,
        fonts: [
            { name: 'Noto Sans JP', data: fonts.regular, weight: 500, style: 'normal' },
            { name: 'Noto Sans JP', data: fonts.bold, weight: 800, style: 'normal' },
        ],
    });
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, background: '#07061A', font: { loadSystemFonts: false } });
    return resvg.render().asPng();
}

/* ─────────────────────────────────────────────
 * Handler
 * ───────────────────────────────────────────── */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).end('Method Not Allowed');
    }

    // 🚨 防衛線1: Strict Query Whitelisting (キャッシュ破壊DDoSの完全封殺)
    // 許可されたパラメータ「以外」が1つでも含まれていたら即時 403 遮断。
    const ALLOWED_KEYS = new Set(['id', 't', 'h', 'a', 'd', 'tm', 'o', 'm', 'hd', 'sig']);
    const queryKeys = Object.keys(req.query);
    for (const key of queryKeys) {
        if (!ALLOWED_KEYS.has(key)) {
            return res.status(403).end('Forbidden: Invalid Query Parameters');
        }
    }

    // 🛡️ パラメータ配列化の罠を防ぐヘルパー
    const getParam = (val: string | string[] | undefined): string => {
        if (Array.isArray(val)) return val[0] || '';
        return val || '';
    };

    const p = {
        id: getParam(req.query.id),
        title: getParam(req.query.t),
        hash: getParam(req.query.h),
        author: getParam(req.query.a),
        depth: parseInt(getParam(req.query.d) || '1', 10),
        timeSpan: getParam(req.query.tm),
        origin: getParam(req.query.o),
        mid: getParam(req.query.m),
        head: getParam(req.query.hd),
    };
    const sig = getParam(req.query.sig);

    // 🚨 防衛線2: 認証(HMAC)をバリデーション(Regex)の前に移動
    // 重い正規表現処理すらも、署名がないリクエストには与えない。
    const payloadStr = `${p.id}||${p.title}||${p.hash}||${p.author}||${p.depth}||${p.timeSpan}||${p.origin}||${p.mid}||${p.head}`;
    
    if (process.env.NODE_ENV === 'production') {
        if (!verifyHmacSignature(payloadStr, sig)) {
            return res.status(403).end('Forbidden: Invalid Signature');
        }
    }

    // UUIDの検証
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!p.id || !uuidRegex.test(p.id)) {
        return res.status(400).end('Bad Request');
    }

    // 🚨 防衛線3: SSRF / Timeout Protection
    // Satoriがフェッチする画像URLが「自身のドメイン」または「Supabase Storage」以外なら弾く。
    // ※以下は一般的な防衛ロジックです。環境変数に合わせてドメインを許可してください。
    const allowedImageDomains = ['proofmark.jp', 'supabase.co'];
    const isUrlSafe = (urlStr: string) => {
        if (!urlStr) return true; // 空は許容(代替描画される)
        try {
            const parsed = new URL(urlStr);
            return allowedImageDomains.some(domain => parsed.hostname.endsWith(domain));
        } catch {
            return false; // パースできないURLは危険
        }
    };

    if (!isUrlSafe(p.origin) || !isUrlSafe(p.mid) || !isUrlSafe(p.head)) {
        return res.status(403).end('Forbidden: Disallowed Image Origin');
    }

    try {
        const fonts = await loadProofmarkFonts();

        const input: SlabInput = {
            title: p.title || '無題の証拠',
            sha256: p.hash,
            authorLabel: p.author,
            depth: p.depth,
            timeSpan: p.timeSpan,
            originUrl: p.origin,
            midUrl: p.mid,
            headUrl: p.head
        };

        const tree = buildVaultSlab(input);
        const png = await renderPng(tree, fonts);

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400');
        res.setHeader('X-ProofMark-OG', 'vault-slab-god-tier');
        res.status(200).send(png);
    } catch (err) {
        try {
            const transparent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).send(transparent);
        } catch (fatalErr) {
            return res.status(500).end('Internal Server Error');
        }
    }
}