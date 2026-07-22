// ============================================================================
//  ProofMark Enterprise System: Certificate Server Component (The Absolute Apex)
//  File: app/cert/[id]/page.tsx
// ============================================================================

import { cache } from 'react';
import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient as createClientServer } from '@/utils/supabase/server';

// クライアントコンポーネント（装甲）のインポート
import CertificateClient from './CertificateClient';

// 🚨 妥協の排除: Next.jsのキャッシュトラップ（亡霊データ）を粉砕
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

export type ProcessBundleData = Record<string, unknown>;

export type CertificateInitialData = {
  cert: {
    id: string;
    title: string;
    size_bytes: number;
    mime_type: string;
    sha256_hash: string;
    timestamp_jst: string;
    timestamp_iso: string;
    proof_mode: string;
    visibility: string;
    tsr_token_base64: string;
    thumbnail_data_url: string | null;
    creator_display_name: string;
    legal_name: string;
    default_persona: string;
    moderation_status: string;
    is_asset_purged: boolean;
    c2pa_manifest: Record<string, unknown> | null;
    // Server-Side Derived States (セキュリティとFinOpsの完全両立)
    is_owner: boolean;
    is_premium_unlocked: boolean;
  };
  authorProfile: {
    id: string;
    username: string;
    avatar_url: string;
    legal_name: string;
    default_persona: string;
    is_founder: boolean;
  } | null;
  bundle: ProcessBundleData | null;
};

const PAID_TIERS = new Set(['light', 'creator', 'studio', 'business', 'admin']);

/**
 * Database Engine (Zero-Latency Direct Fetch)
 * Request Memoizationにより、メタデータ生成とページ描画でのクエリ重複を物理排除。
 */
const fetchCertificateData = cache(async (id: string): Promise<CertificateInitialData | null> => {
  const supabase = await createClientServer();

  // 1. 閲覧ユーザー自身のセッションをサーバー側で即時検証
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    console.warn(`[ProofMark/cert/${id}] Auth context resolution warning:`, authErr);
  }

  // 2. 証明書コアデータの取得
  const { data: certData, error: certError } = await supabase
    .from('certificates')
    .select('*')
    .eq('id', id)
    .single();

  if (certError || !certData) {
    return null; // データ不在、またはRLSの壁による閲覧権限なしは404へ
  }

  const isOwner = !!user && user.id === certData.user_id;

  // 🚨 妥協の排除: 凍結アセットのRSCデータ漏洩を物理的ハードパージ
  // 違法アセットのメタデータ（URL、ハッシュ等）をこの時点で完全に上書きし、クライアントへの流出を断つ
  if (certData.moderation_status === 'suspended') {
    return {
      cert: {
        id: certData.id,
        title: 'Suspended Asset',
        size_bytes: 0,
        mime_type: 'application/octet-stream',
        sha256_hash: '',
        timestamp_jst: '',
        timestamp_iso: '',
        proof_mode: 'private',
        visibility: 'private',
        tsr_token_base64: '',
        thumbnail_data_url: null,
        creator_display_name: '',
        legal_name: '',
        default_persona: '',
        moderation_status: 'suspended',
        is_asset_purged: true,
        c2pa_manifest: null,
        is_owner: isOwner,
        is_premium_unlocked: false,
      },
      authorProfile: null,
      bundle: null
    };
  }

  // 3. 著作者プロフィールとProcess Bundleの「並列フェッチ」 (Waterfallの排除)
  const profilePromise = certData.user_id
    ? supabase
        .from('profiles')
        .select('id, username, avatar_url, legal_name, default_persona, plan_tier, is_founder')
        .eq('id', certData.user_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null, count: null, status: 200, statusText: 'OK' });

  const bundlePromise = (certData.process_bundle_id && certData.public_verify_token)
    ? supabase
        .from('process_bundles')
        .select('*')
        .eq('public_verify_token', certData.public_verify_token)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null, count: null, status: 200, statusText: 'OK' });

  const [profileResult, bundleResult] = await Promise.all([profilePromise, bundlePromise]);

  // Observability: データベース障害をサイレントに握り潰さずログに刻む
  if (profileResult.error) {
    console.error(`[ProofMark/cert/${id}] Profile Query Error:`, profileResult.error);
  }
  if (bundleResult.error) {
    console.error(`[ProofMark/cert/${id}] Bundle Query Error:`, bundleResult.error);
  }

  const authorProfile = profileResult.data;
  const bundleData = bundleResult.data;

  // 4. 所有権 (is_owner) と有償機能権限 (is_premium_unlocked) のサーバー側での早期確定
  // 🚨 妥協の排除: ダウンロード権限は「閲覧者」ではなく「作者（Owner）」のプランで判定する
  let ownerPlan = 'free';
  if (authorProfile?.plan_tier) {
    ownerPlan = authorProfile.plan_tier.toLowerCase();
  }
  const isPremiumUnlocked = PAID_TIERS.has(ownerPlan);

  // 5. 耐障害性日付パース
  let timestampJst = 'Unknown Date';
  try {
    if (certData.created_at) {
      timestampJst = new Date(certData.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    }
  } catch (e) {
    console.error(`[ProofMark/cert/${id}] Date canonicalization failed:`, e);
  }

  // 6. クライアント要求形式への厳格マッピング (Hydration Leak の物理遮断)
  // 🚨 certData.user_id や storage_path を spread構文(...certData)で漏洩させないゼロトラスト設計
  return {
    cert: {
      id: certData.id,
      title: certData.title || certData.original_filename || 'Untitled Archive',
      size_bytes: certData.size_bytes || certData.file_size || 0,
      mime_type: certData.mime_type || 'application/octet-stream',
      sha256_hash: certData.sha256 || certData.chain_sha256 || '',
      timestamp_jst: timestampJst,
      timestamp_iso: certData.created_at || new Date().toISOString(),
      proof_mode: certData.proof_mode || 'private',
      visibility: certData.visibility || 'private',
      tsr_token_base64: certData.tsr_token_base64 || '',
      thumbnail_data_url: certData.public_image_url || null,
      moderation_status: certData.moderation_status || 'active',
      is_asset_purged: Boolean(certData.is_asset_purged),
      c2pa_manifest: (certData.c2pa_manifest as Record<string, unknown> | null) || null,
      creator_display_name: authorProfile?.username ? `@${authorProfile.username}` : 'ProofMark Verified Creator',
      legal_name: authorProfile?.legal_name || '',
      default_persona: authorProfile?.default_persona || 'creator',
      is_owner: isOwner,
      is_premium_unlocked: isPremiumUnlocked
    },
    authorProfile: authorProfile ? {
      id: authorProfile.id,
      username: authorProfile.username,
      avatar_url: authorProfile.avatar_url,
      legal_name: authorProfile.legal_name,
      default_persona: authorProfile.default_persona,
      is_founder: authorProfile.is_founder,
    } : null,
    bundle: bundleData as ProcessBundleData | null
  };
});

// ─────────────────────────────────────────────────────────
// OGP Engine (Dynamic SEO for X / Discord)
// ─────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await fetchCertificateData(resolvedParams.id);

  if (!data || !data.cert) {
    return {
      title: '証明書が見つかりません | ProofMark',
      description: '指定された暗号証明書は存在しないか、アクセスできません。',
    };
  }

  const { cert } = data;

  if (cert.moderation_status === 'suspended') {
    return {
      title: '証明書は凍結されています | ProofMark',
      description: 'この証明書の公開は一時的または恒久的に停止されています。',
      robots: { index: false, follow: false },
    };
  }

  const ogTitle = cert.title;
  const creatorName = cert.creator_display_name;
  const description = `${creatorName} の作品。このデジタルアセットの存在と制作日時は ProofMark によって暗号学的に証明されています。`;
  
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://proofmark.jp';
  const verifyUrl = `${baseUrl}/cert/${cert.id}`;
  
  const canShowImage = cert.proof_mode === 'shareable' && cert.visibility === 'public' && !cert.is_asset_purged;
  const ogImageUrl = canShowImage && cert.thumbnail_data_url ? cert.thumbnail_data_url : `${baseUrl}/og-default-sealed.png`;

  return {
    title: `証明書: ${ogTitle} | ProofMark`,
    description,
    openGraph: {
      title: `ProofMark 証明書: ${ogTitle}`,
      description,
      url: verifyUrl,
      siteName: 'ProofMark',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Cryptographic Proof for ${ogTitle}`,
        },
      ],
      locale: 'ja_JP',
      type: 'website',
    },
    twitter: {
      card: canShowImage ? 'summary_large_image' : 'summary',
      title: `ProofMark 証明書: ${ogTitle}`,
      description,
      images: [ogImageUrl],
    },
  };
}

// ─────────────────────────────────────────────────────────
// The Server Component (Chassis)
// ─────────────────────────────────────────────────────────
export default async function CertificatePage({ params }: Props) {
  const resolvedParams = await params;
  const initialData = await fetchCertificateData(resolvedParams.id);

  if (!initialData) {
    notFound();
  }

  return (
    <CertificateClient 
      initialData={initialData} 
      certId={resolvedParams.id} 
    />
  );
}