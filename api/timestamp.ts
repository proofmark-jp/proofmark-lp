/**
 * api/timestamp.ts — RFC3161 Timestamp Issuer (Server Authority)
 *
 * Design principles (post-audit, v2.1):
 * 1. Server is the single source of truth for Supabase URL, service role key, and TSA endpoint.
 * 2. Zero trust input: certId is validated as UUID, hash as 64-char hex, Auth header via Supabase.
 * 3. Ownership enforced server-side.
 * 4. RFC3161 TSQ built with cryptographic nonce.
 * 5. Structured DER walker parses genTime, correctly unpacking CMS OCTET STRING encapsulation.
 * 6. Idempotency & Observability fully implemented.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';

// ──────────────────────────────────────────────────────────────────────────
// 0. Config
// ──────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const TSA_URL = process.env.TSA_URL || 'https://freetsa.org/tsr';
const TSA_PROVIDER = process.env.TSA_PROVIDER || 'freetsa';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://proofmark.jp,https://www.proofmark.jp')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
// 1. Rate Limit
// ─────────────────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Input validation
// ──────────────────────────────────────────────────────────────────────────
const HEX64 = /^[0-9a-f]{64}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface TimestampRequestBody {
  hash: string;
  certId: string;
}

function parseBody(body: unknown): TimestampRequestBody | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.hash !== 'string' || typeof b.certId !== 'string') return null;
  const hash = b.hash.toLowerCase();
  if (!HEX64.test(hash)) return null;
  if (!UUID_V4.test(b.certId)) return null;
  return { hash, certId: b.certId };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. RFC3161 TSQ construction
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

function buildTsq(hashHex: string, nonce: Buffer): Buffer {
  const version = derTLV(0x02, Buffer.from([0x01]));
  const algId = derSequence(OID_SHA256, ASN1_NULL);
  const msgImprint = derSequence(algId, derTLV(0x04, Buffer.from(hashHex, 'hex')));
  const nonceDer = derInteger(nonce);
  const certReq = derTLV(0x01, Buffer.from([0xff]));
  return derSequence(version, msgImprint, nonceDer, certReq);
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Robust DER walker (CMS Encapsulation support)
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
  if (depth > 20) return null; // Increased depth for deep CMS nesting
  
  if (root.tag === 0x18) {
    // Found GeneralizedTime
    return buf.subarray(root.contentStart, root.contentEnd).toString('ascii');
  }

  // 👑 PRO FIX: Unpack CMS OCTET STRING (0x04) encapsulation safely
  if (root.tag === 0x04 && root.contentEnd > root.contentStart) {
    // If the content inside the OCTET STRING looks like a SEQUENCE (0x30), unpack it
    if (buf[root.contentStart] === 0x30) {
      const encapsulatedRoot = readDer(buf, root.contentStart);
      const found = findGenTime(buf, encapsulatedRoot, depth + 1);
      if (found) return found;
    }
  }

  // Only descend into constructed types (SEQUENCE / SET / context-specific)
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

// ──────────────────────────────────────────────────────────────────────────
// 5. Handler
// ──────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const reqId = randomUUID();
  res.setHeader('x-request-id', reqId);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', reqId });
  const origin = (req.headers.origin as string) || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Origin not allowed', reqId });

  try {
    const authHeader = (req.headers.authorization as string) || '';
    if (!/^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/.test(authHeader)) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header', reqId });
    }
    const jwt = authHeader.slice(7);

    const body = parseBody(req.body);
    if (!body) return res.status(400).json({ error: 'Invalid body. Expected { hash: hex64, certId: uuid }.', reqId });

    const userClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session', reqId });
    const userId = userData.user.id;

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(`${userId}:${ip}`);
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retryAfter));
      return res.status(429).json({ error: 'Too many requests', reqId });
    }

    const { data: cert, error: certErr } = await userClient
      .from('certificates')
      .select('id, user_id, sha256, timestamp_token, certified_at')
      .eq('id', body.certId)
      .maybeSingle();

    if (certErr) throw certErr;
    if (!cert) return res.status(404).json({ error: 'Certificate not found', reqId });
    if (cert.user_id !== userId) return res.status(403).json({ error: 'Forbidden', reqId });
    if (cert.sha256 && cert.sha256.toLowerCase() !== body.hash) return res.status(409).json({ error: 'Hash mismatch against stored certificate', reqId });

    if (cert.timestamp_token && cert.certified_at) {
      return res.status(200).json({
        success: true,
        certified_at: cert.certified_at,
        idempotent: true,
        reqId,
      });
    }

    const nonce = randomBytes(16);
    const tsq = buildTsq(body.hash, nonce);

    const tsaController = new AbortController();
    const tsaTimer = setTimeout(() => tsaController.abort(), 8_000);
    let tsr: Buffer;
    try {
      const resp = await fetch(TSA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/timestamp-query', Accept: 'application/timestamp-reply' },
        body: tsq,
        signal: tsaController.signal,
      });
      if (!resp.ok) throw new Error(`TSA HTTP ${resp.status}`);
      const ab = await resp.arrayBuffer();
      tsr = Buffer.from(ab);
    } finally {
      clearTimeout(tsaTimer);
    }

    const root = readDer(tsr, 0);
    const gt = findGenTime(tsr, root);
    const certifiedAt = gt ? parseGenTime(gt) : null;
    if (!certifiedAt) throw new Error('TSA response did not contain a parsable GeneralizedTime');

    const timestampTokenBase64 = tsr.toString('base64');

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: updErr } = await adminClient
      .from('certificates')
      .update({
        timestamp_token: timestampTokenBase64,
        tsa_provider: TSA_PROVIDER,
        tsa_url: TSA_URL,
        certified_at: certifiedAt.toISOString(),
      })
      .eq('id', body.certId)
      .eq('user_id', userId)
      .is('timestamp_token', null);

    if (updErr) throw updErr;

    console.log(JSON.stringify({ reqId, event: 'rfc3161.issued', userId, certId: body.certId, hash: body.hash, tsa: TSA_PROVIDER, certified_at: certifiedAt.toISOString() }));

    return res.status(200).json({ success: true, certified_at: certifiedAt.toISOString(), tsa_provider: TSA_PROVIDER, reqId });
  } catch (error: any) {
    Sentry.captureException(error, { tags: { reqId } });
    await Sentry.flush(1500).catch(() => void 0);
    console.error(JSON.stringify({ reqId, event: 'rfc3161.error', message: String(error?.message || error) }));
    return res.status(500).json({ error: 'Internal error', reqId });
  }
}