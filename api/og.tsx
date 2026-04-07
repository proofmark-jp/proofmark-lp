import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export default async function handler(request: Request) {
  try {
    const requestUrl = request.url || '';
    const { searchParams } = new URL(requestUrl, requestUrl.startsWith('http') ? undefined : 'https://proofmark.jp');
    const id = searchParams.get('id');

    // IDがない、または不明な場合のデフォルト画像
    const renderDefault = () => new ImageResponse(
      (
        <div tw="flex flex-col items-center justify-center w-full h-full bg-[#07061A] text-white p-12 border-4 border-[#6C3EF4]/30">
          <div tw="flex flex-col items-center">
             <div tw="text-7xl font-bold text-[#F0EFF8] mb-4">ProofMark</div>
             <div tw="text-3xl text-[#00D4AA] tracking-[10px] uppercase font-bold">Digital Existence Proven</div>
             <div tw="mt-12 flex items-center px-6 py-3 rounded-full bg-[#6C3EF4]/20 border border-[#6C3EF4]/40 text-[#6C3EF4] text-xl font-bold">
               VERIFY ORIGINALITY
             </div>
          </div>
          <div tw="absolute bottom-12 flex text-[#A8A0D8] text-xl">
             proofmark.com
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );

    if (!id) return renderDefault();

    if (!supabaseUrl || !supabaseKey) {
      return renderDefault();
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/certificates?id=eq.${id}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!res.ok) {
      return renderDefault();
    }

    const data = await res.json();
    const cert = data[0];

    if (!cert) {
      return renderDefault();
    }

    // Satoriクラッシュ防止：完全なASCIIフォーマットで日本時間を生成
    const date = new Date(cert.created_at);
    const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getUTCDate()).padStart(2, '0');
    const hours = String(jstDate.getUTCHours()).padStart(2, '0');
    const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(jstDate.getUTCSeconds()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} JST`;

    return new ImageResponse(
      (
        <div tw="flex flex-row w-full h-full bg-[#07061A] text-white p-10 border-4 border-[#6C3EF4]/30">
          {/* 左カラム：作品プレビュー */}
          <div tw="flex w-1/2 h-full pr-5">
            <div tw="flex flex-col w-full h-full rounded-2xl border border-[#1C1A38] bg-[#0D0B24] overflow-hidden items-center justify-center relative">
              {cert.public_image_url ? (
                <img 
                  src={cert.public_image_url} 
                  tw="w-full h-full"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div tw="flex flex-col items-center justify-center text-center p-8">
                  <div tw="flex items-center px-4 py-2 bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-xs font-bold tracking-widest uppercase rounded-full mb-6">
                    CLIENT-SIDE HASHING
                  </div>
                  <div tw="text-4xl font-bold text-white mb-2">Image Data Hidden</div>
                  <div tw="text-[#A8A0D8] text-lg max-w-[300px]">
                    Verified in a complete zero-knowledge state.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右カラム：証明データ */}
          <div tw="flex flex-col w-1/2 h-full pl-5 justify-between">
            <div tw="flex flex-col">
              <div tw="flex items-center self-start px-4 py-1.5 bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] text-sm font-black tracking-widest uppercase rounded-full mb-6">
                VERIFIED DIGITAL ASSET
              </div>
              
              <div tw="text-5xl font-black text-white leading-tight mb-8">
                CERTIFICATE OF<br />AUTHENTICITY
              </div>

              <div tw="flex flex-col mb-6">
                <div tw="text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1">Certificate ID</div>
                <div tw="text-lg font-mono text-white/80">{cert.id}</div>
              </div>

              <div tw="flex flex-col mb-6">
                <div tw="text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1">SHA-256 Hash Signature</div>
                <div tw="text-sm font-mono text-white/90 break-all leading-tight">{cert.sha256}</div>
              </div>

              <div tw="flex flex-col">
                <div tw="text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1">Timestamp (JST)</div>
                <div tw="text-2xl font-bold text-white tracking-tight">{formattedDate}</div>
              </div>
            </div>

            <div tw="flex flex-row items-center justify-between border-t border-[#1C1A38] pt-6 opacity-60">
              <div tw="text-[#A8A0D8] text-lg font-bold uppercase tracking-widest">ProofMark</div>
              <div tw="text-[#A8A0D8] text-sm">Digital Existence Proven</div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response('Failed to generate image', { status: 500 });
  }
}
