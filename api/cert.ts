import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || "https://layesvzeeaiqqbhwdlgb.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // VercelのNode環境で安全にパラメータを取得する強靭なロジック
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

    const response = await fetch(`${baseUrl}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch base HTML, status: ${response.status}`);
    }
    let html = await response.text();

    if (cert) {
      const originalName = cert.original_filename || cert.file_name || 'Verified Artwork';
      const title = `ProofMark Certificate: ${originalName}`;
      const description = `This artwork has been verified on ProofMark. SHA-256: ${cert.sha256 || cert.file_hash}`;
      const ogImageUrl = `${baseUrl}/api/og?id=${id}`;

      html = html.replaceAll('ProofMark | AI作品のデジタル存在証明・無断転載防止サービス', title);
      html = html.replaceAll('ProofMark | AI作品のデジタル存在証明', title);
      html = html.replaceAll('ブラウザ内で安全にSHA-256ハッシュを計算し、あなたのAI生成作品の制作日時とオリジナルデータを改ざん不能な状態で証明。無断転載や自作発言からクリエイターを守ります。', description);
      html = html.replaceAll('ブラウザ内で安全にSHA-256ハッシュを計算。あなたのAI作品を無断転載や自作発言から守る、クリエイターのためのデジタル存在証明サービス。', description);
      html = html.replaceAll('https://proofmark.jp/ogp-image.png', ogImageUrl);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error: any) {
    console.error('BFF Error:', error.message || error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send('<html><body><h1>Internal Server Error</h1></body></html>');
  }
}