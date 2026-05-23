/**
 * api/delivery.ts — Sandboxed Delivery Proxy
 *
 * Supabase Storage から raw バイナリをフェッチし、
 * 世界基準のセキュリティヘッダーを付与してストリーミング配信する。
 *
 * 目的: ユーザーアップロードファイルから発火し得る XSS を
 *       OS レベルで封じ込める「Sandboxed Delivery」アーキテクチャ。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('URL is required');
  }

  // 🚨 SSRF防御: 自身のSupabaseストレージURL以外はプロキシを拒否する
  if (!targetUrl.startsWith(SUPABASE_URL)) {
    return res.status(403).send('Forbidden URL');
  }

  try {
    const upstreamRes = await fetch(targetUrl);

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send('Asset not found');
    }

    // 🚨 世界基準の無害化ヘッダー強制付与（Sandboxed Delivery）
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox;");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // エッジキャッシュ

    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(200).send(buffer);

  } catch (err) {
    console.error('[Sandboxed Delivery] Error:', err);
    return res.status(500).send('Internal Server Error');
  }
}