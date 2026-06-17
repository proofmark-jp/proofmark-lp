/**
 * api/widget-html.ts — ADR-009 Phase 3: Twitter Player Meta Injector (Fixed)
 * ─────────────────────────────────────────────────────────────────────
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/* ── UUIDバリデーション用の正規表現 ── */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }

  const id = typeof req.query.id === 'string' ? req.query.id.trim() : null;
  if (!id) {
    return res.status(400).end('Missing required query param: id');
  }

  /* ── 1) 物理ファイルパスへの依存を捨て、自ホストから直接Fetchする ── */
  let html: string;
  try {
    const baseUrl = 'https://www.proofmark.jp';
    
    // Vercelのエッジからキャッシュ済みの index.html を取得
    const htmlRes = await fetch(`${baseUrl}/index.html`);
    if (!htmlRes.ok) throw new Error('Failed to fetch index.html from edge');
    
    html = await htmlRes.text();
  } catch (error) {
    return res.status(500).end('Failed to retrieve index.html via HTTP fetch.');
  }

  /* ── 2) Supabase からデータ取得（型キャストエラー防衛） ── */
  const supabase = getSupabase();
  let title = 'ProofMark';
  let image = 'https://www.proofmark.jp/og-image.png';

  if (supabase) {
    const isUuid = UUID_REGEX.test(id);
    let query = supabase.from('certificates').select('title, public_image_url');
    
    if (isUuid) {
      query = query.or(`id.eq.${id},public_verify_token.eq.${id}`);
    } else {
      query = query.eq('public_verify_token', id);
    }

    const { data } = await query.limit(1).maybeSingle();

    if (data) {
      if (data.title) title = data.title;
      if (data.public_image_url) image = data.public_image_url;
    }
  }

  /* ── 3) OGP / Twitter Player メタタグ注入 ── */
  const widgetUrl = `https://proofmark.jp/embed/widget/${id}`;
  const metaTags = `
    <meta name="twitter:card" content="player">
    <meta name="twitter:player" content="${widgetUrl}">
    <meta name="twitter:player:width" content="420">
    <meta name="twitter:player:height" content="180">
    <meta property="og:title" content="ProofMark: ${title}">
    <meta property="og:image" content="${image}">`;

  // 堅牢な正規表現置換（大文字小文字や属性付きのheadタグに対応）
  const injectedHtml = html.replace(/<head\b[^>]*>/i, (match) => `${match}${metaTags}`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(injectedHtml);
}