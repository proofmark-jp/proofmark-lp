import DOMPurify from 'dompurify';
import type { CertificateRecord, PortfolioEmbedSettings, ProcessBundleDraftStep } from './proofmark-types';
import { supabase } from './supabase';

/* ── 認証ヘッダーの自動注入ヘルパー ── */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function checkDuplicateCertificate(sha256: string) {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/certificates/check', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sha256 }),
  });

  if (!response.ok) throw new Error('duplicate check failed');
  return (await response.json()) as { exists: boolean; certificate?: Pick<CertificateRecord, 'id' | 'public_verify_token' | 'proven_at'> };
}

/* * 🚨 [修正済] FormDataではなく純粋なJSONとして送信する。
 * ※ 注意: この関数を呼ぶ前に、フロントエンド側で `/api/upload-url` を叩いて
 * Supabase Storageへのダイレクトアップロードを完了させ、
 * quarantinePath などを metadata に含めて渡す設計にしてください。
 */
export async function createCertificate(input: {
  title: string;
  sha256: string;
  proofMode: 'private' | 'shareable';
  visibility: 'private' | 'unlisted' | 'public';
  quarantinePath: string; // 🟢 追加: アップロード済みファイルのパス
  metadata?: Record<string, unknown>;
}) {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/certificates/create', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: input.title,
      sha256: input.sha256,
      proofMode: input.proofMode,
      visibility: input.visibility,
      quarantinePath: input.quarantinePath,
      metadataJson: input.metadata ?? {},
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'certificate creation failed');
  }

  return (await response.json()) as { certificate: CertificateRecord; duplicate?: boolean };
}

/* * 🚨 [修正済] 生ファイル（step.file）をVercelに送らない。
 * JSONメタデータのみを送信し、ペイロード爆発（413エラー）を防ぐ。
 */
export async function createProcessBundle(input: {
  certificateId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  steps: ProcessBundleDraftStep[];
}) {
  const headers = await getAuthHeaders();
  
  // Fileオブジェクトなどの不要・巨大なデータを削ぎ落とし、純粋なJSONペイロードを構築
  const safeSteps = input.steps.map((step) => ({
    stepType: step.stepType,
    title: step.title,
    note: step.note ?? '',
    isRoot: !!step.isRoot,
    sha256: step.sha256,
    // quarantinePath: step.quarantinePath // ※必要に応じて追加
  }));

  const response = await fetch('/api/process-bundles/create', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      certificateId: input.certificateId,
      title: input.title,
      description: input.description ?? '',
      isPublic: input.isPublic,
      steps: safeSteps,
    })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'process bundle creation failed');
  }
  
  return response.json() as Promise<{
    bundleId: string;
    evidenceMode: 'hash_chain_v1';
    chainDepth: number;
    chainHeadSha256: string | null;
    rootStepId: string | null;
    steps: number;
    certificateId: string;
  }>;
}

export async function getProcessBundleByVerifyToken(token: string) {
  const response = await fetch(`/api/certificates/public/${token}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch public process bundle');
  }
  const data = await response.json();
  return data.bundle;
}

export function sanitizeSvg(svg: string) {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['onload', 'onclick', 'onerror'],
  });
}

export function buildBadgeEmbedHtml(params: { baseUrl: string; certificateId: string; verifyToken: string }) {
  const badgeUrl = `${params.baseUrl.replace(/\/$/, '')}/api/certificates/badge/${params.certificateId}`;
  const verifyUrl = `${params.baseUrl.replace(/\/$/, '')}/cert/${params.verifyToken}`;
  return `<a href=\"${verifyUrl}\" target=\"_blank\" rel=\"noopener noreferrer\"><img src=\"${badgeUrl}\" alt=\"ProofMark Certified\" width=\"196\" height=\"56\" /></a>`;
}

export function buildWidgetEmbedHtml(params: { baseUrl: string; username: string; settings?: Partial<PortfolioEmbedSettings> }) {
  const url = new URL(`/embed/${params.username}`, params.baseUrl.replace(/\/$/, '') + '/');
  if (params.settings?.theme) url.searchParams.set('theme', params.settings.theme);
  if (params.settings?.layout) url.searchParams.set('layout', params.settings.layout);
  if (typeof params.settings?.showBadges === 'boolean') url.searchParams.set('badges', String(params.settings.showBadges));
  if (typeof params.settings?.showBundles === 'boolean') url.searchParams.set('bundles', String(params.settings.showBundles));
  if (typeof params.settings?.maxItems === 'number') url.searchParams.set('maxItems', String(params.settings.maxItems));
  return `<iframe src=\"${url.toString()}\" title=\"ProofMark Portfolio Widget\" loading=\"lazy\" width=\"100%\" height=\"760\" style=\"border:0;border-radius:24px;overflow:hidden;background:#07061A\"></iframe>`;
}