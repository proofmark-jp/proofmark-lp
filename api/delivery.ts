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
import { Readable } from 'stream';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send('URL is required');
  }

  try {
    // 🚨 1. SSRF防御: 厳格なホストネーム一致による検問
    const parsedTarget = new URL(targetUrl);
    const parsedSupabase = new URL(SUPABASE_URL);
    if (parsedTarget.hostname !== parsedSupabase.hostname) {
      return res.status(403).send('Forbidden Host');
    }

    // 🚨 2. Privateバケット突破: 神の鍵（Service Role Key）を付与してFetch
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send('Asset not found');
    }

    // 🚨 無害化ヘッダー強制付与（Sandboxed Delivery）
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox;");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    // 🚨 3. OOM防御: メモリに溜め込まず、直接ストリーミング（Pipe）する
    if (upstreamRes.body) {
      // Web StreamをNode.jsのReadable Streamに変換してレスポンスに繋ぐ
      const readable = Readable.fromWeb(upstreamRes.body as any);
      readable.pipe(res);
      
      // ストリームの完了またはエラーを監視
      readable.on('error', (err) => {
        console.error('[Stream Error]', err);
        if (!res.headersSent) res.status(500).end();
      });
    } else {
      res.status(204).end(); // bodyがない場合
    }

  } catch (err) {
    console.error('[Sandboxed Delivery] Error:', err);
    return res.status(500).send('Internal Server Error');
  }
}