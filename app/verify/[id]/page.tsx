import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
// 注意: 実際のインテグレーション時は、あなたが既に構築している `src/lib/supabase.ts` をバインドしてください。
// import { supabase } from '@/lib/supabase'; 

interface VerifyPageProps {
  params: Promise<{ id: string }>;
}

// 【最適化ハック: 限界費用ゼロのISR (Incremental Static Regeneration) 設定】
// キャッシュの有効期限を「86400秒（24時間）」に指定。
// 24時間の間に10万回のアクセスがあろうと、VercelのServerless Functionは「最初の1回」しか稼働しません。
// 残りの99,999回はエッジCDNから静的HTMLとして爆速で返却されるため、インフラ費用は完全に「ゼロ」です。
export const revalidate = 86400;

// データ取得とフォールバックの抽象化（手抜き排除のためモックデータと型を100%完全定義）
async function getCertificateData(id: string) {
  try {
    // 実際の実装コンテキスト（既存資産のSupabaseマイグレーションと完全結合）
    // const { data, error } = await supabase.from('certificates').select('*').eq('id', id).single();
    // if (error || !data) return null;
    // return data;

    // 監査用の完全再現モックデータ（Supabaseの `certificates` テーブルの構造に準拠）
    return {
      id: id,
      title: 'Office Warrior Akiko (Final Blast)',
      creator_name: 'Sinn',
      visibility: 'public', // public, private, wip
      description: '150の制作工程、ナノ秒単位のChrono-Anchor、およびMLXによる多重VLM監査を通過し、暗号学的に「100%人間による創作」であることが公証された証明書。',
      image_url: 'https://proofmark.jp/sample/office_warrior_akiko.jpg',
      created_at: '2026-06-30T11:29:52Z',
      nodes_count: 1420,
      intention_density: 99.8,
      ledger_hash: '996571fc6bc4495d901754f4dee663a35f4dee663a35f4dee663a35f4dee663a3',
      tsa_timestamp: '2026-06-30T02:29:52Z'
    };
  } catch (e) {
    return null; // 四の矢の防衛：DBエラー時は例外を投げずnullを返し、古い有効なキャッシュを守る
  }
}

// 🌐 1. Dynamic OGP Injector: SNSでの「マウント拡散」を最適化するメタデータ生成
export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const proof = await getCertificateData(resolvedParams.id);

  // 防衛線: レコードが存在しない、または `public` でない場合は noindex でGoogleボットをシャットアウト
  if (!proof || proof.visibility !== 'public') {
    return {
      title: 'Certificate Suspended | ProofMark',
      robots: { index: false, follow: false },
    };
  }

  // クリエイターがX（Twitter）やDiscordでドヤるための、暴力的なエビデンスを刻んだOGP
  return {
    title: `${proof.title} by ${proof.creator_name} | Human Verified - ProofMark`,
    description: proof.description,
    openGraph: {
      title: `${proof.title} | Verified by ProofMark`,
      description: `Human Intention Density: ${proof.intention_density}% / Cryptographic Nodes: ${proof.nodes_count}`,
      images: [
        {
          url: proof.image_url,
          width: 1200,
          height: 630,
          alt: `${proof.title} Verification Frame`,
        },
      ],
      type: 'article',
      url: `https://proofmark.jp/verify/${proof.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `🛡️ HUMAN WORK VERIFIED: ${proof.title}`,
      description: `AI生成の嫌疑を論破。意図的判断密度: ${proof.intention_density}%。公証ハッシュ: ${proof.ledger_hash.slice(0, 8)}...`,
      images: [proof.image_url],
    },
  };
}

// 🏛️ 2. Server-Side Rendering: 完全なHTMLを先行生成し、ボットに一瞬で食わせる
export default async function VerifyPage({ params }: VerifyPageProps) {
  const resolvedParams = await params;
  const proof = await getCertificateData(resolvedParams.id);

  if (!proof || proof.visibility !== 'public') {
    notFound(); // 404フォールバックを徹底し、クローラーの巡回バジェットを無駄遣いさせない
  }

  // 👑 Googleボットの脳に直接、一次情報の権威を刻み込む JSON-LD 構造化データ（Schema.orgの極限悪用）
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    'name': `ProofMark Cryptographic Attestation - ${proof.title}`,
    'url': `https://proofmark.jp/verify/${proof.id}`,
    'identifier': proof.ledger_hash,
    'dateCreated': proof.created_at,
    'description': proof.description,
    'creator': {
      '@type': 'Person',
      'name': proof.creator_name,
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'ProofMark Security',
      'url': 'https://proofmark.jp',
    },
    'mainEntityOfPage': {
      '@type': 'CreativeWork',
      'name': proof.title,
      'image': proof.image_url,
      'author': {
        '@type': 'Person',
        'name': proof.creator_name
      }
    }
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-start p-4 md:p-8 font-sans selection:bg-zinc-800">
      {/* Google SEO 汚染用・構造化データの無音注入 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="w-full max-w-4xl border border-zinc-800 bg-zinc-950/50 backdrop-blur-md rounded-xl p-6 md:p-8 shadow-2xl shadow-zinc-950/50">
        {/* サイバーパンク監査UI：ヘッダー */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-6 mb-6 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-950/30 text-emerald-400 border border-emerald-800/50 mb-3 animate-pulse">
              ● ATTESTATION SUCCESSFUL
            </div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white mb-2 font-mono">
              {proof.title}
            </h1>
            <p className="text-sm text-zinc-400">
              PROVED BY ARTIST:{' '}
              <span className="text-zinc-200 font-semibold underline decoration-zinc-700 underline-offset-4">
                {proof.creator_name}
              </span>
            </p>
          </div>
          
          <div className="text-left md:text-right font-mono">
            <span className="text-xs text-zinc-500 block uppercase tracking-wider">Verification Anchor</span>
            <span className="text-sm text-zinc-300 font-bold bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800 block mt-1 break-all">
              PM-{proof.id.toUpperCase()}
            </span>
          </div>
        </div>

        {/* メイン検証領域 (Kinetic Video Scrubber / The Proof Card Placeholder) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="aspect-video bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden relative flex items-center justify-center group shadow-inner">
              {/* 注意: ここに、あなたが以前 client/src/components/verify/ 配下に作っていた 
                  タイムラプス再生エンジン（Kinetic Scrub / Canvasレンダラー）を `use client` コンポーネントとしてマウントします。 */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 pointer-events-none" />
              <span className="text-zinc-500 font-mono text-xs z-10 select-none">
                [ Kinetic Video Scrubber Platform: Day 2 Unification Target ]
              </span>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Audit Log & Core Context
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                {proof.description}
              </p>
            </div>
          </div>

          {/* 右サイド：冷徹な監査メトリクス。クリエイターが「マウント」するためのエビデンスボード */}
          <div className="flex flex-col gap-4">
            <div className="border border-zinc-800 bg-zinc-900/30 rounded-lg p-4 font-mono">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Human Intention Density</div>
              <div className="text-3xl font-black text-emerald-400 tracking-tighter">
                {proof.intention_density}%
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${proof.intention_density}%` }}
                />
              </div>
            </div>

            <div className="border border-zinc-800 bg-zinc-900/30 rounded-lg p-4 font-mono text-xs flex flex-col gap-3">
              <div>
                <span className="text-zinc-500 block uppercase tracking-wider mb-0.5">Chrono-Anchor Nodes</span>
                <span className="text-zinc-200 text-sm font-bold">{proof.nodes_count.toLocaleString()} Saves Verified</span>
              </div>
              
              <div>
                <span className="text-zinc-500 block uppercase tracking-wider mb-0.5">Cryptographic Root</span>
                <span className="text-zinc-300 font-mono block bg-zinc-900 p-1.5 rounded border border-zinc-800/80 break-all text-[10px] leading-tight">
                  {proof.ledger_hash}
                </span>
              </div>

              <div className="border-t border-zinc-800/80 pt-2 mt-1">
                <span className="text-zinc-500 block uppercase tracking-wider mb-0.5">TSA Absolute Time</span>
                <span className="text-zinc-300 font-medium">
                  {new Date(proof.tsa_timestamp).toLocaleString('ja-JP')}
                </span>
              </div>
            </div>

            {/* PLG戦略の最前線（B2B法人へのインバウンド・リンク） */}
            <a 
              href="https://proofmark.jp/pricing?ref=verify_audit_card" 
              className="mt-2 block w-full text-center bg-zinc-100 hover:bg-white text-black font-mono text-xs font-bold py-3 px-4 rounded-lg transition-all border border-transparent hover:shadow-lg hover:shadow-zinc-100/10"
            >
              🎯 PROTECT YOUR ARTWORK NOW
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}