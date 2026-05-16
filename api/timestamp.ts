/**
 * api/timestamp.ts — RFC3161 Timestamp Issuer (Server Authority)
 *
 * v2.3 — per-plan hard quota via QUOTA_MAP (Creator 30/mo, Studio 150/mo).
 *
 * Quota strategy:
 *  - All plans are subject to monthly hard limits enforced by Redis (QUOTA_MAP).
 *  - admin tier is the only bypass (原価防衛のため PAID_TIERS バイパスを廃止).
 *  - On Redis failure the endpoint is fail-open to avoid service disruption.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
import { requestTimestampWithFallback } from './_lib/tsa.js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { incrementAndCheckCertIssue, rollbackIncrement } from './_lib/rate-limit.js';

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
// 1. Rate Limit (Upstash Redis — Fail-open)
// ──────────────────────────────────────────────────────────────────────────
let ratelimit: Ratelimit | null = null;
try {
    const redis = new Redis({
        url: process.env.KV_REST_API_URL || '',
        token: process.env.KV_REST_API_TOKEN || '',
    });
    ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'), // 1分間に20回まで
        analytics: true,
        prefix: 'ratelimit_ts',
    });
} catch (error) {
    console.error('[RateLimit] Initialization failed:', error);
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
// 5. Plan helpers
// ──────────────────────────────────────────────────────────────────────────
type PlanTier = 'free' | 'light' | 'creator' | 'studio' | 'admin';

async function fetchUserPlanTier(admin: SupabaseClient, userId: string): Promise<PlanTier> {
  const { data } = await admin.from('profiles').select('plan_tier').eq('id', userId).maybeSingle();
  const t = (data as { plan_tier?: string } | null)?.plan_tier;
  if (t === 'creator' || t === 'studio' || t === 'admin' || t === 'light' || t === 'free') return t;
  return 'free';
}

// ──────────────────────────────────────────────────────────────────────────
// 6. Handler
// ──────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const reqId = randomUUID();
  res.setHeader('x-request-id', reqId);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', reqId });
  const origin = (req.headers.origin as string) || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Origin not allowed', reqId });

  let userId = '';
  let planTier: PlanTier = 'free';
  let quotaConsumed = false; // 👈 枠消費トラッキング用

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
    userId = userData.user.id;

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';

    // --- Rate Limit Check (Upstash Redis) ---
    if (ratelimit) {
        try {
            const { success, reset } = await ratelimit.limit(`${userId}:${ip}`);
            if (!success) {
                const retryAfter = Math.ceil((reset - Date.now()) / 1000);
                res.setHeader('Retry-After', String(retryAfter));
                return res.status(429).json({ error: 'Too many requests', reqId });
            }
        } catch (limitError) {
            // Fail-open: Redis障害時はクラッシュさせず通過させる
            console.error('[RateLimit] Error:', limitError);
        }
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

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    planTier = await fetchUserPlanTier(adminClient, userId);

    // 全プラン共通のハードロック（原価防衛）— QUOTA_MAP に従い admin 以外はすべて Redis で枠管理
    const rlResult = await incrementAndCheckCertIssue({ userId, planTier });
    if (!rlResult.bypassed) {
      if (!rlResult.ok) {
        return res.status(429).json({
          error: `You have reached the limit of ${rlResult.quota} timestamps per month for your plan.`,
          quota: rlResult.quota,
          used: rlResult.used, // ここには正確な値が入る
          plan: planTier,
          reqId,
        });
      }
      quotaConsumed = true; // 👈 枠の消費を確定
    }

    // Freeプランの場合は商用TSAの原価流出を防ぐため、強制的にFreeTSAへルーティング
    const forceFree = planTier === 'free';
    const tsaResult = await requestTimestampWithFallback(body.hash, forceFree);
    const timestampTokenBase64 = tsaResult.tsr.toString('base64');
    const certifiedAt = tsaResult.certifiedAt;
    const TSA_PROVIDER = tsaResult.providerLabel;
    const TSA_URL = tsaResult.urlUsed;

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

    console.log(JSON.stringify({ reqId, event: 'rfc3161.issued', userId, certId: body.certId, hash: body.hash, tsa: TSA_PROVIDER, plan: planTier, certified_at: certifiedAt.toISOString() }));

    return res.status(200).json({ success: true, certified_at: certifiedAt.toISOString(), tsa_provider: TSA_PROVIDER, plan: planTier, reqId });
  } catch (error: any) {
    // 🚨 処理中にエラーが起きた場合、消費した枠を確実に返却する
    if (quotaConsumed) {
      await rollbackIncrement({ userId, planTier }).catch(e => console.error('[RateLimit] Rollback failed:', e));
    }
    
    Sentry.captureException(error, { tags: { reqId } });
    await Sentry.flush(1500).catch(() => void 0);
    console.error(JSON.stringify({ reqId, event: 'rfc3161.error', message: String(error?.message || error) }));
    return res.status(500).json({ error: 'Internal error', reqId });
  }
}
