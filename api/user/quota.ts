/**
 * api/user/quota.ts — The Revenue Firewall
 *
 * - Zero-Trust Auth (JWT Session Unpacking)
 * - Edge Rate Limiting (Anti DB-Thrashing)
 * - Monthly Usage Calculation
 */

export const config = { runtime: 'edge' };

import { getAuthenticatedUserId, json, supabaseAdmin } from '../_shared.js';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });

  // 1. Edge Rate Limiting (DB過労死防衛: 10秒に5回)
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL || '',
      token: process.env.KV_REST_API_TOKEN || '',
    });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 s'),
      analytics: true,
    });
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success } = await ratelimit.limit(`pm_quota_${ip}`);
    if (!success) return json(429, { error: 'Too many requests' });
  } catch (e) { console.warn('[RateLimit bypass]', e); }

  try {
    // 2. Zero-Trust Auth (クライアントからのID指定は一切信用しない)
    const userId = await getAuthenticatedUserId(request);

    // 3. プランの取得
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan_tier')
      .eq('id', userId)
      .maybeSingle();
      
    const plan = profile?.plan_tier || 'free';
    
    // プラン別上限の定義
    let limit = 3;
    if (plan === 'business') limit = 1000;
    else if (plan === 'studio') limit = 150;
    else if (plan === 'creator') limit = 30;

    // 4. 今月の消費量を計算 (JST基準の月初の取得)
    const nowJst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const firstDayOfMonth = new Date(nowJst.getFullYear(), nowJst.getMonth(), 1).toISOString();

    const { count, error } = await supabaseAdmin
      .from('certificates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('proof_mode', 'spot')
      .gte('created_at', firstDayOfMonth);

    if (error) throw new Error('Failed to fetch usage');

    const used = count || 0;
    const remaining = Math.max(0, limit - used);

    return json(200, {
      plan,
      limit,
      used,
      remaining
    });

  } catch (err: any) {
    const status = err.message === 'Unauthorized' ? 401 : 500;
    return json(status, { error: err.message || 'Internal Server Error' });
  }
}