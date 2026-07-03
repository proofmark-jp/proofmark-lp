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

console.log("[INIT DIAGNOSTIC] Supabase URL:", supabaseUrl);
console.log("[INIT DIAGNOSTIC] Has Service Key?:", !!supabaseKey);

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

/**
 * Edge Runtime (Web Request API) \u7528\u306e\u5b89\u5168\u306aIP\u53d6\u5f97\u95a2\u6570\u3002
 *
 * \u512a\u5148\u5ea6:
 *   1. `x-real-ip`        \u2014 Vercel\u304c\u30a4\u30f3\u30b8\u30a7\u30af\u30c8\u3002\u30af\u30e9\u30a4\u30a2\u30f3\u30c8\u304b\u3089\u5076\u9020\u4e0d\u80fd\u3002
 *   2. `x-forwarded-for` \u306e\u672b\u5c3e\u5024 \u2014 \u5076\u9020\u30ea\u30b9\u30af\u306e\u3042\u308b\u5148\u982d\u5024\u3067\u306f\u306a\u304f\u3001\u4fe1\u983c\u6027\u306e\u9ad8\u3044\u672b\u5c3e\u5024\u3002
 *   3. `'127.0.0.1'` \u2014 \u6700\u7d42\u30d5\u30a9\u30fc\u30eb\u30d0\u30c3\u30af\u3002
 *
 * \u7d76\u5bfe\u306b `x-forwarded-for` \u306e\u5148\u982d ([0]) \u3092\u4f7f\u7528\u3057\u3066\u306f\u306a\u3089\u306a\u3044\u3002
 * \u30af\u30e9\u30a4\u30a2\u30f3\u30c8\u304c\u4efb\u610f\u306eIP\u3092\u5148\u982d\u306b\u633f\u5165\u3057\u3066\u30ec\u30fc\u30c8\u30ea\u30df\u30c3\u30c8\u3092\u9a30\u6f64\u3067\u304d\u308b\u3002
 */
export function getClientIpFromEdgeRequest(request: Request): string {
  // Priority 1: x-real-ip (Vercel\u304c\u4fdd\u8a3c\u3001\u5076\u9020\u4e0d\u80fd)
  const realIp = request.headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  // Priority 2: x-forwarded-for \u306e\u672b\u5c3e\u5024\uff08\u6700\u3082\u4fe1\u983c\u6027\u306e\u9ad8\u3044\u30d7\u30ed\u30ad\u30b7\u8ffd\u52a0\u5024\uff09
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const ips = fwd.split(',').map(s => s.trim()).filter(Boolean);
    if (ips.length > 0) return ips[ips.length - 1];
  }

  return '127.0.0.1';
}

export async function getAuthenticatedUserId(request: Request) {
  const authorization = request.headers.get('authorization');
  console.log("[AUTH DIAGNOSTIC] Auth Header Check:", authorization ? `EXISTS (Length: ${authorization.length})` : "NULL");

  if (!authorization?.startsWith('Bearer ')) {
    console.error("[AUTH DIAGNOSTIC] Invalid header format:", authorization);
    throw new Error('missing or invalid authorization header');
  }

  const token = authorization.slice('Bearer '.length);
  console.log("[AUTH DIAGNOSTIC] Extracted Token Prefix:", token.substring(0, 15) + "...");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !data?.user?.id) {
    console.error("[AUTH DIAGNOSTIC] Supabase Error Detail:", JSON.stringify(error, null, 2));
    throw new Error(error?.message || 'invalid token');
  }
  
  console.log("[AUTH DIAGNOSTIC] Auth Success! User ID:", data.user.id);
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
    mismatches: Array.from(new Set(mismatches)),
    chainDepth,
    headChainSha256,
    headStepId: head?.id || null,
    rootStepId: ordered[0]?.id || null,
    brokenAtStepId: mismatches[0] || null,
  };
}