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

// 👑 The Apex Fix: App Routerの深層から、ルートディレクトリの旧API資産（api/_lib）へ正確に結線。
// Turbopackの解釈エラーを防ぐため、Node ESM特有の .js 拡張子指定を物理的にパージ。
import { buildChainOfEvidence } from '../_lib/chain-of-evidence';
import { getLegalCopyrightPdf } from '../_lib/legal-pdf-cache';

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
const C2PA_HARD_CAP_BYTES = 10 * 1024;
const TSA_CA_FETCH_TIMEOUT_MS = 3_000;
const TSA_CA_TTL_MS = 6 * 60 * 60 * 1000;
const SIGNED_URL_EXPIRY_SEC = 300;

function safeFilename(input: string | null | undefined, fallback: string): string {
    const base = (input ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
    return base.length > 0 ? base : fallback;
}

function safeC2paJson(raw: Record<string, unknown> | null): { json: string; bytes: number } | null {
    if (!raw) return null;
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    let json: string;
    try { json = JSON.stringify(raw, null, 2); } catch { return null; }
    const bytes = Buffer.byteLength(json, 'utf8');
    if (bytes <= 0 || bytes > C2PA_HARD_CAP_BYTES) return null;
    return { json, bytes };
}

function buildVerifyShellScript(): string {
    return [
        '#!/usr/bin/env bash',
        '# ProofMark Evidence Pack — RFC3161 Verifier (OpenSSL)',
        'set -euo pipefail',
        'HASH=$(awk -F"= " "/^SHA256/ {print \\$2}" hash.txt)',
        '',
        'if [ -z "$HASH" ]; then',
        '  echo "Cannot read SHA-256 from hash.txt" >&2',
        '  exit 1',
        'fi',
        '',
        'ORIG="${1:-}"',
        'if [ -n "$ORIG" ] && [ -f "$ORIG" ]; then',
        '  ACTUAL=$(openssl dgst -sha256 "$ORIG" | awk "{print \\$2}")',
        '  echo "[HASH] expected=$HASH"',
        '  echo "[HASH] actual  =$ACTUAL"',
        '  if [ "$HASH" != "$ACTUAL" ]; then',
        '    echo "[HASH] MISMATCH" >&2',
        '    exit 2',
        '  fi',
        'fi',
        '',
        'openssl ts -verify \\',
        '  -in timestamp.tsr \\',
        '  -digest "$HASH" \\',
        '  -CAfile freetsa-ca.crt \\',
        '  -untrusted freetsa-tsa.crt',
        '',
        'echo "[TST] OK"',
    ].join('\n');
}

function buildVerifyPython(): string {
    return [
        '#!/usr/bin/env python3',
        '"""ProofMark Evidence Pack — RFC3161 Verifier (Python+OpenSSL)"""',
        'import sys, hashlib, subprocess, pathlib',
        '',
        'def main(argv):',
        '    if len(argv) < 2:',
        '        print("Usage: verify.py <original-file>", file=sys.stderr)',
        '        sys.exit(2)',
        '    orig = pathlib.Path(argv[1])',
        '    expected = open("hash.txt").read().split("=")[1].strip()',
        '    actual = hashlib.sha256(orig.read_bytes()).hexdigest()',
        '    if actual.lower() != expected.lower():',
        '        print(f"[HASH] MISMATCH expected={expected} actual={actual}", file=sys.stderr)',
        '        sys.exit(3)',
        '    print(f"[HASH] OK {actual}")',
        '    r = subprocess.run([',
        '        "openssl","ts","-verify",',
        '        "-in","timestamp.tsr","-digest", expected,',
        '        "-CAfile","freetsa-ca.crt","-untrusted","freetsa-tsa.crt"',
        '    ], capture_output=True, text=True)',
        '    print(r.stdout.strip())',
        '    if "Verification: OK" not in r.stdout:',
        '        print(r.stderr, file=sys.stderr)',
        '        sys.exit(4)',
        '',
        'if __name__ == "__main__":',
        '    main(sys.argv)',
    ].join('\n');
}

let tsaCaCache: { ca: Buffer; tsa: Buffer; expiresAt: number } | null = null;
let tsaCaInflight: Promise<{ ca: Buffer; tsa: Buffer } | null> | null = null;

async function fetchTsaCa(): Promise<{ ca: Buffer; tsa: Buffer } | null> {
    const now = Date.now();
    if (tsaCaCache && tsaCaCache.expiresAt > now) {
        return { ca: tsaCaCache.ca, tsa: tsaCaCache.tsa };
    }
    if (tsaCaInflight) return tsaCaInflight;

    tsaCaInflight = (async () => {
        try {
            const [ca, tsa] = await Promise.all([
                fetch('https://freetsa.org/files/cacert.pem', {
                    signal: AbortSignal.timeout(3000),
                }).then((r) => (r.ok ? r.arrayBuffer() : null)),
                fetch('https://freetsa.org/files/tsa.crt', {
                    signal: AbortSignal.timeout(3000),
                }).then((r) => (r.ok ? r.arrayBuffer() : null)),
            ]);
            if (!ca || !tsa) {
                console.warn('[TSA CA Fetch] Null response. Safely falling back to TSA-less configuration.');
                return null;
            }
            const result = { ca: Buffer.from(ca), tsa: Buffer.from(tsa) };
            tsaCaCache = { ...result, expiresAt: Date.now() + TSA_CA_TTL_MS };
            return result;
        } catch (error) {
            console.warn('[TSA CA Fetch Timeout/Error] AbortSignal limit (3000ms) exceeded or network failure. Safely falling back to TSA-less configuration.', error);
            return null;
        } finally {
            tsaCaInflight = null;
        }
    })();
    return tsaCaInflight;
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

        // ── Build JSON Payload ───────────────────────────────────
        const files: FileEntry[] = [];
        let pdfMeta: EvidencePackPayload['pdfMeta'];

        if (downloadKind === 'auth' && cert) {
            const sha256 = cert.sha256 ?? '';
            const verifyUrl = `https://proofmark.jp/cert/${cert.id}`;
            const baseFile = safeFilename(cert.file_name, 'asset.bin');
            const jstTime = formatJst(cert.certified_at ?? cert.created_at);
            const humanSize = formatBytes(cert.file_size);
            const displayCreatorName = profileRecord?.display_name ?? profileRecord?.username ?? 'ProofMark Creator';

            const c2paBlob = safeC2paJson(cert.c2pa_manifest);
            const c2paIncluded = c2paBlob !== null;

            let chainIncluded = false;
            try {
                const chainBuffer = await buildChainOfEvidence(adminClient, cert.id, { log: console });
                if (chainBuffer && chainBuffer.byteLength > 0) {
                    files.push({ name: 'chain_of_evidence.json', type: 'text', content: chainBuffer.toString('utf8') });
                    chainIncluded = true;
                }
            } catch (err) {
                console.warn('[Chain Build Warning]', err);
            }

            const legalPdf = await getLegalCopyrightPdf(console);
            const legalGuideIncluded = legalPdf !== null;

            let originalIncluded = false;
            if (cert.proof_mode === 'shareable' && cert.storage_path) {
                try {
                    const { data: signedData, error: signErr } = await adminClient
                        .storage
                        .from('proofmark-originals')
                        .createSignedUrl(cert.storage_path, SIGNED_URL_EXPIRY_SEC);
                    if (signErr || !signedData?.signedUrl) throw new Error(signErr?.message);
                    
                    files.push({ name: `original/${baseFile}`, type: 'url', url: signedData.signedUrl });
                    originalIncluded = true;
                } catch (err) {
                    console.warn('[Storage Sign Warning]', err);
                    files.push({
                        name: `original/${baseFile}.MISSING.txt`,
                        type: 'text',
                        content: 'Original file could not be retrieved at this time.\n',
                    });
                }
            }

            const fileTree: Array<{ name: string; size: string; description?: string }> = [
                { name: 'Cover_Letter.pdf', size: '—', description: 'ProofMark Client Hand-off Letter (PDF)' },
                { name: 'Certificate_of_Authenticity.pdf', size: '—', description: 'Cryptographic Certificate of Authenticity (PDF)' },
                { name: 'hash.txt', size: '—', description: 'Target file SHA-256 hash value' },
                ...(cert.timestamp_token ? [{ name: 'timestamp.tsr', size: '—', description: 'RFC3161 tamper-proof timestamp token' }] : []),
                ...(c2paIncluded ? [{ name: 'c2pa.json', size: '—', description: 'Scrubbed Content Credentials manifest' }] : []),
                ...(chainIncluded ? [{ name: 'chain_of_evidence.json', size: '—', description: 'Tamper-evident audit trail' }] : []),
                ...(legalGuideIncluded ? [{ name: 'legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf', size: '—', description: 'Legal Copyright & Compliance PDF' }] : []),
                ...(originalIncluded ? [{ name: `original/${baseFile}`, size: '—', description: 'Original verified asset' }] : []),
                { name: 'verify.sh', size: '—', description: 'Shell verification script (OpenSSL)' },
                { name: 'verify.py', size: '—', description: 'Python verification script (OpenSSL)' },
                { name: 'metadata.json', size: '—', description: 'Machine-readable evidence metadata' },
                { name: 'freetsa-ca.crt', size: '—', description: 'FreeTSA CA Certificate' },
                { name: 'freetsa-tsa.crt', size: '—', description: 'FreeTSA TSA Certificate' },
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

            files.push({ name: 'hash.txt', type: 'text', content: `SHA256= ${sha256}\n` });

            if (cert.timestamp_token) {
                files.push({ name: 'timestamp.tsr', type: 'base64', content: cert.timestamp_token });
            } else {
                files.push({
                    name: 'timestamp.MISSING.txt',
                    type: 'text',
                    content: 'Timestamp token is not yet issued for this certificate.\n',
                });
            }

            if (c2paBlob) files.push({ name: 'c2pa.json', type: 'text', content: c2paBlob.json });
            if (legalPdf) {
                files.push({
                    name: 'legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf',
                    type: 'base64',
                    content: legalPdf.buffer.toString('base64'),
                });
            }

            files.push({ name: 'verify.sh', type: 'text', content: buildVerifyShellScript() });
            files.push({ name: 'verify.py', type: 'text', content: buildVerifyPython() });

            // JSON メタデータのエクスポート
            const meta = {
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
                c2pa_present: c2paIncluded,
                c2pa_bytes: c2paBlob?.bytes ?? 0,
                chain_present: chainIncluded,
                legal_guide_present: legalGuideIncluded,
            };
            files.push({ name: 'metadata.json', type: 'text', content: JSON.stringify(meta, null, 2) });

            const caBundle = await fetchTsaCa();
            if (caBundle) {
                files.push({ name: 'freetsa-ca.crt', type: 'base64', content: caBundle.ca.toString('base64') });
                files.push({ name: 'freetsa-tsa.crt', type: 'base64', content: caBundle.tsa.toString('base64') });
            }

        } else if (downloadKind === 'spot' && spotOrder) {
            const sha256 = spotOrder.sha256 ?? '';
            const verifyUrl = `https://proofmark.jp/spot-issue/result?sid=${spotOrder.stripe_session_id}`;
            const baseFile = safeFilename(spotOrder.filename, 'artwork.bin');
            const jstTime = formatJst(spotOrder.paid_at);

            const legalPdf = await getLegalCopyrightPdf(console);
            const legalGuideIncluded = legalPdf !== null;

            const fileTree: Array<{ name: string; size: string; description?: string }> = [
                { name: 'Cover_Letter.pdf', size: '—', description: 'ProofMark Spot Client Hand-off Letter (PDF)' },
                { name: 'Certificate_of_Authenticity.pdf', size: '—', description: 'Cryptographic Certificate of Authenticity (PDF)' },
                { name: 'hash.txt', size: '—', description: 'Target file SHA-256 hash value' },
                { name: 'timestamp.tsr', size: '—', description: 'RFC3161 tamper-proof timestamp token' },
                ...(legalGuideIncluded ? [{ name: 'legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf', size: '—', description: 'Legal Copyright & Compliance PDF' }] : []),
                { name: 'verify.sh', size: '—', description: 'Shell verification script (OpenSSL)' },
                { name: 'verify.py', size: '—', description: 'Python verification script (OpenSSL)' },
                { name: 'metadata.json', size: '—', description: 'Machine-readable evidence metadata' },
                { name: 'freetsa-ca.crt', size: '—', description: 'FreeTSA CA Certificate' },
                { name: 'freetsa-tsa.crt', size: '—', description: 'FreeTSA TSA Certificate' },
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

            files.push({ name: 'hash.txt', type: 'text', content: `SHA256= ${sha256}\n` });

            try {
                const { data: tsrBlob, error: tsrErr } = await adminClient
                    .storage
                    .from('spot-evidence')
                    .download(`${spotOrder.staging_id}/timestamp.tsr`);
                if (tsrErr || !tsrBlob) throw new Error(tsrErr?.message);
                
                const arrayBuf = await tsrBlob.arrayBuffer();
                files.push({ name: 'timestamp.tsr', type: 'base64', content: Buffer.from(arrayBuf).toString('base64') });
            } catch (err) {
                console.warn('[Spot TSR Fetch Failed]', err);
                files.push({
                    name: 'timestamp.MISSING.txt',
                    type: 'text',
                    content: 'Timestamp token (timestamp.tsr) could not be retrieved.\n',
                });
            }

            if (legalPdf) {
                files.push({
                    name: 'legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf',
                    type: 'base64',
                    content: legalPdf.buffer.toString('base64'),
                });
            }

            files.push({ name: 'verify.sh', type: 'text', content: buildVerifyShellScript() });
            files.push({ name: 'verify.py', type: 'text', content: buildVerifyPython() });

            files.push({
                name: 'metadata.json',
                type: 'text',
                content: JSON.stringify(
                    {
                        kind: 'spot',
                        staging_id: spotOrder.staging_id,
                        stripe_session_id: spotOrder.stripe_session_id,
                        sha256,
                        paid_at: spotOrder.paid_at,
                        verify_url: verifyUrl,
                        c2pa_present: false,
                        chain_present: false,
                        legal_guide_present: legalGuideIncluded,
                    },
                    null,
                    2,
                ),
            });

            const caBundle = await fetchTsaCa();
            if (caBundle) {
                files.push({ name: 'freetsa-ca.crt', type: 'base64', content: caBundle.ca.toString('base64') });
                files.push({ name: 'freetsa-tsa.crt', type: 'base64', content: caBundle.tsa.toString('base64') });
            }
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