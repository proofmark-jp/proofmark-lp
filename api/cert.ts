import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../client/src/types/supabase';

const supabaseUrl = process.env.SUPABASE_URL || "https://layesvzeeaiqqbhwdlgb.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * XSS 防衛線の構築: 文字列をセキュアにエスケープ
 */
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
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  const url = new URL(req.url!, baseUrl);
  const id = req.query.id as string || url.searchParams.get('id');

  try {
    let cert = null;
    if (id && supabaseUrl && supabaseKey) {
      const { data } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', id)
        .single();
      cert = data;
    }

    // ベースとなる HTML を取得
    const response = await fetch(`${baseUrl}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch base HTML, status: ${response.status}`);
    }
    let html = await response.text();

    if (cert) {
      // NDA 情報漏洩のブロック (Zero-Trust Logic)
      const isPrivate = cert.visibility === 'private';
      const safeName = isPrivate 
        ? 'Confidential Asset (NDA)' 
        : (cert.original_filename || cert.file_name || 'Verified Artwork');
      
      const title = `ProofMark Certificate: ${safeName}`;
      const description = isPrivate
        ? 'This asset is protected under NDA and its details are hidden. Integrity is cryptographically verified.'
        : `This artwork has been verified on ProofMark. SHA-256: ${cert.sha256}`;
      
      // Private の場合はデフォルト画像へ差し替え、IDを隠蔽
      const ogImageUrl = isPrivate 
        ? `${baseUrl}/ogp-image.png` 
        : `${baseUrl}/api/og?id=${id}`;

      // 堅牢な OGP インジェクション (Regex による置換)
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
      html = html.replace(/<meta\s+property="og:title"\s+content="[^"]*"/i, `<meta property="og:title" content="${escapeHtml(title)}"`);
      html = html.replace(/<meta\s+property="og:description"\s+content="[^"]*"/i, `<meta property="og:description" content="${escapeHtml(description)}"`);
      html = html.replace(/<meta\s+name="description"\s+content="[^"]*"/i, `<meta name="description" content="${escapeHtml(description)}"`);
      html = html.replace(/<meta\s+property="og:image"\s+content="[^"]*"/i, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}"`);
      html = html.replace(/<meta\s+name="twitter:image"\s+content="[^"]*"/i, `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}"`);
      
      // 追加の OGP タグのクリーニング (重複防止)
      html = html.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"/i, `<meta name="twitter:title" content="${escapeHtml(title)}"`);
      html = html.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"/i, `<meta name="twitter:description" content="${escapeHtml(description)}"`);
    }

    // インフラ防衛: CDN キャッシュの最適化
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
    
  } catch (error: any) {
    console.error('BFF Error:', error.message || error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send('<html><body><h1>Internal Server Error</h1></body></html>');
  }
}