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

export default async function handler(req: Request): Promise<Response> {
  const headers = { 'Content-Type': 'application/json' };

  /* GET のみ許可 */
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers }
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim() || null;
  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Missing required query param: id' }),
      { status: 400, headers }
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration' }),
      { status: 500, headers }
    );
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
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers }
    );
  }

  if (!data) {
    return new Response(
      JSON.stringify({ error: 'Certificate not found' }),
      { status: 404, headers }
    );
  }

  /* Edge Cache: 証明書は immutable なので長めにキャッシュ */
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

export const config = { runtime: 'edge' };
