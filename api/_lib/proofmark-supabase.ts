/**
 * Vault 用 Supabase クライアント。
 *
 * - Service Role Key を使う (RLS を経由せず public 表記の cert を堅実に拾う)
 * - 取得失敗時は null を返し、呼び出し側がフォールバック OGP を返せるようにする
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
    if (client) return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: 'public' },
    });
    return client;
}

export interface VaultCertificate {
    id: string;
    title: string | null;
    sha256: string;
    proof_mode: string | null;
    visibility: string | null;
    badge_tier: string | null;
    proven_at: string | null;
    certified_at: string | null;
    tsa_provider: string | null;
    timestamp_token: string | null;
    cross_anchors: ReadonlyArray<unknown> | null;
    username: string | null;
    display_name: string | null;
    is_founder: boolean | null;
}

/**
 * 1.2 秒以内に応答がなければ諦めてフォールバックへ。
 * (OG は CDN キャッシュ前提なので、まれな初回ヒットは粗くても許容)
 */
export async function fetchCertificateForOG(
  id: string,
): Promise<VaultCertificate | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);

  try {
    const { data, error } = await supabase
      .from('certificates')
      .select(`
        id, title, sha256, proof_mode, visibility, badge_tier, proven_at, certified_at, tsa_provider, timestamp_token, cross_anchors,
        profiles (
          username, display_name, is_founder
        )
      `)
      .eq('id', id)
      .maybeSingle()
      .abortSignal(controller.signal);

    if (error || !data) return null;

    if (data.visibility === 'private') return null;

    const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

    return {
      id: data.id,
      title: data.title,
      sha256: data.sha256,
      proof_mode: data.proof_mode,
      visibility: data.visibility,
      badge_tier: data.badge_tier,
      proven_at: data.proven_at,
      certified_at: data.certified_at,
      tsa_provider: data.tsa_provider,
      timestamp_token: data.timestamp_token,
      cross_anchors: data.cross_anchors,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      is_founder: profile?.is_founder ?? false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
