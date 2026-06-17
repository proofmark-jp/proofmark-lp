/**
 * api/widget-html.ts — ADR-009 Phase 3: Twitter Player Meta Injector (Fixed & Optimized)
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

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (match) => {
    const escape: Record<string, string> = { 
        '&': '&amp;', 
        '<': '&lt;', 
        '>': '&gt;', 
        '"': '&quot;', 
        "'": '&#39;' 
    };
    return escape[match] || match;
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

  /* ── 1) 自身のホスト名から index.html をFetchする ── */
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

  /* ── 2) Supabase から証明書のタイトルのみ取得 ── */
  const supabase = getSupabase();
  let title = 'ProofMark';

  if (supabase) {
    const isUuid = UUID_REGEX.test(id);
    let query = supabase.from('certificates').select('title');
    
    if (isUuid) {
      query = query.or(`id.eq.${id},public_verify_token.eq.${id}`);
    } else {
      query = query.eq('public_verify_token', id);
    }

    const { data } = await query.limit(1).maybeSingle();

    if (data && data.title) {
      title = data.title;
    }
  }

  /* ── 3) OGP / Twitter Player メタタグ注入 ── */
  const v = typeof req.query.v === 'string' ? req.query.v.trim() : null;
  const cacheBuster = v ? `&v=${encodeURIComponent(v)}` : '';
  const widgetUrl = `https://proofmark.jp/embed/widget/${id}`;
  const vaultImageUrl = `https://www.proofmark.jp/api/og-vault?id=${id}${cacheBuster}`;
  const escapedTitle = escapeHtml(title);

  const metaTags = `
    <meta name="twitter:card" content="player">
    <meta name="twitter:player" content="${widgetUrl}">
    <meta name="twitter:player:width" content="420">
    <meta name="twitter:player:height" content="180">
    <meta name="twitter:image" content="${vaultImageUrl}">
    <meta property="og:title" content="ProofMark: ${escapedTitle}">
    <meta property="og:image" content="${vaultImageUrl}">`;

  // 既存の OGP および Twitter メタタグの衝突を防ぐため削除
  const cleanHtml = html
    .replace(/<meta[^>]*property=["']og:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta[^>]*name=["']twitter:[^"']*["'][^>]*>/gi, '');

  // </head> の直前に新しいメタタグを挿入
  const injectedHtml = cleanHtml.replace(/<\/head>/i, `${metaTags}</head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(injectedHtml);
}