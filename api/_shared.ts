import { createClient } from '@supabase/supabase-js';

// 💡 Vite用変数（VITE_〜）へのフォールバックを組み込み、Vercelの読み込み漏れを防ぐ
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("🚨 致命的エラー: SUPABASE_URL (または VITE_SUPABASE_URL) が見つかりません。");
}
if (!supabaseKey) {
  console.error("🚨 致命的エラー: SUPABASE_SERVICE_ROLE_KEY が見つかりません。");
}

export const supabaseAdmin = createClient(
  supabaseUrl!,
  supabaseKey!,
  { auth: { persistSession: false } },
);

// 👇 ここから下は元々あった必須関数群です
export function json(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function getOrigin(request: Request) {
  return process.env.APP_URL || new URL(request.url).origin;
}

export async function getAuthenticatedUserId(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('missing or invalid authorization header');
  }

  const token = authorization.slice('Bearer '.length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !data?.user?.id) {
    throw new Error(error?.message || 'invalid token');
  }
  
  return data.user.id;
}

type EvidenceStepInput = {
  bundleId: string;
  stepIndex: number;
  stepType: string;
  title: string;
  description?: string | null;
  sha256: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  prevStepId?: string | null;
  prevChainSha256?: string | null;
};

type EvidenceStepStored = EvidenceStepInput & {
  id: string;
  chain_sha256?: string | null;
};

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(sortKeysDeep(value));
}

export async function sha256Hex(input: string | ArrayBuffer) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function buildEvidencePayload(input: EvidenceStepInput) {
  return {
    version: 'proofmark.chain.v1',
    bundle_id: input.bundleId,
    step_index: input.stepIndex,
    step_type: input.stepType,
    title: input.title,
    description: input.description || '',
    asset_sha256: input.sha256,
    asset: {
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      file_size: input.fileSize,
    },
    prev_step_id: input.prevStepId || null,
    prev_chain_sha256: input.prevChainSha256 || null,
  } as const;
}

export async function buildEvidenceStep(input: EvidenceStepInput) {
  const payload = buildEvidencePayload(input);
  const chainSha256 = await sha256Hex(stableStringify(payload));
  return {
    payload,
    chainSha256,
  };
}

export async function verifyEvidenceChain(bundle: {
  id: string;
  steps: EvidenceStepStored[];
  chain_head_sha256?: string | null;
  chain_depth?: number | null;
}) {
  const ordered = [...bundle.steps].sort((a, b) => a.stepIndex - b.stepIndex);
  const mismatches: string[] = [];
  let prevStepId: string | null = null;
  let prevChainSha256: string | null = null;

  for (const step of ordered) {
    const { chainSha256 } = await buildEvidenceStep({
      bundleId: bundle.id,
      stepIndex: step.stepIndex,
      stepType: step.stepType,
      title: step.title,
      description: step.description || '',
      sha256: step.sha256,
      originalFilename: step.originalFilename,
      mimeType: step.mimeType,
      fileSize: step.fileSize,
      prevStepId,
      prevChainSha256,
    });

    if ((step.prevStepId || null) !== prevStepId) {
      mismatches.push(step.id);
    }

    if ((step.prevChainSha256 || null) !== prevChainSha256) {
      mismatches.push(step.id);
    }

    if ((step.chain_sha256 || null) !== chainSha256) {
      mismatches.push(step.id);
    }

    prevStepId = step.id;
    prevChainSha256 = chainSha256;
  }

  const head = ordered.at(-1) || null;
  const headChainSha256 = head?.chain_sha256 || prevChainSha256 || null;
  const chainDepth = ordered.length;
  const depthMatches = !bundle.chain_depth || bundle.chain_depth === chainDepth;
  const headMatches = !bundle.chain_head_sha256 || bundle.chain_head_sha256 === headChainSha256;
  const valid = mismatches.length === 0 && depthMatches && headMatches;

  return {
    valid,
    mismatches: [...new Set(mismatches)],
    chainDepth,
    headChainSha256,
    headStepId: head?.id || null,
    rootStepId: ordered[0]?.id || null,
    brokenAtStepId: mismatches[0] || null,
  };
}