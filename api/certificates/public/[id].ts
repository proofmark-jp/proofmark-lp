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
      // フロントエンドのUIが期待する step の形式にマッピングする
      const mappedSteps = meta.chain_history.map((step: any, idx: number) => ({
        id: `virtual-step-${idx}`,
        step_index: step.stepIndex ?? idx,
        step_type: step.isHead ? 'final' : (step.stepType || 'other'),
        title: step.title || `Step ${idx + 1}`,
        description: '',
        preview_url: null, // Zero-copyのためURLは返さず、UI側でハッシュ表示へのフォールバックを促す
        sha256: step.sha256,
        is_head: step.isHead
      }));

      bundle = {
        id: meta.bundle_id || certificate.process_bundle_id || certificate.id,
        title: meta.bundle_description || certificate.title || 'Chain of Evidence',
        description: meta.bundle_description || '',
        created_at: certificate.created_at,
        evidence_mode: 'shareable',
        chain_depth: meta.chain_depth || meta.chain_history.length,
        chain_head_sha256: certificate.sha256,
        status: 'issued',
        steps: mappedSteps, // 🚨 UIクラッシュを防ぐための配列
        chain_summary: {
          isValid: true,
          steps: mappedSteps.map((s: any) => ({
            stepIndex: s.step_index,
            title: s.title,
            sha256: s.sha256,
            isHead: s.is_head
          }))
        }
      };
    }

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=31536000');
    return res.status(200).json({
      certificate,
      bundle, // UI側はこの束ねられた情報を見てレンダリングする
    });

  } catch (err) {
    console.error('Public cert error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}