import { NextRequest, NextResponse } from 'next/server';
import { signChallenge, timingSafeEqual, verifyPow, mintPayloadBoundJwt } from '@/lib/server/crypto/pow-edge';

export const runtime = 'edge';

const getCorsHeaders = () => {
  const isDev = process.env.NODE_ENV === 'development';
  return {
    'Access-Control-Allow-Origin': isDev ? '*' : 'https://forge.proofmark.jp',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: getCorsHeaders() });
}

export async function POST(req: NextRequest) {
  const headers = getCorsHeaders();
  let body;

  // 👑 修正済: JSONパースエラーを 400 Bad Request として処理（アラート疲労の防止）
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400, headers });
  }

  try {
    const { payload, signature, nonce, tgt_hash, device_pub } = body;

    if (!payload || !signature || !nonce || !tgt_hash || !device_pub) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400, headers });
    }

    const [tsStr, diffStr, salt] = payload.split(':');
    const ts = parseInt(tsStr, 10);
    const diff = parseInt(diffStr, 10);

    // 👑 修正済: NaNによる時間超越・難易度改ざんバグの物理的封鎖
    if (Number.isNaN(ts) || Number.isNaN(diff) || !salt) {
      return NextResponse.json({ error: 'Malformed challenge payload' }, { status: 400, headers });
    }

    const ageMs = Date.now() - ts;
    if (ageMs > 5 * 60 * 1000 || ageMs < 0) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 401, headers });
    }

    const expectedSignature = await signChallenge(payload);
    if (!timingSafeEqual(signature, expectedSignature)) {
      return NextResponse.json({ error: 'Invalid challenge signature' }, { status: 401, headers });
    }

    const isPowValid = await verifyPow(signature, tgt_hash, device_pub, nonce, diff);
    if (!isPowValid) {
      return NextResponse.json({ error: 'Invalid Proof of Work' }, { status: 401, headers });
    }

    const jwt = await mintPayloadBoundJwt(tgt_hash, device_pub);

    return NextResponse.json({ success: true, token: jwt }, { headers, status: 200 });
    
  } catch (error) {
    console.error('[POW_EXCHANGE_ERROR]', error);
    return NextResponse.json({ error: 'Verification Failed' }, { status: 500, headers });
  }
}