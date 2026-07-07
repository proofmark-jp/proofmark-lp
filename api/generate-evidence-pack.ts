/**
 * GET /api/generate-evidence-pack?cert=<UUID>
 * OR
 * GET /api/generate-evidence-pack?spot=<sessionId>&staging=<uuid>
 *
 * In-Browser ZIP Assembly Architecture (v4)
 * ─────────────────────────────────────────
 * このAPIはZIPを返さない。代わりに「暗号部品のJSON Payload」を返す。
 * ブラウザ側の EvidencePackDownloadButton.tsx が JSZip + @react-pdf/renderer を
 * 用いてPDF生成・ZIP組み立て・ダウンロードの全重労働を担う。
 *
 * レスポンス形式: application/json — EvidencePackPayload
 * • filename     : ZIPのファイル名
 * • pdfMeta      : フロントのPDF生成に必要な certInput / coverInput
 * • files        : ZIPに含める各ファイル記述子の配列
 * - type:"text"   → content: 文字列のまま
 * - type:"base64" → content: Base64文字列 (バイナリを安全に転送)
 * - type:"url"    → url: 署名付きURL (ブラウザがfetchして追加)
 *
 * 既存 invariants (Auth/Spot分岐, 権限チェック, RateLimit, Plan Guard) 完全維持。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
    HttpError,
    getAdminClient,
    getClientIp,
    makeLogger,
    methodGuard,
    tryUser,
} from './_lib/server.js';
import { buildChainOfEvidence } from './_lib/chain-of-evidence.js';
import { getLegalCopyrightPdf } from './_lib/legal-pdf-cache.js';

export const config = { maxDuration: 300 };

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// Helpers: formatters
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// Rate Limit (Fail-open)
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const C2PA_HARD_CAP_BYTES = 10 * 1024;
const TSA_CA_FETCH_TIMEOUT_MS = 3_000;
const TSA_CA_TTL_MS = 6 * 60 * 60 * 1000;
const SIGNED_URL_EXPIRY_SEC = 300;

// ─────────────────────────────────────────────────────────
// DB Record Interfaces (🚨 監査により実在しないカラムを完全切除)
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// Helpers: validation & safety
// ─────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(res: VercelResponse, status: number, msg: string) {
    if (!res.headersSent) {
        res.status(status).json({ error: msg });
    }
}

function safeFilename(input: string | null | undefined, fallback: string): string {
    const base = (input ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
    return base.length > 0 ? base : fallback;
}

function safeC2paJson(raw: Record<string, unknown> | null): { json: string; bytes: number } | null {
    if (!raw) return null;
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    let json: string;
    try {
        json = JSON.stringify(raw, null, 2);
    } catch {
        return null;
    }
    const bytes = Buffer.byteLength(json, 'utf8');
    if (bytes <= 0 || bytes > C2PA_HARD_CAP_BYTES) return null;
    return { json, bytes };
}

// ─────────────────────────────────────────────────────────
// Helpers: verify scripts
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// Helpers: TSA CA bundle cache
// ─────────────────────────────────────────────────────────

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
                    signal: AbortSignal.timeout(TSA_CA_FETCH_TIMEOUT_MS),
                }).then((r) => (r.ok ? r.arrayBuffer() : null)),
                fetch('https://freetsa.org/files/tsa.crt', {
                    signal: AbortSignal.timeout(TSA_CA_FETCH_TIMEOUT_MS),
                }).then((r) => (r.ok ? r.arrayBuffer() : null)),
            ]);
            if (!ca || !tsa) return null;
            const result = { ca: Buffer.from(ca), tsa: Buffer.from(tsa) };
            tsaCaCache = { ...result, expiresAt: Date.now() + TSA_CA_TTL_MS };
            return result;
        } catch {
            return null;
        } finally {
            tsaCaInflight = null;
        }
    })();
    return tsaCaInflight;
}

// ─────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const log = makeLogger('generate-evidence-pack');
    res.setHeader('x-request-id', log.ctx.reqId);

    if (!methodGuard(req, res, ['GET'])) return;

    if (ratelimit) {
        const ip = getClientIp(req);
        try {
            const { success } = await ratelimit.limit(ip);
            if (!success) {
                log.warn({ event: 'ratelimit_exceeded', ip });
                fail(res, 429, 'Too many requests');
                return;
            }
        } catch (limitError) {
            log.error({ event: 'ratelimit_error', message: String(limitError) });
        }
    }

    try {
        const rawCert = Array.isArray(req.query.cert) ? req.query.cert[0] : req.query.cert;
        const rawSpot = Array.isArray(req.query.spot) ? req.query.spot[0] : req.query.spot;
        const rawStaging = Array.isArray(req.query.staging) ? req.query.staging[0] : req.query.staging;
        
        const certParam   = (rawCert as string | undefined) ?? '';
        const spotSession = (rawSpot as string | undefined) ?? '';
        const stagingId   = (rawStaging as string | undefined) ?? '';

        if (!certParam && !spotSession) throw new HttpError(400, 'cert or spot is required');

        const admin = getAdminClient();
        let cert: CertRecord | null = null;
        let downloadKind: 'auth' | 'spot' = 'auth';
        let spotOrder: SpotOrderRecord | null = null;
        let evidencePackName = 'proofmark-evidence-pack.zip';
        let profileRecord: any = null;

        // ── Auth flow (cert UUID) ────────────────────────────────
        if (certParam) {
            if (!UUID.test(certParam)) throw new HttpError(400, 'cert must be a UUID');
            const user = await tryUser(req);

            // 🚨 監査対応: 存在しない旧カラムを .select() から完全削除
            const { data, error } = await admin
                .from('certificates')
                .select('id, user_id, title, sha256, proof_mode, visibility, public_image_url, storage_path, file_name, certified_at, created_at, timestamp_token, tsa_provider, tsa_url, c2pa_manifest, file_size')
                .eq('id', certParam)
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new HttpError(404, 'Certificate not found');
            const visibility = data.visibility ?? 'private';

            const isPublic = visibility === 'public' || visibility === 'unlisted';
            let isAuthorized = isPublic || (!!user && user.id === data.user_id);
            
            // 🚨 監査対応: team_id カラム削除に伴う権限デッドロックのブロックを除去
            if (!isAuthorized) throw new HttpError(403, 'Not authorized');

            if (data.user_id) {
                const { data: profile } = await admin
                    .from('profiles')
                    .select('plan_tier, display_name, username')
                    .eq('id', data.user_id)
                    .maybeSingle();

                profileRecord = profile;

                if (!profile || profile.plan_tier === 'free') {
                    log.warn({ event: 'plan_block', userId: data.user_id, certId: data.id });
                    throw new HttpError(403, 'Evidence Pack generation requires Creator plan or higher');
                }
            }

            cert = data as CertRecord;
            evidencePackName = `evidence-pack-${(cert.id || 'cert').slice(0, 8)}.zip`;

        // ── Spot flow ────────────────────────────────────────────
        } else {
            if (!UUID.test(stagingId)) throw new HttpError(400, 'staging must be a UUID');
            const { data, error } = await admin
                .from('spot_orders')
                .select('staging_id, stripe_session_id, status, sha256, filename, email, paid_at')
                .eq('staging_id', stagingId)
                .eq('stripe_session_id', spotSession)
                .maybeSingle();
            if (error) throw error;
            if (!data) throw new HttpError(404, 'Spot order not found');
            if (data.status !== 'paid') throw new HttpError(402, 'Payment not completed');
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
            // 🚨 監査対応: original_filename を排除し file_name に一本化
            const baseFile = safeFilename(cert.file_name, 'asset.bin');
            // 🚨 監査対応: proven_at を排除し certified_at / created_at でハンドリング
            const jstTime = formatJst(cert.certified_at ?? cert.created_at);
            const humanSize = formatBytes(cert.file_size);
            const displayCreatorName = profileRecord?.display_name ?? profileRecord?.username ?? 'ProofMark Creator';

            const c2paBlob = safeC2paJson(cert.c2pa_manifest);
            const c2paIncluded = c2paBlob !== null;

            let chainIncluded = false;
            try {
                const chainBuffer = await buildChainOfEvidence(admin, cert.id, { log });
                if (chainBuffer && chainBuffer.byteLength > 0) {
                    if (chainBuffer.byteLength > 1 * 1024 * 1024) {
                        log.warn({ event: 'chain.size_warn', bytes: chainBuffer.byteLength });
                    }
                    files.push({ name: 'chain_of_evidence.json', type: 'text', content: chainBuffer.toString('utf8') });
                    chainIncluded = true;
                    log.info({ event: 'evidence-pack.chain_attached', bytes: chainBuffer.byteLength });
                }
            } catch (err) {
                log.warn({ event: 'chain.build_failed', message: String((err as Error)?.message ?? err) });
            }

            const legalPdf = await getLegalCopyrightPdf(log);
            const legalGuideIncluded = legalPdf !== null;

            let originalIncluded = false;
            if (cert.proof_mode === 'shareable' && cert.storage_path) {
                try {
                    const { data: signedData, error: signErr } = await admin
                        .storage
                        .from('proofmark-originals')
                        .createSignedUrl(cert.storage_path, SIGNED_URL_EXPIRY_SEC);
                    if (signErr || !signedData?.signedUrl) {
                        throw new Error(signErr?.message ?? 'No signed URL returned');
                    }
                    files.push({ name: `original/${baseFile}`, type: 'url', url: signedData.signedUrl });
                    originalIncluded = true;
                    log.info({ event: 'evidence-pack.original_signed', path: cert.storage_path });
                } catch (err) {
                    log.warn({
                        event: 'auth.original_sign_failed',
                        path: cert.storage_path,
                        message: String((err as Error)?.message ?? err),
                    });
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

            if (c2paBlob) {
                files.push({ name: 'c2pa.json', type: 'text', content: c2paBlob.json });
                log.info({ event: 'evidence-pack.c2pa_attached', bytes: c2paBlob.bytes });
            }

            if (legalPdf) {
                files.push({
                    name: 'legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf',
                    type: 'base64',
                    content: legalPdf.buffer.toString('base64'),
                });
                log.info({ event: 'evidence-pack.legal_guide_attached', bytes: legalPdf.bytes });
            } else {
                files.push({
                    name: 'legal_guide/README.txt',
                    type: 'text',
                    content: 'ProofMark_Legal_and_Compliance_Guide.pdf could not be embedded.\nPlease refer to https://proofmark.jp/legal-guide for the latest legal context.\n',
                });
            }

            files.push({ name: 'verify.sh', type: 'text', content: buildVerifyShellScript() });
            files.push({ name: 'verify.py', type: 'text', content: buildVerifyPython() });

            // 🚨 監査対応: メタデータJSONの旧プロパティを完全消去
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
            } else {
                files.push({
                    name: 'freetsa.README.txt',
                    type: 'text',
                    content: 'CA/TSA certificates could not be embedded automatically.\nPlease download from https://freetsa.org/files/ before running verify.sh.\n',
                });
            }

        } else if (downloadKind === 'spot' && spotOrder) {
            const sha256 = spotOrder.sha256 ?? '';
            const verifyUrl = `https://proofmark.jp/spot-issue/result?sid=${spotOrder.stripe_session_id}`;
            const baseFile = safeFilename(spotOrder.filename, 'artwork.bin');
            const jstTime = formatJst(spotOrder.paid_at);

            const legalPdf = await getLegalCopyrightPdf(log);
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
                const { data: tsrBlob, error: tsrErr } = await admin
                    .storage
                    .from('spot-evidence')
                    .download(`${spotOrder.staging_id}/timestamp.tsr`);
                if (tsrErr || !tsrBlob) throw new Error(tsrErr?.message ?? 'No blob');
                const arrayBuf = await tsrBlob.arrayBuffer();
                const tsrBuffer = Buffer.from(arrayBuf);
                files.push({ name: 'timestamp.tsr', type: 'base64', content: tsrBuffer.toString('base64') });
                log.info({ event: 'spot.tsr_attached', bytes: tsrBuffer.byteLength });
            } catch (err) {
                log.warn({
                    event: 'spot.tsr_missing',
                    stagingId: spotOrder.staging_id,
                    message: String((err as Error)?.message ?? err),
                });
                files.push({
                    name: 'timestamp.MISSING.txt',
                    type: 'text',
                    content: 'Timestamp token (timestamp.tsr) could not be retrieved.\nPlease re-run the Spot verification step or contact support.\n',
                });
            }

            if (legalPdf) {
                files.push({
                    name: 'legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf',
                    type: 'base64',
                    content: legalPdf.buffer.toString('base64'),
                });
                log.info({ event: 'evidence-pack.legal_guide_attached', kind: 'spot', bytes: legalPdf.bytes });
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
        } else {
            throw new HttpError(500, 'Invalid download kind');
        }

        const payload: EvidencePackPayload = {
            filename: evidencePackName,
            pdfMeta: pdfMeta!,
            files,
        };

        res.setHeader('Cache-Control', 'private, no-store');
        res.status(200).json(payload);

        log.info({
            event: 'evidence-pack.payload_sent',
            kind: downloadKind,
            certId: cert?.id ?? null,
            stagingId: spotOrder?.staging_id ?? null,
            fileCount: files.length,
        });

    } catch (err) {
        if (err instanceof HttpError) {
            fail(res, err.status, err.message);
            return;
        }
        log.error({ event: 'evidence-pack.error', message: String((err as Error)?.message ?? err) });
        fail(res, 500, 'Internal error');
    }
}