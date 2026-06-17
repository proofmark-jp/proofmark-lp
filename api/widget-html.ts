/**
 * api/widget-html.ts — ADR-009 Phase 3: Twitter Player Meta Injector
 * ─────────────────────────────────────────────────────────────────────
 * /embed/widget/:id にアクセスされた際に、Vite の dist/index.html に
 * Twitter Player Card / OGP メタタグを注入して返す Node.js Serverless Function。
 * XやNotionにURLをペーストした瞬間、iframeウィジェットが自動展開される。
 *
 * Cache-Control: s-maxage=3600 → Vercel Edgeで1時間キャッシュ
 *                stale-while-revalidate=86400 → 24時間はstaleでも即返す
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/* ── Supabase client (Service Role) ── */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  /* GET のみ許可 */
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }

  const id = typeof req.query.id === 'string' ? req.query.id.trim() : null;
  if (!id) {
    return res.status(400).end('Missing required query param: id');
  }

  /* ── dist/index.html 読み込み ── */
  let html: string;
  try {
    const htmlPath = path.join(process.cwd(), 'dist', 'index.html');
    html = fs.readFileSync(htmlPath, 'utf-8');
  } catch {
    return res.status(500).end('Failed to read index.html');
  }

  /* ── Supabase から証明書データ取得 ── */
  const supabase = getSupabase();
  let title = 'ProofMark';
  let image = 'https://www.proofmark.jp/og-image.png';

  if (supabase) {
    const { data } = await supabase
      .from('certificates')
      .select('title, public_image_url')
      .or(`id.eq.${id},public_verify_token.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (data) {
      if (data.title) title = data.title;
      if (data.public_image_url) image = data.public_image_url;
    }
  }

  /* ── OGP / Twitter Player メタタグ注入 ── */
  const widgetUrl = `https://www.proofmark.jp/embed/widget/${id}`;
  const metaTags = `
    <meta name="twitter:card" content="player">
    <meta name="twitter:player" content="${widgetUrl}">
    <meta name="twitter:player:width" content="420">
    <meta name="twitter:player:height" content="180">
    <meta property="og:title" content="ProofMark: ${title}">
    <meta property="og:image" content="${image}">`;

  const injectedHtml = html.replace('<head>', `<head>${metaTags}`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(injectedHtml);
}
