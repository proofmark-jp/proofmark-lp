import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../_shared.js'; // 🚨 重い verify RPC は不要になるため削る

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let id = req.query?.id as string | undefined;
  if (!id && req.url) {
    try {
      const url = new URL(req.url, 'http://localhost');
      id = url.searchParams.get('id') || undefined;
      if (!id) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        id = pathParts[pathParts.length - 1];
      }
    } catch (e) {}
  }

  if (!id) return res.status(400).json({ error: 'Missing or invalid id parameter' });

  try {
    const { data: certificate, error } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('public_verify_token', id)
      .in('visibility', ['public', 'unlisted'])
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!certificate) return res.status(404).json({ error: 'Certificate not found' });

    let bundle = null;
    const meta = certificate.metadata_json as any;

    // 🚨 The Merkle Rollup (JSONB) から直接バンドルオブジェクトをインメモリ構築 (DBアクセスゼロ)
    if (meta && meta.chain_history && Array.isArray(meta.chain_history)) {
      bundle = {
        id: meta.bundle_id || certificate.process_bundle_id || certificate.id,
        chain_head_sha256: certificate.sha256,
        chain_depth: meta.chain_depth || meta.chain_history.length,
        status: 'issued',
        chain_summary: {
          isValid: true,
          steps: meta.chain_history.map((step: any) => ({
            stepIndex: step.stepIndex,
            title: step.title,
            sha256: step.sha256,
            isHead: step.isHead
          }))
        }
      };
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({
      certificate,
      bundle, // UI側はこの束ねられた情報を見てレンダリングする
    });

  } catch (err) {
    console.error('Public cert error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}