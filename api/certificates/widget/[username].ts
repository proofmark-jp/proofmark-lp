export const config = { runtime: 'edge' };

import { json, supabaseAdmin, verifyEvidenceChain } from '../../_shared';

const clamp = (value: number, min: number, max: number) => {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.min(Math.max(safeValue, min), max);
};
const parseBoolean = (value: string | null, fallback: boolean) => (value == null ? fallback : value !== 'false' && value !== '0');

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const url = new URL(request.url);
  // 👑 Vercel Edge API（非Next.js）における動的パラメータの確実な取得
  const username = url.searchParams.get('username') || url.pathname.split('/').pop();

  if (!username) {
    return json(400, { error: 'Username is required' });
  }
  const maxItems = clamp(Number(url.searchParams.get('maxItems') || '8'), 1, 12);
  const showBundles = parseBoolean(url.searchParams.get('bundles'), true);
  const bundleLimit = clamp(Number(url.searchParams.get('bundleLimit') || '3'), 0, 6);

  const profileResponse = await supabaseAdmin
    .from('profiles')
    .select('*')
    .ilike('username', username)
    .maybeSingle();

  if (!profileResponse.data) {
    return json(404, { error: 'Profile not found' });
  }

  const profile = profileResponse.data as Record<string, any>;
  const certificateResponse = await supabaseAdmin
    .from('certificates')
    .select('*')
    .eq('user_id', profile.id)
    .in('visibility', ['public', 'unlisted'])
    .order('proven_at', { ascending: false })
    .limit(maxItems);

  const rawCertificates = (certificateResponse.data || []) as Array<Record<string, any>>;
  const certificates = rawCertificates.map((item) => {
    const metadata =
      item.metadata_json && typeof item.metadata_json === 'object'
        ? item.metadata_json
        : item.metadata && typeof item.metadata === 'object'
        ? item.metadata
        : {};

    const title =
      item.title ||
      (typeof metadata.title === 'string' ? metadata.title : null) ||
      item.original_filename ||
      item.file_name ||
      'Untitled proof';

    return {
      id: item.id,
      title,
      imageUrl: item.public_image_url || null,
      verifyPath: `/cert/${item.id}`,
      proofMode: item.proof_mode || 'private',
      visibility: item.visibility || 'private',
      issuedAt: item.proven_at || item.created_at || null,
      hash: item.sha256 || item.file_hash || '',
      hasBundle: Boolean(item.process_bundle_id),
      stepType: typeof metadata.step_type === 'string' ? metadata.step_type : null,
      tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag: unknown) => typeof tag === 'string') : [],
    };
  });

  let bundles: Array<Record<string, any>> = [];

  if (showBundles && bundleLimit > 0) {
    const bundlesResponse = await supabaseAdmin
      .from('process_bundles')
      .select('id, title, description, created_at, evidence_mode, chain_depth, chain_head_sha256, steps:process_bundle_steps(id, step_index, step_type, title, description, preview_url, sha256, original_filename, mime_type, file_size, prev_step_id, prev_chain_sha256, chain_sha256, issued_at)')
      .eq('user_id', profile.id)
      .eq('status', 'issued')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(bundleLimit);

    const rawBundles = (bundlesResponse.data || []) as Array<Record<string, any>>;
    bundles = await Promise.all(
      rawBundles.map(async (bundle) => {
        const chainSummary = await verifyEvidenceChain({
          id: bundle.id,
          chain_head_sha256: bundle.chain_head_sha256,
          chain_depth: bundle.chain_depth,
          steps: (bundle.steps || []).map((step: any) => ({
            id: step.id,
            bundleId: bundle.id,
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

        return {
          id: bundle.id,
          title: bundle.title,
          description: bundle.description || null,
          createdAt: bundle.created_at || null,
          evidenceMode: bundle.evidence_mode || 'hash_chain_v1',
          chainDepth: bundle.chain_depth || (bundle.steps || []).length,
          headHash: bundle.chain_head_sha256 || null,
          chainSummary,
          steps: (bundle.steps || []).map((step: any) => ({
            id: step.id,
            stepIndex: step.step_index,
            stepType: step.step_type,
            title: step.title,
            previewUrl: step.preview_url || null,
          })),
        };
      })
    );
  }

  const latestIssuedAt = certificates[0]?.issuedAt || null;
  const verifiedChainCount = bundles.filter((bundle) => bundle.chainSummary?.valid !== false).length;
  const bio = typeof profile.bio === 'string' && profile.bio.trim() ? profile.bio.trim() : null;

  return json(
    200,
    {
      profile: {
        username: profile.username,
        avatarUrl: profile.avatar_url || null,
        bio,
        isFounder: Boolean(profile.is_founder),
      },
      headline: bio || 'ProofMarkで公開されている検証済みポートフォリオです。',
      stats: {
        certificateCount: certificates.length,
        bundleCount: bundles.length,
        verifiedChainCount,
        latestIssuedAt,
      },
      certificates,
      bundles,
    },
    {
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    }
  );
}
