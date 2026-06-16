/**
 * api/widget-cert.ts — ADR-009 Phase 2.5: Edge Data Proxy
 * ──────────────────────────────────────────────────────────
 * WidgetがDBを直接叩かないようにするVercel Edge Proxy。
 * Vercel Edge NetworkがこのレスポンスをキャッシュするためDB接続は
 * TTL内に1回だけしか発生しない（DBコネクション枯渇防衛）。
 *
 * Cache-Control: s-maxage=3600 → Vercel Edgeで1時間キャッシュ
 *                stale-while-revalidate=86400 → 24時間はstaleでも即返す
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/* ── Supabase client (Service Role) ── */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const SELECT_COLS =
  'id, title, public_image_url, public_verify_token, proven_at, c2pa_manifest';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  /* GET のみ許可 */
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const id = typeof req.query.id === 'string' ? req.query.id.trim() : null;
  if (!id) {
    return res.status(400).json({ error: 'Missing required query param: id' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  /* id か public_verify_token のどちらでも引けるように or 条件 */
  const { data, error } = await supabase
    .from('certificates')
    .select(SELECT_COLS)
    .or(`id.eq.${id},public_verify_token.eq.${id}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[widget-cert] supabase error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  if (!data) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  /* Edge Cache: 証明書は immutable なので長めにキャッシュ */
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=86400',
  );
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json(data);
}

export const config = { runtime: 'edge' };

