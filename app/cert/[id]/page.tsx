import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Phase 2で構築するクライアントコンポーネント（装甲）のインポート
import CertificateClient from './CertificateClient';

// ─────────────────────────────────────────────────────────
// Types (The Apex Server Types)
// Next.js 15 では params は Promise として扱われる
// ─────────────────────────────────────────────────────────
type Props = {
  params: Promise<{ id: string }>;
};

export type CertificateInitialData = {
  cert: any;
  authorProfile: any | null;
  bundle: any | null;
};

// ─────────────────────────────────────────────────────────
// Database Engine (Zero-Latency Direct Fetch)
// サーバー側でSupabaseを直接叩き、ローディング画面の発生を0秒に抑え込む
// ─────────────────────────────────────────────────────────
async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

async function fetchCertificateData(id: string): Promise<CertificateInitialData | null> {
  const supabase = await getSupabaseServer();

  // 1. 証明書コアデータの取得
  const { data: certData, error: certError } = await supabase
    .from('certificates')
    .select('*')
    .eq('id', id)
    .single();

  if (certError || !certData) {
    return null; // データが存在しない場合は404へ
  }

  // 2. 著作者プロフィールの取得
  let authorProfile = null;
  if (certData.user_id) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, legal_name, default_persona, is_founder')
      .eq('id', certData.user_id)
      .maybeSingle();
    authorProfile = profileData;
  }

  // 3. Process Bundle (工程チェーン) の取得
  // APIを経由せず、データベースから直接取得する（パフォーマンスの極大化）
  let bundleData = null;
  if (certData.process_bundle_id && certData.public_verify_token) {
    const { data: bundle } = await supabase
      .from('process_bundles')
      .select('*')
      .eq('public_verify_token', certData.public_verify_token)
      .maybeSingle();
    bundleData = bundle;
  }

  // 4. クライアントエンジンが要求する形式にデータを拡張結合して返却
  return {
    cert: {
      ...certData,
      certificate_id: certData.id,
      original_file_name: certData.original_filename || 'unknown_asset',
      original_file_size: certData.file_size || 0,
      sha256_hash: certData.sha256,
      timestamp_jst: new Date(certData.certified_at || certData.created_at).toLocaleString('ja-JP'),
      timestamp_iso: certData.certified_at || certData.created_at,
      proof_mode: certData.proof_mode || 'private',
      tsr_token_base64: certData.tsr_token_base64 || '',
      thumbnail_data_url: certData.public_image_url || undefined,
      creator_display_name: authorProfile?.username ? `@${authorProfile.username}` : 'ProofMark Verified Creator',
      legal_name: authorProfile?.legal_name || '',
      default_persona: authorProfile?.default_persona || 'creator'
    },
    authorProfile,
    bundle: bundleData
  };
}

// ─────────────────────────────────────────────────────────
// OGP Engine (Dynamic SEO for X / Discord)
// URLがシェアされた際、クローラーに対して瞬時にメタデータを生成する
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

  const { cert, authorProfile } = data;

  // 凍結された証明書のOGP制御
  if (cert.moderation_status === 'suspended') {
    return {
      title: '証明書は凍結されています | ProofMark',
      description: 'この証明書の公開は一時的または恒久的に停止されています。',
      robots: { index: false, follow: false },
    };
  }

  // タイトル解決ロジック
  const getDisplayTitle = () => {
    if (cert.title) return cert.title;
    if (cert.original_filename && cert.original_filename !== 'unknown_file') return cert.original_filename;
    if (cert.storage_path) {
      const parts = cert.storage_path.split('/');
      let rawName = parts[parts.length - 1] || 'Verified_Digital_Artwork';
      return rawName.replace(/^file_\d+_?/, '');
    }
    return 'Verified_Digital_Artwork';
  };

  const ogTitle = getDisplayTitle();
  const creatorName = authorProfile?.username ? `@${authorProfile.username}` : 'ProofMark Verified Creator';
  const description = `${creatorName} の作品。このデジタルアセットの存在と制作日時は ProofMark によって暗号学的に証明されています。`;
  
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://proofmark.jp';
  const verifyUrl = `${baseUrl}/cert/${cert.id}`;
  
  // 公開設定になっている場合のみOGP画像を表示（ゼロ知識証明のセキュア要件）
  const canShowImage = cert.proof_mode === 'shareable' && cert.visibility === 'public' && !cert.is_asset_purged;
  const ogImageUrl = canShowImage && cert.public_image_url ? cert.public_image_url : `${baseUrl}/og-default-sealed.png`;

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
// ここではUIを描画せず、取得したデータをClient Componentへ流し込む
// ─────────────────────────────────────────────────────────
export default async function CertificatePage({ params }: Props) {
  const resolvedParams = await params;
  
  // サーバーサイドでの完全なデータ事前取得
  const initialData = await fetchCertificateData(resolvedParams.id);

  if (!initialData) {
    // データがなければNext.jsネイティブの404画面へルーティング
    notFound();
  }

  // 取得したデータをPropsとしてクライアントの装甲（CertificateClient）へ渡す
  return (
    <CertificateClient 
      initialData={initialData} 
      certId={resolvedParams.id} 
    />
  );
}