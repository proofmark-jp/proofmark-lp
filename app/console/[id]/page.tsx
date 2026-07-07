/**
 * app/console/[id]/page.tsx — ProofMark Console (Server-Only Shell)
 * ─────────────────────────────────────────────────────────────────────────────
 * Next.js 15 App Router / React Server Component.
 *
 *   フェーズ 1 の役割:
 *     - 動的セグメント `id` を Next.js 15 仕様 (Promise) で受け取り await
 *     - Supabase から certificates を .eq('id', id).single() で 1 件取得
 *     - 存在しなければ notFound() を発動
 *     - 旧 Vite 版の <div className="min-h-screen text-white relative" ...>
 *       による radial-gradient 背景と <Navbar /> の配置を維持
 *     - 実際の Client UI は <InspectorClient cert={cert} /> にすべて委譲
 *       (実装はフェーズ 2 で行うため、ここでは呼び出すのみ)
 *
 *   絶対禁止:
 *     - 'use client'
 *     - useState / useEffect などによるクライアント側フェッチ
 *     - 省略 (// ... の類)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cache } from 'react';

import InspectorClient from '@/components/console/inspector/InspectorClient';

/* ═══════════════════════════════════════════════════════════════
   TYPES — 旧 Vite 版 CertRow を完全踏襲した Server-Side 型
   ═══════════════════════════════════════════════════════════════ */

export type DeliveryStatus =
  | 'in_progress'
  | 'review'
  | 'ready'
  | 'delivered'
  | 'archived';

export interface CertificateRow {
  id: string;
  user_id: string;
  title: string | null;
  is_starred: boolean | null;
  file_name: string | null;
  file_hash: string | null;
  sha256: string | null;
  thumbnail_url: string | null;
  public_image_url: string | null;
  proof_mode: string | null;
  visibility: string | null;
  created_at: string;
  certified_at: string | null;
  tsa_provider: string | null;
  timestamp_token: string | null;
  cross_anchors: Array<{ provider: string; certified_at: string }> | null;
  is_archived: boolean | null;
  client_project: string | null;
  project_id: string | null;
  delivery_status: DeliveryStatus | null;
  team_id: string | null;
  original_filename: string | null;
  metadata: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  process_bundle_id: string | null;
}

/* ═══════════════════════════════════════════════════════════════
   Next.js 15 動的ルーティング仕様: params は Promise
   ═══════════════════════════════════════════════════════════════ */

interface ConsolePageProps {
  params: Promise<{ id: string }>;
}

/* ═══════════════════════════════════════════════════════════════
   Supabase Server Client (SSR 対応 / cookies() ベース)
   ─── @supabase/ssr の推奨パターン。RLS を尊重する。
   ═══════════════════════════════════════════════════════════════ */

async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[ProofMark] Supabase env が未設定です: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Component からの set は無視される場合があるため握りつぶす
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // 同上
        }
      },
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   Data Fetch — React cache() による二重フェッチ防止と認証ゲートウェイ
   ═══════════════════════════════════════════════════════════════ */

const fetchCertificateById = cache(async (id: string): Promise<CertificateRow | null> => {
  const supabase = await getSupabaseServerClient();
  
  // 🚨 The Apex Fix 1: 認証チェックと /login への安全なリダイレクト
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // 🚨 The Apex Fix 2: ワイルドカード防衛を維持しつつ、user_id の二重ロックを掛ける
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id) // The Multi-Tenant Shield
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error(`[Supabase Error] ID: ${id}, Code: ${error.code}, Message: ${error.message}, Details: ${error.details}`);
    throw new Error(`[ProofMark] certificates fetch failed: ${error.message}`);
  }

  return data as unknown as CertificateRow;
});

/* ═══════════════════════════════════════════════════════════════
   Metadata — Console 用の最小限メタ
   ═══════════════════════════════════════════════════════════════ */

export async function generateMetadata(
  { params }: ConsolePageProps,
): Promise<Metadata> {
  const { id } = await params;

  try {
    const cert = await fetchCertificateById(id);
    if (!cert) {
      return {
        title: 'Not Found · ProofMark Console',
        robots: { index: false, follow: false },
      };
    }

    const title = cert.title ?? cert.file_name ?? 'Untitled';
    return {
      title: `${title} · ProofMark Console`,
      description: 'ProofMark Evidence Console — inspector view.',
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: 'ProofMark Console',
      robots: { index: false, follow: false },
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Cache Policy — 認証データを含むため常時 dynamic
   ═══════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════
   PAGE (Server Component)
   ═══════════════════════════════════════════════════════════════ */

export default async function ConsoleInspectorPage(
  { params }: ConsolePageProps,
) {
  const { id } = await params;

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    notFound();
  }

  const cert = await fetchCertificateById(id);

  if (!cert) {
    notFound();
  }

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(108,62,244,0.06), transparent 60%), linear-gradient(180deg, #07061A 0%, #0a0a16 100%)',
      }}
    >
      {/* Global ambient aura — 旧 Vite 版と同じ静的レイヤー (アニメは Client 側で復元) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"
      >
        <div
          className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#6C3EF4] opacity-[0.08] blur-[160px]"
        />
        <div
          className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-[#00D4AA] opacity-[0.08] blur-[160px]"
        />
      </div>

      {/* Main content — Client 側 Inspector にデータを引き渡す */}
      <main className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 pb-24 pt-8">
        <InspectorClient cert={cert} />
      </main>
    </div>
  );
}
