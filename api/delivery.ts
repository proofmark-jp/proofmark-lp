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
import { pipeline } from 'stream/promises';

export const config = { maxDuration: 15 };

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 🚨 The Apex Fix: 1. OPTIONSリクエスト(Preflight)の高速許可
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  const targetUrl = rawUrl as string;
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

    // 🚨 1.5. SSRF完全封じ込め: Storageパスの厳格抽出
    const pathMatch = parsedTarget.pathname.match(/^\/storage\/v1\/object\/(public|authenticated)\/(.+)$/);
    if (!pathMatch) {
      return res.status(403).send('Invalid Storage Execution Path');
    }
    const bucketAndPath = pathMatch[2];
    const fetchUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${bucketAndPath}`;
    
    const upstreamRes = await fetch(fetchUrl, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send('Asset not found');
    }

    // 🚨 The Apex Fix: 2. 外部ウィジェットからの画像参照(CORS)を許可
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 無害化ヘッダー強制付与（Sandboxed Delivery）
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox;");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    // 🚨 3. OOM防御 & メモリリーク防止: 絶対安全なPipeline
    if (upstreamRes.body) {
      try {
        await pipeline(Readable.fromWeb(upstreamRes.body as any), res);
      } catch (streamErr) {
        console.error('[Stream Disconnected or Error]', streamErr);
      }
    } else {
      res.status(204).end();
    }

  } catch (err) {
    console.error('[Sandboxed Delivery] Error:', err);
    return res.status(500).send('Internal Server Error');
  }
}