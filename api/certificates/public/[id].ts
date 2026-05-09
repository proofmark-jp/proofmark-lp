import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, verifyEvidenceChain } from '../../_shared.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Node.js (VercelRequest) と Web標準(Request) の両方に対応できる堅牢なパラメータ取得
  let id = req.query?.id as string | undefined;
  if (!id && req.url) {
    try {
      const url = new URL(req.url, 'http://localhost');
      id = url.searchParams.get('id') || undefined;
      if (!id) {
        // [id].ts routing fallback
        const pathParts = url.pathname.split('/').filter(Boolean);
        id = pathParts[pathParts.length - 1];
      }
    } catch (e) {
      // ignore parsing error
    }
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
    if (!certificate) return res.status(404).json({ error: 'Not found' });

    let bundle = null;
    if (certificate.process_bundle_id) {
      const bundleResponse = await supabaseAdmin
        .from('process_bundles')
        .select('id, title, description, created_at, evidence_mode, chain_depth, chain_head_sha256, steps:process_bundle_steps(id, step_index, step_type, title, description, preview_url, sha256, original_filename, mime_type, file_size, prev_step_id, prev_chain_sha256, chain_sha256, issued_at)')
        .eq('id', certificate.process_bundle_id)
        .eq('status', 'issued')
        .eq('is_public', true)
        .maybeSingle();

      const bData = bundleResponse.data;
      if (bData) {
        // 実行時ガード: 必須フィールドの欠落を検出
        if (!bData.id) throw new Error('Invalid DB state: bundle ID missing');

        const chainSummary = await verifyEvidenceChain({
          id: bData.id,
          chain_head_sha256: bData.chain_head_sha256,
          chain_depth: bData.chain_depth,
          steps: (bData.steps || []).map((step) => ({
            id: step.id,
            bundleId: bData.id,
            stepIndex: step.step_index,
            stepType: step.step_type,
            title: step.title,
            description: step.description,
            sha256: step.sha256,
            originalFilename: step.original_filename,
            mimeType: step.mime_type,
            fileSize: step.file_size,
            prevStepId: step.prev_step_id,
            prevChainSha256: step.prev_chain_sha256,
            chain_sha256: step.chain_sha256,
          })),
        });

        bundle = {
          ...bData,
          chain_summary: chainSummary,
        };
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=86400');
    return res.status(200).json({
      certificate,
      bundle,
    });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
