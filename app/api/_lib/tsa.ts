/**
 * api/_lib/tsa.ts — RFC3161 Timestamp client with multi-TSA fallback.
 *
 * Why this module exists
 * ----------------------
 *  - `api/timestamp.ts` (synchronous user flow) and `api/webhooks/stripe.ts`
 *    (async Spot flow) BOTH need to ask a TSA for a token, parse the response,
 *    and tolerate the fact that public TSAs (FreeTSA in particular) are not
 *    rare to be down for 30s–10min.
 *  - We extract every detail of the RFC3161 protocol, the DER walker, and the
 *    fallback iterator into one tested module so the rest of the codebase has
 *    only one job: "give me a `.tsr` for this hash".
 *
 * Configuration
 * -------------
 *  - `TSA_URLS` env (comma-separated) defines the fallback chain.
 *    e.g.  "https://freetsa.org/tsr,http://time.certum.pl,http://timestamp.digicert.com"
 *  - If `TSA_URLS` is absent we fall back to a hard-coded sane default below.
 *  - `TSA_PROVIDER` env is the *label* we want to persist (e.g. "freetsa").
 *    A provider label is also resolved from the host of the URL that actually
 *    succeeded so we can record a precise audit trail.
 *
 * Security
 * --------
 *  - Each request is hard-bounded by `perAttemptTimeoutMs` (default 8000ms).
 *  - HTTP 4xx/5xx and abort-on-timeout both trigger the next URL.
 *  - The request body is the RFC3161 TSQ binary; the response must be
 *    `application/timestamp-reply` (we do not enforce content-type but we do
 *    validate that a GeneralizedTime is parsable from the response — that
 *    proves it is in fact a TSR and not an HTML error page).
 */

import { randomBytes } from 'node:crypto';

// ──────────────────────────────────────────────────────────────────────────
// Tunables
// ──────────────────────────────────────────────────────────────────────────
const DEFAULT_FALLBACK_URLS = [
    // Order matters. First = primary. Each one must speak RFC3161 over HTTP(S).
    'https://freetsa.org/tsr',
    'http://time.certum.pl',
    'http://timestamp.digicert.com',
];

export interface TsaRequestOptions {
    /** Override the fallback chain. If omitted, env `TSA_URLS` then defaults are used. */
    urls?: string[];
    /** Per-URL timeout in ms. Default 8000. */
    perAttemptTimeoutMs?: number;
    /** Optional structured logger callback. */
    log?: (event: Record<string, unknown>) => void;
}

export interface TsaResult {
    /** The raw RFC3161 TimeStampResp / TimeStampToken bytes. */
    tsr: Buffer;
    /** GeneralizedTime parsed from the TSR. */
    certifiedAt: Date;
    /** The URL that actually succeeded. */
    urlUsed: string;
    /** Stable provider label (e.g. "freetsa"). */
    providerLabel: string;
    /** Number of attempts made (1 = first URL succeeded). */
    attempts: number;
}

// ──────────────────────────────────────────────────────────────────────────
// RFC3161 TSQ construction
// ──────────────────────────────────────────────────────────────────────────
const OID_SHA256 = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
const ASN1_NULL = Buffer.from([0x05, 0x00]);

function derLength(len: number): Buffer {
    if (len < 0x80) return Buffer.from([len]);
    const bytes: number[] = [];
    let n = len;
    while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derTLV(tag: number, value: Buffer): Buffer {
    return Buffer.concat([Buffer.from([tag]), derLength(value.length), value]);
}

function derSequence(...parts: Buffer[]): Buffer {
    return derTLV(0x30, Buffer.concat(parts));
}

function derInteger(value: Buffer): Buffer {
    const needsPad = value.length > 0 && (value[0] & 0x80) !== 0;
    return derTLV(0x02, needsPad ? Buffer.concat([Buffer.from([0x00]), value]) : value);
}

/**
 * Build the RFC3161 TimeStampReq (TSQ) for a given SHA-256 hex hash.
 * A 16-byte cryptographic nonce is embedded for replay protection.
 */
export function buildTsq(hashHex: string, nonce: Buffer = randomBytes(16)): Buffer {
    if (!/^[0-9a-f]{64}$/i.test(hashHex)) {
        throw new Error('buildTsq: hashHex must be 64 lowercase hex characters');
    }
    const version = derTLV(0x02, Buffer.from([0x01]));
    const algId = derSequence(OID_SHA256, ASN1_NULL);
    const msgImprint = derSequence(algId, derTLV(0x04, Buffer.from(hashHex.toLowerCase(), 'hex')));
    const nonceDer = derInteger(nonce);
    const certReq = derTLV(0x01, Buffer.from([0xff]));
    return derSequence(version, msgImprint, nonceDer, certReq);
}

// ──────────────────────────────────────────────────────────────────────────
// DER walker — robust against CMS OCTET STRING encapsulation
// ──────────────────────────────────────────────────────────────────────────
interface DerNode {
    tag: number;
    start: number;
    contentStart: number;
    contentEnd: number;
}

function readDer(buf: Buffer, offset: number): DerNode {
    const tag = buf[offset];
    let i = offset + 1;
    let len = buf[i++];
    if (len & 0x80) {
        const n = len & 0x7f;
        len = 0;
        for (let k = 0; k < n; k++) len = (len << 8) | buf[i++];
    }
    return { tag, start: offset, contentStart: i, contentEnd: i + len };
}

function walkChildren(buf: Buffer, parent: DerNode): DerNode[] {
    const out: DerNode[] = [];
    let cursor = parent.contentStart;
    while (cursor < parent.contentEnd) {
        const node = readDer(buf, cursor);
        out.push(node);
        cursor = node.contentEnd;
    }
    return out;
}

function findGenTime(buf: Buffer, root: DerNode, depth = 0): string | null {
    if (depth > 20) return null;
    if (root.tag === 0x18) return buf.subarray(root.contentStart, root.contentEnd).toString('ascii');
    // CMS OCTET STRING that encapsulates a SEQUENCE — descend transparently.
    if (root.tag === 0x04 && root.contentEnd > root.contentStart && buf[root.contentStart] === 0x30) {
        const enc = readDer(buf, root.contentStart);
        const found = findGenTime(buf, enc, depth + 1);
        if (found) return found;
    }
    // Only descend constructed types.
    if ((root.tag & 0x20) === 0) return null;
    for (const child of walkChildren(buf, root)) {
        const found = findGenTime(buf, child, depth + 1);
        if (found) return found;
    }
    return null;
}

function parseGenTime(s: string): Date | null {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{1,3}))?Z$/.exec(s);
    if (!m) return null;
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? '.' + m[7].padEnd(3, '0') : ''}Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a `.tsr` (TimeStampResp/Token) buffer and return the GeneralizedTime as a Date.
 * Throws if no GeneralizedTime is found — that means the response is not a valid TSR.
 */
export function parseTsr(tsr: Buffer): Date {
    if (!Buffer.isBuffer(tsr) || tsr.length < 16) {
        throw new Error('parseTsr: empty or invalid buffer');
    }
    const root = readDer(tsr, 0);
    const gt = findGenTime(tsr, root);
    const certifiedAt = gt ? parseGenTime(gt) : null;
    if (!certifiedAt) throw new Error('parseTsr: response did not contain a parsable GeneralizedTime');
    return certifiedAt;
}

// ──────────────────────────────────────────────────────────────────────────
// Provider label resolution
// ──────────────────────────────────────────────────────────────────────────
/** Map a TSA URL to a stable provider label that we persist into the DB. */
export function resolveProviderLabel(url: string): string {
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (host.includes('freetsa.org')) return 'freetsa';
        if (host.includes('certum.pl')) return 'certum';
        if (host.includes('digicert')) return 'digicert';
        if (host.includes('globalsign')) return 'globalsign';
        if (host.includes('sectigo')) return 'sectigo';
        if (host.includes('seiko')) return 'seiko';
        return host.replace(/[^a-z0-9]+/g, '-');
    } catch {
        return 'unknown';
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Fallback iterator
// ──────────────────────────────────────────────────────────────────────────
function readEnvUrls(): string[] | null {
    const raw = process.env.TSA_URLS;
    if (!raw) return null;
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : null;
}

/**
 * Request a TimeStampToken (`.tsr`) for a given SHA-256 hex hash, automatically
 * trying every URL in the fallback chain until one succeeds or all fail.
 *
 * Returns the bytes, the parsed certifiedAt, the URL that succeeded, and a
 * provider label suitable for persisting into the DB.
 */
export async function requestTimestampWithFallback(
    hashHex: string,
    forceFreeTsaOrOptions: boolean | TsaRequestOptions = false,
    optionsObj: TsaRequestOptions = {},
): Promise<TsaResult> {
    const isForceFree = typeof forceFreeTsaOrOptions === 'boolean' ? forceFreeTsaOrOptions : false;
    const options = typeof forceFreeTsaOrOptions === 'object' ? forceFreeTsaOrOptions : optionsObj;

    const urls = isForceFree ? ['https://freetsa.org/tsr'] : (options.urls ?? readEnvUrls() ?? DEFAULT_FALLBACK_URLS);
    const timeoutMs = options.perAttemptTimeoutMs ?? 8000;
    const log = options.log ?? (() => undefined);

    if (urls.length === 0) {
        throw new Error('requestTimestampWithFallback: no TSA URLs configured');
    }

    const tsq = buildTsq(hashHex);
    const errors: Array<{ url: string; message: string }> = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const startedAt = Date.now();

        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/timestamp-query',
                    Accept: 'application/timestamp-reply',
                },
                body: tsq,
                signal: controller.signal,
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            const ab = await resp.arrayBuffer();
            const tsr = Buffer.from(ab);
            const certifiedAt = parseTsr(tsr); // throws if not a valid TSR
            const providerLabel = resolveProviderLabel(url);

            log({ event: 'tsa.success', url, providerLabel, attempts: i + 1, latencyMs: Date.now() - startedAt });
            return { tsr, certifiedAt, urlUsed: url, providerLabel, attempts: i + 1 };
        } catch (err) {
            const message = (err as Error)?.message ?? String(err);
            errors.push({ url, message });
            log({ event: 'tsa.attempt_failed', url, message, attemptIndex: i + 1, latencyMs: Date.now() - startedAt });
            continue;
        } finally {
            clearTimeout(timer);
        }
    }

    const summary = errors.map((e) => `${e.url}: ${e.message}`).join(' | ');
    throw new Error(`All TSA endpoints failed: ${summary}`);
}
