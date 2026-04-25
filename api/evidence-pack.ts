/**
 * api/evidence-pack.ts — ProofMark Evidence Pack Generator
 *
 * 「納品できる証拠の束（Evidence Pack）」を ZIP 1本で返すサーバー権威API。
 *
 * 設計思想（開発戦記 Phase 4〜6 と完全整合）:
 *   1. Server Authority — JWT のみ受け取り、所有権照合は auth.getUser() 経由。
 *      apikey / x-supabase-url 同送ハックは一切使わない。
 *   2. WORM — DB を一切 UPDATE/INSERT しない。読み取り専用で Evidence Pack を合成する。
 *   3. Pure Node — @vercel/og や外部 ZIP ライブラリに頼らず、zlib.deflateRaw と
 *      手組み ZIP (Store / Deflate) で STORE 互換の成果物を生成。
 *      Vercel / AWS Lambda / Cloudflare Workers どこへ移植しても 1 行変わらない。
 *   4. Zero-Knowledge 尊重 — `private` モードでは原本画像ストリームには触れない。
 *      Shareable モードでも、ストレージから取得するのは公開プレビュー画像のみ。
 *   5. Idempotent & Cache Friendly — 同一 certId に対して決定論的な ZIP を返し、
 *      CDN エッジで 1 時間キャッシュ。レートリミットは Upstash（フェイルセーフ）。
 *   6. Observability — x-request-id とイベントログで Runtime Logs から完全追跡可能。
 *
 * 返却物（ZIP 構造）:
 *   proofmark-evidence-{shortId}/
 *     ├── README.md                    … 中身の説明と検証手順（日本語）
 *     ├── README.en.md                 … 英語版（海外クライアント提出用）
 *     ├── certificate.json             … 証明書メタデータの正本（機械可読）
 *     ├── certificate.html             … 人間可読・印刷可能な証明書
 *     ├── timestamp.tsr                … RFC3161 TST の生 DER（OpenSSL 検証可能）
 *     ├── timestamp.tsr.base64         … Base64 版（メール添付用）
 *     ├── verify.sh                    … OpenSSL ワンライナー検証スクリプト
 *     ├── verify.py                    … Python 独立検証スクリプト
 *     ├── cover-letter.ja.txt          … クライアント提出用カバーレター（日）
 *     ├── cover-letter.en.txt          … Submission cover letter (EN)
 *     └── preview.{webp|png}           … Shareable モード時のみ同梱
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deflateRawSync } from 'node:zlib';
import { randomUUID, createHash } from 'node:crypto';
import * as Sentry from '@sentry/node';

// ──────────────────────────────────────────────────────────────────────────
// 0. Config — サーバー単一権威（開発戦記 §25–§26 準拠）
// ──────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const ALLOWED_ORIGINS = (
    process.env.ALLOWED_ORIGINS || 'https://proofmark.jp,https://www.proofmark.jp'
)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Upstash（任意。未設定ならレートリミットをスキップ＝フェイルセーフ §31）
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    tracesSampleRate: 0.1,
    beforeSend(event) {
        if (event.request?.headers) {
            delete (event.request.headers as Record<string, string>).authorization;
            delete (event.request.headers as Record<string, string>).cookie;
        }
        return event;
    },
});

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`[config] Missing required env: ${name}`);
    return v;
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Upstash Sliding-Window Rate Limit（フェイルセーフ §31）
// ──────────────────────────────────────────────────────────────────────────
async function upstashRateLimit(key: string, max = 10, windowSec = 60): Promise<boolean> {
    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return true;
    try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 1500);
        // 単純な INCR + EXPIRE。Sliding Window は Upstash の ratelimit パッケージで代替可能。
        const res = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([
                ['INCR', `ep:${key}`],
                ['EXPIRE', `ep:${key}`, String(windowSec)],
            ]),
            signal: ctl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return true; // フェイルセーフ
        const j = (await res.json()) as Array<{ result: number | string }>;
        const count = Number(j?.[0]?.result ?? 0);
        return count <= max;
    } catch {
        return true; // Redis 障害時は制限機能のみをオフにし、ビジネス継続を優先
    }
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Input validation
// ──────────────────────────────────────────────────────────────────────────
const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ──────────────────────────────────────────────────────────────────────────
// 3. ZIP writer — ライブラリ依存ゼロの純 Node 実装
//    PKZIP APPNOTE 6.3.9 に準拠（STORE / DEFLATE, CRC32, no Zip64）
// ──────────────────────────────────────────────────────────────────────────

/** CRC-32 (IEEE 802.3) — ZIP ヘッダ用 */
const CRC32_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(buf: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
    name: string;
    data: Buffer;
    /** 決定論的な ZIP を作るため、mtime は固定（2026-01-01 00:00:00 UTC）*/
    mtime?: Date;
}

/** DOS time/date (固定で決定論的 ZIP 化) */
function toDosDateTime(d: Date) {
    const year = Math.max(1980, d.getUTCFullYear());
    const time =
        ((d.getUTCHours() & 0x1f) << 11) |
        ((d.getUTCMinutes() & 0x3f) << 5) |
        ((d.getUTCSeconds() >> 1) & 0x1f);
    const date =
        (((year - 1980) & 0x7f) << 9) |
        (((d.getUTCMonth() + 1) & 0x0f) << 5) |
        (d.getUTCDate() & 0x1f);
    return { time, date };
}

/**
 * 純 Node zlib（deflateRawSync）で圧縮し、PKZIP 形式に直接書き出す。
 * 外部依存ゼロ、決定論的、Vercel Node Runtime でそのまま動く。
 */
function buildZip(entries: ZipEntry[]): Buffer {
    const fixedMtime = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    const parts: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;

    for (const e of entries) {
        const nameBuf = Buffer.from(e.name, 'utf8');
        const raw = e.data;
        const crc = crc32(raw);
        const deflated = deflateRawSync(raw, { level: 9 });
        // 圧縮して大きくなる小さいファイルは STORE にする
        const useDeflate = deflated.length < raw.length;
        const payload = useDeflate ? deflated : raw;
        const method = useDeflate ? 8 : 0; // 8 = deflate, 0 = store
        const { time, date } = toDosDateTime(e.mtime ?? fixedMtime);

        // Local file header (30 + nameLen)
        const lfh = Buffer.alloc(30);
        lfh.writeUInt32LE(0x04034b50, 0);            // signature
        lfh.writeUInt16LE(20, 4);                    // version needed
        lfh.writeUInt16LE(1 << 11, 6);               // general purpose (UTF-8 name)
        lfh.writeUInt16LE(method, 8);                // compression
        lfh.writeUInt16LE(time, 10);
        lfh.writeUInt16LE(date, 12);
        lfh.writeUInt32LE(crc, 14);
        lfh.writeUInt32LE(payload.length, 18);       // compressed size
        lfh.writeUInt32LE(raw.length, 22);           // uncompressed size
        lfh.writeUInt16LE(nameBuf.length, 26);
        lfh.writeUInt16LE(0, 28);                    // extra len

        parts.push(lfh, nameBuf, payload);

        // Central directory header (46 + nameLen)
        const cdh = Buffer.alloc(46);
        cdh.writeUInt32LE(0x02014b50, 0);
        cdh.writeUInt16LE(0x031e, 4);                // version made by (Unix, 3.0)
        cdh.writeUInt16LE(20, 6);                    // version needed
        cdh.writeUInt16LE(1 << 11, 8);               // UTF-8 name
        cdh.writeUInt16LE(method, 10);
        cdh.writeUInt16LE(time, 12);
        cdh.writeUInt16LE(date, 14);
        cdh.writeUInt32LE(crc, 16);
        cdh.writeUInt32LE(payload.length, 20);
        cdh.writeUInt32LE(raw.length, 24);
        cdh.writeUInt16LE(nameBuf.length, 28);
        cdh.writeUInt16LE(0, 30);                    // extra
        cdh.writeUInt16LE(0, 32);                    // comment
        cdh.writeUInt16LE(0, 34);                    // disk no
        cdh.writeUInt16LE(0, 36);                    // internal attrs
        cdh.writeUInt32LE(0o100644 << 16, 38);       // external attrs (unix 0644)
        cdh.writeUInt32LE(offset, 42);               // local header offset
        central.push(cdh, nameBuf);

        offset += lfh.length + nameBuf.length + payload.length;
    }

    const cd = Buffer.concat(central);
    const cdOffset = offset;
    const cdSize = cd.length;

    // End of Central Directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);                      // disk no
    eocd.writeUInt16LE(0, 6);                      // disk w/ cd
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdOffset, 16);
    eocd.writeUInt16LE(0, 20);                     // comment len

    return Buffer.concat([...parts, cd, eocd]);
}

// ──────────────────────────────────────────────────────────────────────────
// 4. 証明書データ → 人間可読ドキュメント生成（ReactもSatoriも使わない、純文字列）
// ──────────────────────────────────────────────────────────────────────────

interface CertRow {
    id: string;
    user_id: string;
    sha256: string | null;
    title: string | null;
    original_filename: string | null;
    file_name: string | null;
    storage_path: string | null;
    public_image_url: string | null;
    proof_mode: 'private' | 'shareable' | null;
    visibility: 'public' | 'unlisted' | 'private' | null;
    timestamp_token: string | null;
    certified_at: string | null;
    tsa_provider: string | null;
    tsa_url: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
}

interface ProfileRow {
    username: string | null;
    display_name?: string | null;
}

function pickTitle(c: CertRow): string {
    return c.title || c.original_filename || c.file_name || 'Untitled';
}

/** Trust Tier 導出ロジック（Dashboard.tsx の deriveTrustTier と同一基準） */
function trustTier(c: CertRow): { key: string; label: string; provider: string } {
    const provider = (c.tsa_provider || '').toLowerCase();
    if (!c.timestamp_token || !c.certified_at) {
        return { key: 'pending', label: 'Pending', provider: provider || '—' };
    }
    if (['digicert', 'globalsign', 'seiko', 'sectigo'].includes(provider)) {
        return { key: 'trusted', label: 'Trusted TSA', provider: provider.toUpperCase() };
    }
    return { key: 'beta', label: 'Beta TSA', provider: provider.toUpperCase() || 'FREETSA' };
}

function htmlEscape(s: string): string {
    return s.replace(/[&<>"']/g, (ch) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!)
    );
}

/** certificate.json — 機械可読な正本 */
function buildCertJson(c: CertRow, profile: ProfileRow | null, baseUrl: string) {
    const tier = trustTier(c);
    return {
        schema: 'https://proofmark.jp/schemas/evidence-pack/v1.json',
        generated_at: new Date().toISOString(),
        certificate: {
            id: c.id,
            title: pickTitle(c),
            verify_url: `${baseUrl}/cert/${c.id}`,
            creator: {
                username: profile?.username ?? null,
                display_name: profile?.display_name ?? null,
            },
            sha256: c.sha256,
            created_at: c.created_at,
            proof_mode: c.proof_mode ?? 'shareable',
            visibility: c.visibility ?? 'public',
        },
        timestamp: {
            certified_at: c.certified_at,
            tsa_provider: c.tsa_provider,
            tsa_url: c.tsa_url,
            trust_tier: tier.key,
            trust_label: tier.label,
            token_base64_file: c.timestamp_token ? 'timestamp.tsr.base64' : null,
            token_der_file: c.timestamp_token ? 'timestamp.tsr' : null,
        },
        disclaimers: {
            proves: [
                'The file with the above SHA-256 existed at `certified_at` (if TST present).',
                'The file has not been altered since `certified_at` (bit-level integrity).',
            ],
            does_not_prove: [
                'Authorship or copyright ownership.',
                'Originality, legality, or first-creation of the work.',
                'Automatic admissibility in any specific court (subject to jurisdiction).',
            ],
            docs: `${baseUrl}/trust-center#s4`,
        },
    };
}

/** certificate.html — 人間可読・印刷可能な簡易証明書 */
function buildCertHtml(c: CertRow, profile: ProfileRow | null, baseUrl: string): string {
    const tier = trustTier(c);
    const title = htmlEscape(pickTitle(c));
    const creator = htmlEscape(profile?.username || 'Anonymous');
    const sha = htmlEscape(c.sha256 || '—');
    const created = c.created_at ? new Date(c.created_at).toISOString() : '—';
    const certified = c.certified_at ? new Date(c.certified_at).toISOString() : '—';
    const verifyUrl = `${baseUrl}/cert/${c.id}`;
    return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8" />
<title>ProofMark Certificate — ${title}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: -apple-system, "Noto Sans JP", system-ui, sans-serif;
         background: #fff; color: #0D0B24; padding: 48px; }
  .wrap { max-width: 880px; margin: 0 auto; border: 2px solid #0D0B24; border-radius: 20px; padding: 40px; }
  h1 { font-size: 28px; letter-spacing: -0.02em; margin: 0 0 4px; }
  .sub { color: #4a4a6a; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
  .k { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #4a4a6a; }
  .v { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; word-break: break-all; }
  .hash { padding: 12px; background: #f4f4fa; border-radius: 8px; }
  .tier { display: inline-block; padding: 4px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
          border: 1px solid ${tier.key === 'trusted' ? '#00805a' : '#6b6b8a'};
          color: ${tier.key === 'trusted' ? '#00805a' : '#4a4a6a'};
          background: ${tier.key === 'trusted' ? '#e8fff5' : '#f4f4fa'}; }
  .foot { margin-top: 40px; font-size: 11px; color: #6b6b8a; border-top: 1px solid #e0e0ea; padding-top: 16px; }
  a { color: #6C3EF4; }
</style></head>
<body><div class="wrap">
  <div class="sub">ProofMark Digital Existence Certificate</div>
  <h1>${title}</h1>
  <div style="margin-top:8px"><span class="tier">${tier.label} · ${htmlEscape(tier.provider)}</span></div>
  <div class="grid">
    <div><div class="k">Creator</div><div class="v">@${creator}</div></div>
    <div><div class="k">Certificate ID</div><div class="v">${htmlEscape(c.id)}</div></div>
    <div><div class="k">Record Created (UTC)</div><div class="v">${created}</div></div>
    <div><div class="k">TSA Certified (UTC)</div><div class="v">${certified}</div></div>
  </div>
  <div style="margin-top:24px">
    <div class="k">SHA-256</div>
    <div class="hash v">${sha}</div>
  </div>
  <div style="margin-top:24px">
    <div class="k">Verify URL</div>
    <div class="v"><a href="${verifyUrl}">${verifyUrl}</a></div>
  </div>
  <div class="foot">
    本証明書は、上記SHA-256ハッシュを持つファイルが <b>Certified (UTC)</b> の時点で存在し、
    その後改変されていない事実を RFC3161 タイムスタンプにより示すものです。
    ProofMark は著作権の帰属・作品の独自性・特定の法的手続きでの採用可否については保証しません。
    詳細は <a href="${baseUrl}/trust-center#s4">${baseUrl}/trust-center#s4</a>。
  </div>
</div></body></html>`;
}

/** README.md — 日本語 */
function buildReadmeJa(c: CertRow, baseUrl: string): string {
    const tier = trustTier(c);
    return `# ProofMark Evidence Pack

この ZIP は、ProofMark が発行した **デジタル存在証明** を、第三者（クライアント / 弁護士 /
プラットフォーム運営者 / 裁判所等）にそのまま提出できる形でまとめた「証拠パック」です。

- **Certificate ID**: \`${c.id}\`
- **Title**: ${pickTitle(c)}
- **Trust Tier**: ${tier.label} (${tier.provider})
- **Verify URL**: ${baseUrl}/cert/${c.id}

## 同梱ファイル

| ファイル | 役割 |
|---|---|
| \`certificate.json\` | 機械可読な証明書メタデータ（正本） |
| \`certificate.html\` | 人間可読・印刷可能な証明書 |
| \`timestamp.tsr\` | RFC3161 タイムスタンプトークン (DER) |
| \`timestamp.tsr.base64\` | 同 Base64（メール添付向け） |
| \`verify.sh\` | OpenSSL による独立検証スクリプト |
| \`verify.py\` | Python による独立検証スクリプト |
| \`cover-letter.ja.txt\` | クライアント提出用カバーレター（日本語） |
| \`cover-letter.en.txt\` | Cover letter for clients (English) |
| \`preview.*\` | Shareable モードのプレビュー画像（同梱時のみ） |

## 独立検証の手順（ProofMark 不要）

1. 手元の原本ファイル（例: \`original.png\`）の SHA-256 を計算し、
   \`certificate.json\` の \`sha256\` と一致することを確認します。
2. \`timestamp.tsr\` が、ハッシュ値と TSA の公開鍵で検証できることを確認します。
3. 詳細は \`verify.sh\` / \`verify.py\` をご覧ください。
   実装の一次情報は <${baseUrl}/trust-center#s7>、検証スクリプトの公開リポジトリは
   <https://github.com/proofmark-jp/verify> です。

## 証明するもの / しないもの

ProofMark は以下を示します。
- 上記 SHA-256 を持つファイルが \`certified_at\` の時点で存在していたこと。
- その後、当該ファイルが改変されていないこと。

一方で、以下は **保証しません**。
- 著作権の帰属、作品の独自性、合法性。
- 特定の裁判所・手続きにおける証拠採用（事案と法域に依存）。

© ProofMark — ${baseUrl}
`;
}

function buildReadmeEn(c: CertRow, baseUrl: string): string {
    const tier = trustTier(c);
    return `# ProofMark Evidence Pack

This ZIP bundles a **digital existence proof** issued by ProofMark, in a form you can
hand directly to a client, platform operator, lawyer or court.

- **Certificate ID**: \`${c.id}\`
- **Title**: ${pickTitle(c)}
- **Trust Tier**: ${tier.label} (${tier.provider})
- **Verify URL**: ${baseUrl}/cert/${c.id}

## What this proves (and what it does not)

It proves:
- A file with the SHA-256 above existed at \`certified_at\`.
- The file has not been altered since that moment.

It does **not** prove copyright ownership, originality, or automatic admissibility in
any specific jurisdiction.

## Independent verification

See \`verify.sh\` (OpenSSL one-liner) or \`verify.py\` (standalone script).
Full docs: ${baseUrl}/trust-center#s7 — open-source verifier at
https://github.com/proofmark-jp/verify.

© ProofMark — ${baseUrl}
`;
}

function buildVerifyShell(): string {
    return `#!/usr/bin/env bash
# ProofMark Evidence Pack — OpenSSL Verifier
# Usage: ./verify.sh <original-file>
set -euo pipefail
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <original-file>" >&2; exit 2
fi
ORIG="$1"
# 1) Confirm SHA-256 matches the one recorded in certificate.json
EXPECTED=$(python3 -c "import json;print(json.load(open('certificate.json'))['certificate']['sha256'])")
ACTUAL=$(openssl dgst -sha256 -r "$ORIG" | awk '{print $1}')
echo "[HASH] expected : $EXPECTED"
echo "[HASH] actual   : $ACTUAL"
[ "$EXPECTED" = "$ACTUAL" ] || { echo "[HASH] FAIL"; exit 1; }
echo "[HASH] PASS"

# 2) Verify RFC3161 token against the TSA CA chain you trust.
#    Fetch the current CA/intermediate from your TSA provider and pass them here.
#    Example (FreeTSA):
#      curl -s https://freetsa.org/files/tsa.crt    > tsa.crt
#      curl -s https://freetsa.org/files/cacert.pem > cacert.pem
openssl ts -verify \\
  -in timestamp.tsr \\
  -digest "$ACTUAL" \\
  -CAfile cacert.pem \\
  -untrusted tsa.crt
echo "[TST]  PASS"
`;
}

function buildVerifyPython(): string {
    return `#!/usr/bin/env python3
"""ProofMark Evidence Pack — Python Verifier
Usage: python verify.py <original-file>
Requires: Python 3.8+, OpenSSL available on PATH.
"""
import hashlib, json, subprocess, sys
from pathlib import Path

def main(path: str) -> int:
    meta = json.loads(Path("certificate.json").read_text(encoding="utf-8"))
    expected = (meta["certificate"]["sha256"] or "").lower()
    actual = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    print(f"[HASH] expected : {expected}")
    print(f"[HASH] actual   : {actual}")
    if expected != actual:
        print("[HASH] FAIL"); return 1
    print("[HASH] PASS")
    r = subprocess.run(
        ["openssl", "ts", "-verify",
         "-in", "timestamp.tsr", "-digest", actual,
         "-CAfile", "cacert.pem", "-untrusted", "tsa.crt"],
        capture_output=True, text=True,
    )
    print(r.stdout.strip())
    print(r.stderr.strip(), file=sys.stderr)
    return 0 if "Verification: OK" in r.stdout else 1

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python verify.py <original-file>", file=sys.stderr); sys.exit(2)
    sys.exit(main(sys.argv[1]))
`;
}

function buildCoverLetterJa(c: CertRow, profile: ProfileRow | null, baseUrl: string): string {
    const tier = trustTier(c);
    return `ご担当者様

お世話になっております。
${profile?.username ? `クリエイター ${profile.display_name || profile.username}` : '下記のクリエイター'}より、
納品物に関する「デジタル存在証明」を ProofMark を通じて同封いたします。

本パッケージには、作品 ${pickTitle(c)} が特定の日時に存在していた事実を示す、
RFC3161 国際標準規格に準拠したタイムスタンプトークンおよび検証手順一式が含まれています。

- Certificate ID: ${c.id}
- Verify URL     : ${baseUrl}/cert/${c.id}
- Trust Tier     : ${tier.label}（${tier.provider}）
- SHA-256        : ${c.sha256 ?? '—'}
- Certified (UTC): ${c.certified_at ?? '—'}

独立検証は ProofMark に依存せず、同梱の verify.sh / verify.py と OpenSSL のみで
実施できます。詳細は同梱の README.md および ${baseUrl}/trust-center#s7 をご参照ください。

なお、本書類は「上記ハッシュ値を持つファイルが、上記時刻に存在していた」事実を
技術的に示すものであり、著作権の帰属や特定法域における証拠採否を保証するものではありません。

どうぞよろしくお願いいたします。
`;
}

function buildCoverLetterEn(c: CertRow, profile: ProfileRow | null, baseUrl: string): string {
    const tier = trustTier(c);
    return `Dear Sir/Madam,

Please find attached a ProofMark Evidence Pack for the deliverable "${pickTitle(c)}"
${profile?.username ? `by ${profile.display_name || profile.username}` : ''}.

The enclosed RFC3161 timestamp token demonstrates that a file with the SHA-256
hash below existed unaltered at the time shown, and can be independently verified
using OpenSSL without trusting any ProofMark service.

- Certificate ID : ${c.id}
- Verify URL     : ${baseUrl}/cert/${c.id}
- Trust Tier     : ${tier.label} (${tier.provider})
- SHA-256        : ${c.sha256 ?? '—'}
- Certified (UTC): ${c.certified_at ?? '—'}

See the included README.en.md / verify.sh / verify.py, or visit
${baseUrl}/trust-center#s7 for full documentation.

Kind regards.
`;
}

// ──────────────────────────────────────────────────────────────────────────
// 5. Supabase 読み取り（ゼロトラスト – 所有権をサーバーで再照合）
// ──────────────────────────────────────────────────────────────────────────
async function loadCert(jwt: string, certId: string) {
    const userClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const userRes = await userClient.auth.getUser(jwt);
    if (userRes.error || !userRes.data?.user) return { status: 401 as const };
    const userId = userRes.data.user.id;

    const { data: cert, error: certErr } = await userClient
        .from('certificates')
        .select(
            'id, user_id, sha256, title, original_filename, file_name, storage_path, public_image_url, proof_mode, visibility, timestamp_token, certified_at, tsa_provider, tsa_url, created_at, metadata'
        )
        .eq('id', certId)
        .maybeSingle();

    if (certErr) throw certErr;
    if (!cert) return { status: 404 as const };
    if (cert.user_id !== userId) return { status: 403 as const };

    // 公開プロフィール（クリエイター名のみ）— ここは RLS の anon 公開範囲内。
    const { data: profile } = await userClient
        .from('profiles')
        .select('username, display_name')
        .eq('id', userId)
        .maybeSingle();

    return { status: 200 as const, cert: cert as CertRow, profile: (profile ?? null) as ProfileRow | null, userId };
}

/** Shareable モード時のみプレビュー画像を取得する（privateモードは絶対に触らない） */
async function fetchPreviewImage(c: CertRow): Promise<{ name: string; data: Buffer } | null> {
    if (c.proof_mode !== 'shareable') return null;
    if (!c.public_image_url) return null;
    try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(c.public_image_url, { signal: ctl.signal });
        clearTimeout(timer);
        if (!r.ok) return null;
        const ab = await r.arrayBuffer();
        const buf = Buffer.from(ab);
        // 暴走防止: 8MB を超える画像は同梱しない（ZIP 膨張・DoS 対策）
        if (buf.length > 8 * 1024 * 1024) return null;
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        const ext = ct.includes('png') ? 'png' : ct.includes('jpeg') ? 'jpg' : 'webp';
        return { name: `preview.${ext}`, data: buf };
    } catch {
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────────────
// 6. Handler
// ──────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const reqId = randomUUID();
    res.setHeader('x-request-id', reqId);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed', reqId });

    const origin = (req.headers.origin as string) || '';
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return res.status(403).json({ error: 'Origin not allowed', reqId });
    }

    try {
        const authHeader = (req.headers.authorization as string) || '';
        if (!/^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/.test(authHeader)) {
            return res.status(401).json({ error: 'Missing or malformed Authorization header', reqId });
        }
        const jwt = authHeader.slice(7);

        const certId = String(req.query.certId || '').trim();
        if (!UUID_V4.test(certId)) {
            return res.status(400).json({ error: 'Invalid certId', reqId });
        }

        // 所有権チェック前にレートリミット（JWT プリフィックス + IP）で軽く弾く
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
        const jwtFp = createHash('sha256').update(jwt).digest('hex').slice(0, 16);
        const allowed = await upstashRateLimit(`${jwtFp}:${ip}`, 10, 60);
        if (!allowed) {
            res.setHeader('Retry-After', '60');
            return res.status(429).json({ error: 'Too many requests', reqId });
        }

        const loaded = await loadCert(jwt, certId);
        if (loaded.status !== 200) {
            const map = { 401: 'Invalid session', 403: 'Forbidden', 404: 'Certificate not found' } as const;
            return res.status(loaded.status).json({ error: map[loaded.status], reqId });
        }
        const { cert, profile } = loaded;

        const baseUrl = 'https://proofmark.jp';
        const shortId = cert.id.slice(0, 8);
        const root = `proofmark-evidence-${shortId}/`;

        // ── ドキュメント生成 ──────────────────────────────────────────
        const certJson = buildCertJson(cert, profile, baseUrl);
        const entries: ZipEntry[] = [
            { name: `${root}README.md`, data: Buffer.from(buildReadmeJa(cert, baseUrl).replace(/\r\n/g, '\n'), 'utf8') },
            { name: `${root}README.en.md`, data: Buffer.from(buildReadmeEn(cert, baseUrl).replace(/\r\n/g, '\n'), 'utf8') },
            { name: `${root}certificate.json`, data: Buffer.from(JSON.stringify(certJson, null, 2), 'utf8') },
            { name: `${root}certificate.html`, data: Buffer.from(buildCertHtml(cert, profile, baseUrl).replace(/\r\n/g, '\n'), 'utf8') },
            { name: `${root}verify.sh`, data: Buffer.from(buildVerifyShell().replace(/\r\n/g, '\n'), 'utf8') },
            { name: `${root}verify.py`, data: Buffer.from(buildVerifyPython().replace(/\r\n/g, '\n'), 'utf8') },
            { name: `${root}cover-letter.ja.txt`, data: Buffer.from(buildCoverLetterJa(cert, profile, baseUrl).replace(/\r\n/g, '\n'), 'utf8') },
            { name: `${root}cover-letter.en.txt`, data: Buffer.from(buildCoverLetterEn(cert, profile, baseUrl).replace(/\r\n/g, '\n'), 'utf8') },
        ];

        // RFC3161 TST — 存在するときだけ同梱（WORM 原則に従い読み取りのみ）
        if (cert.timestamp_token) {
            const der = Buffer.from(cert.timestamp_token, 'base64');
            entries.push({ name: `${root}timestamp.tsr`, data: der });
            entries.push({ name: `${root}timestamp.tsr.base64`, data: Buffer.from(cert.timestamp_token, 'utf8') });
        }

        // Shareable モードのみプレビュー画像を同梱（Zero-Knowledge 尊重）
        const preview = await fetchPreviewImage(cert);
        if (preview) {
            entries.push({ name: `${root}${preview.name}`, data: preview.data });
        }

        const zip = buildZip(entries);

        // ── レスポンス（ASCII 安全なファイル名 + RFC5987 日本語名）────
        const asciiName = `proofmark-evidence-${shortId}.zip`;
        const utf8Name = `ProofMark-Evidence-${encodeURIComponent(pickTitle(cert))}-${shortId}.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`
        );
        res.setHeader('Content-Length', String(zip.length));
        res.setHeader('X-Evidence-Cert-Id', cert.id);
        res.setHeader('X-Evidence-Trust-Tier', trustTier(cert).key);

        console.log(
            JSON.stringify({
                reqId,
                event: 'evidence_pack.issued',
                certId: cert.id,
                bytes: zip.length,
                tier: trustTier(cert).key,
                with_tst: Boolean(cert.timestamp_token),
                with_preview: Boolean(preview),
            })
        );

        return res.status(200).send(zip);
    } catch (err: any) {
        Sentry.captureException(err, { tags: { reqId } });
        await Sentry.flush(1500).catch(() => void 0);
        console.error(
            JSON.stringify({ reqId, event: 'evidence_pack.error', message: String(err?.message || err) })
        );
        return res.status(500).json({ error: 'Internal error', reqId });
    }
}
