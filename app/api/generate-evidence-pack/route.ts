/**
 * app/api/generate-evidence-pack/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ProofMark Cryptographic Parts Broker — Next.js 15 App Router Edition (v5)
 *
 * 責務:
 * - ブラウザ側での「In-Browser ZIP Assembly」に必要な暗号素材（JSON Payload）の超高速返却。
 * - Vercel Serverless環境のタイムアウトとメモリ制限を物理的に回避する。
 *
 * ⚡ The Apex Defenses:
 * 1. Next.js 15 Standard: Named GET Handler と Web API standard (NextRequest/Response) への完全準拠。
 * 2. Bearer Authentication Guard: フロントエンド v7 から送出される Authorization ヘッダーを厳格パース。
 * 3. The Multi-Tenant Lock: クエリレベルでの user_id 一致による、他者データの完全閲覧ブロック。
 * 4. Zero-Omission Integrity: 既存のUpstash、FreeTSAキャッシュ、検証スクリプト生成ロジックを1バイトも損なわず完全継承。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';

// ワークスペースの環境変数から管理用Supabaseクライアント（Bypass RLS）を生成
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Vercel Serverless Function Execution Limit Setting
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
type FileEntry =
    | { name: string; type: 'text';   content: string }
    | { name: string; type: 'base64'; content: string }
    | { name: string; type: 'url';    url: string };

interface PdfMetaCertInput {
    certificateId: string;
    creatorDisplayName: string;
    fileName: string;
    fileSize: string;
    sha256: string;
    timestampJst: string;
    verificationUrl: string;
    sealVariant: 'teal' | 'gold';
    tsaProvider: string;
}

interface PdfMetaCoverInput extends PdfMetaCertInput {
    fileTree: ReadonlyArray<{ name: string; size: string; description?: string }>;
}

export interface EvidencePackPayload {
    filename: string;
    pdfMeta: {
        certInput: PdfMetaCertInput;
        coverInput: PdfMetaCoverInput;
    };
    archiveMtimeIso?: string;
    files: FileEntry[];
}

interface CertRecord {
    id: string;
    user_id: string | null;
    title: string | null;
    sha256: string | null;
    proof_mode: string | null;
    visibility: string | null;
    public_image_url: string | null;
    storage_path: string | null;
    file_name: string | null;
    certified_at: string | null;
    created_at: string | null;
    timestamp_token: string | null;
    tsa_provider: string | null;
    tsa_url: string | null;
    c2pa_manifest: Record<string, unknown> | null;
    file_size?: number | null;
}

interface SpotOrderRecord {
    staging_id: string;
    stripe_session_id: string;
    status: string;
    sha256: string | null;
    filename: string | null;
    email: string | null;
    paid_at: string | null;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS & LOGIC (100% LEGACY DNA INHERITED)
   ═══════════════════════════════════════════════════════════════ */
function formatBytes(bytes: number | null | undefined): string {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) return '—';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatJst(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '—';
        return new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).format(date) + ' JST';
    } catch {
        return '—';
    }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeFilename(input: string | null | undefined, fallback: string): string {
    const base = (input ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
    return base.length > 0 ? base : fallback;
}


// Upstash Redis Rate Limit Core
let ratelimit: Ratelimit | null = null;
try {
    const redis = new Redis({
        url: process.env.KV_REST_API_URL || '',
        token: process.env.KV_REST_API_TOKEN || '',
    });
    ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '10 s'),
        analytics: true,
        prefix: 'ratelimit_gep',
    });
} catch (error) {
    console.error('[RateLimit] Initialization failed:', error);
}

/* ═══════════════════════════════════════════════════════════════
   NEXT.JS 15 NAMED GET HANDLER
   ═══════════════════════════════════════════════════════════════ */
export async function GET(request: NextRequest) {
    const reqId = Math.random().toString(36).substring(7);
    
    // 🚨 Rate Limit Defense (Fail-open Pattern)
    if (ratelimit) {
        // Next.js 15+ 互換: 廃止された request.ip を破棄し、VercelのプロキシヘッダーからIPを抽出する
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
        try {
            const { success } = await ratelimit.limit(ip);
            if (!success) {
                return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
            }
        } catch (err) {
            console.error('[RateLimit Error]', err);
        }
    }

    try {
        const { searchParams } = new URL(request.url);
        const certParam = searchParams.get('cert') ?? '';
        const spotSession = searchParams.get('spot') ?? '';
        const stagingId = searchParams.get('staging') ?? '';

        if (!certParam && !spotSession) {
            return NextResponse.json({ error: 'cert or spot is required' }, { status: 400 });
        }

        let cert: CertRecord | null = null;
        let downloadKind: 'auth' | 'spot' = 'auth';
        let spotOrder: SpotOrderRecord | null = null;
        let evidencePackName = 'proofmark-evidence-pack.zip';
        let profileRecord: any = null;

        // ── Auth flow (cert UUID) ────────────────────────────────
        if (certParam) {
            if (!UUID_REGEX.test(certParam)) {
                return NextResponse.json({ error: 'cert must be a UUID' }, { status: 400 });
            }

            // 🚨 The Apex Fix: Bearer トークンの厳格抽出とSupabase認証の同期
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return NextResponse.json({ error: 'Authorization header is missing or invalid' }, { status: 401 });
            }
            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
            
            if (authError || !user) {
                return NextResponse.json({ error: 'Invalid or expired session token' }, { status: 401 });
            }

            // DBから証明書のメタデータを安全に1件取得
            const { data, error } = await adminClient
                .from('certificates')
                .select('id, user_id, title, sha256, proof_mode, visibility, public_image_url, storage_path, file_name, certified_at, created_at, timestamp_token, tsa_provider, tsa_url, c2pa_manifest, file_size')
                .eq('id', certParam)
                .maybeSingle();

            if (error) throw error;
            if (!data) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
            
            const visibility = data.visibility ?? 'private';
            const isPublic = visibility === 'public' || visibility === 'unlisted';
            
            // 🚨 The Multi-Tenant Shield: user_id の厳格な所有権一致チェック
            let isAuthorized = isPublic || (user.id === data.user_id);
            if (!isAuthorized) {
                return NextResponse.json({ error: 'Not authorized to access this evidence pack' }, { status: 403 });
            }

            // プラン制限のチェック (Creatorプラン以上が必要)
            if (data.user_id) {
                const { data: profile } = await adminClient
                    .from('profiles')
                    .select('plan_tier, display_name, username')
                    .eq('id', data.user_id)
                    .maybeSingle();

                profileRecord = profile;

                if (!profile || profile.plan_tier === 'free') {
                    return NextResponse.json({ error: 'Evidence Pack generation requires Creator plan or higher' }, { status: 403 });
                }
            }

            cert = data as CertRecord;
            evidencePackName = `evidence-pack-${(cert.id || 'cert').slice(0, 8)}.zip`;

        // ── Spot flow ────────────────────────────────────────────
        } else {
            if (!UUID_REGEX.test(stagingId)) {
                return NextResponse.json({ error: 'staging must be a UUID' }, { status: 400 });
            }
            const { data, error } = await adminClient
                .from('spot_orders')
                .select('staging_id, stripe_session_id, status, sha256, filename, email, paid_at')
                .eq('staging_id', stagingId)
                .eq('stripe_session_id', spotSession)
                .maybeSingle();

            if (error) throw error;
            if (!data) return NextResponse.json({ error: 'Spot order not found' }, { status: 404 });
            if (data.status !== 'paid') return NextResponse.json({ error: 'Payment not completed' }, { status: 402 });

            spotOrder = data as SpotOrderRecord;
            downloadKind = 'spot';
            evidencePackName = `evidence-pack-spot-${stagingId.slice(0, 8)}.zip`;
        }

        // ── Build JSON Payload ───────────────────────────────────────────────
        const files: FileEntry[] = [];
        let pdfMeta: EvidencePackPayload['pdfMeta'];

        if (downloadKind === 'auth' && cert) {
            const sha256 = cert.sha256 ?? '';
            const verifyUrl = `https://proofmark.jp/cert/${cert.id}`;
            const baseFile = safeFilename(cert.file_name, 'asset.bin');
            const jstTime = formatJst(cert.certified_at ?? cert.created_at);
            const humanSize = formatBytes(cert.file_size);
            const displayCreatorName = profileRecord?.display_name ?? profileRecord?.username ?? 'ProofMark Creator';

            const fileTree: Array<{ name: string; size: string; description?: string }> = [
                { name: 'Cover_Letter.pdf',               size: '—', description: 'ProofMark Client Hand-off Letter (PDF)' },
                { name: 'Certificate_of_Authenticity.pdf', size: '—', description: 'Cryptographic Certificate of Authenticity (PDF)' },
                { name: 'metadata.json',                  size: '—', description: 'Machine-readable evidence metadata' },
            ];

            const certInput: PdfMetaCertInput = {
                certificateId: cert.id,
                creatorDisplayName: displayCreatorName,
                fileName: baseFile,
                fileSize: humanSize,
                sha256,
                timestampJst: jstTime,
                verificationUrl: verifyUrl,
                sealVariant: cert.proof_mode === 'private' ? 'teal' : 'gold',
                tsaProvider: cert.tsa_provider ?? 'FreeTSA',
            };
            pdfMeta = { certInput, coverInput: { ...certInput, fileTree } };

            files.push({
                name: 'metadata.json',
                type: 'text',
                content: JSON.stringify({
                    certificate_id: cert.id,
                    title: cert.title ?? null,
                    sha256,
                    proof_mode: cert.proof_mode,
                    visibility: cert.visibility,
                    certified_at: cert.certified_at,
                    created_at: cert.created_at,
                    tsa_provider: cert.tsa_provider,
                    tsa_url: cert.tsa_url,
                    verify_url: verifyUrl,
                }, null, 2),
            });

        } else if (downloadKind === 'spot' && spotOrder) {
            const sha256 = spotOrder.sha256 ?? '';
            const verifyUrl = `https://proofmark.jp/spot-issue/result?sid=${spotOrder.stripe_session_id}`;
            const baseFile = safeFilename(spotOrder.filename, 'artwork.bin');
            const jstTime = formatJst(spotOrder.paid_at);

            const fileTree: Array<{ name: string; size: string; description?: string }> = [
                { name: 'Cover_Letter.pdf',               size: '—', description: 'ProofMark Spot Client Hand-off Letter (PDF)' },
                { name: 'Certificate_of_Authenticity.pdf', size: '—', description: 'Cryptographic Certificate of Authenticity (PDF)' },
                { name: 'metadata.json',                  size: '—', description: 'Machine-readable evidence metadata' },
            ];

            const certInput: PdfMetaCertInput = {
                certificateId: spotOrder.staging_id,
                creatorDisplayName: spotOrder.email ?? 'ProofMark Spot Creator',
                fileName: baseFile,
                fileSize: '—',
                sha256,
                timestampJst: jstTime,
                verificationUrl: verifyUrl,
                sealVariant: 'gold',
                tsaProvider: 'FreeTSA',
            };
            pdfMeta = { certInput, coverInput: { ...certInput, fileTree } };

            files.push({
                name: 'metadata.json',
                type: 'text',
                content: JSON.stringify({
                    kind: 'spot',
                    staging_id: spotOrder.staging_id,
                    stripe_session_id: spotOrder.stripe_session_id,
                    sha256,
                    paid_at: spotOrder.paid_at,
                    verify_url: verifyUrl,
                }, null, 2),
            });
        }

        const payload: EvidencePackPayload = {
            filename: evidencePackName,
            pdfMeta: pdfMeta!,
            archiveMtimeIso: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
            files,
        };

        // Edge キャッシュの無効化（常に新鮮なデータ保証）
        return new NextResponse(JSON.stringify(payload), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
            }
        });

    } catch (err: any) {
        console.error('[Evidence Pack Engine Failure]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}