import { NextRequest, NextResponse } from 'next/server';
import { signChallenge } from '@/lib/server/crypto/pow-edge';

// 👑 追加: Next.js/Vercel CDNによるキャッシュを物理的に禁止する絶対命令
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const getCorsHeaders = () => {
  const isDev = process.env.NODE_ENV === 'development';
  return {
    'Access-Control-Allow-Origin': isDev ? '*' : 'https://forge.proofmark.jp',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

export async function OPTIONS() {
  // 👑 修正: プリフライトに明示的な 204 No Content を指定しブラウザ挙動を安定化
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    const userAgent = req.headers.get('user-agent') || '';
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(userAgent);
    
    const diffMobile = parseInt(process.env.POW_DIFF_MOBILE || '3', 10);
    const diffPC = parseInt(process.env.POW_DIFF_PC || '4', 10);
    const difficulty = isMobile ? diffMobile : diffPC;
    
    const salt = crypto.randomUUID();
    const timestamp = Date.now();
    
    const payload = `${timestamp}:${difficulty}:${salt}`;
    const signature = await signChallenge(payload);
    
    return NextResponse.json(
      { payload, signature },
      { headers: getCorsHeaders(), status: 200 }
    );
  } catch (error) {
    console.error('[POW_CHALLENGE_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: getCorsHeaders() });
  }
}