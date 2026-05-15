/**
 * GET /api/generate-evidence-pack?cert=<UUID>
 *      OR
 * GET /api/generate-evidence-pack?spot=<sessionId>&staging=<uuid>
 *
 * Phase 12.4 — Evidence Engine Value-Add pass.
 *
 * Phase 11.B で確立した invariants は厳守:
 *   • archiver を `res` に直接 pipe。原画は Buffer 化せずストリーム結合。
 *   • FIXED_ZIP_TIME による決定論的 ZIP。
 *   • upstream stream の AbortController + watchdog timeout。
 *   • TSA CA bundle の process-local cache (LRU=1, TTL 6h)。
 *   • c2pa.json 10KB ハードキャップ + 動的 CLIENT_LETTER。
 *
 * Phase 12.4 で追加:
 *   1. **chain_of_evidence.json** — `cert_audit_logs` から監査ログを時系列
 *      取得し、`fn_verify_audit_chain` の結果を chain_ok として埋め込む。
 *      Buffer のまま archiver に渡す (動的生成 / DB 軽量読み出しのみ)。
 *   2. ** /legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf ** — Supabase public バケット
 *      にあらかじめ配置された静的 PDF を CDN から fetch し、Vercel グローバル
 *      スコープに Buffer キャッシュ(TTL 6h)。PDFKit 等の動的 PDF 生成は
 *      絶対に使わない(Zero - Op 厳守)。
 *   3. ** stream.pipeline 化 ** — archiver→res の接続を`node:stream/promises`
 *      の pipeline で行い、backpressure を Node.js 側に確実に委ねる。
 *      これにより slow consumer(スマホ回線) でも heap が膨張しない。
 *   4. CLIENT_LETTER に「法務向け参考 PDF が同梱される旨」を、PDF が実際に
 *      同梱できた時のみ動的に追記。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import archiver from 'archiver';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
    HttpError,
    getAdminClient,
    json,
    makeLogger,
    methodGuard,
    tryUser,
} from './_lib/server.js';
import { buildChainOfEvidence } from './_lib/chain-of-evidence.js';
import { getLegalCopyrightPdf } from './_lib/legal-pdf-cache.js';

export const config = { maxDuration: 300 };

// --- Upstash Rate Limit Init (Fail-open) ---
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

const FIXED_ZIP_TIME = new Date('2026-01-01T00:00:00.000Z');

const C2PA_HARD_CAP_BYTES = 10 * 1024;
const STREAM_FETCH_TIMEOUT_MS = 290_000;
const TSA_CA_FETCH_TIMEOUT_MS = 3_000;
const TSA_CA_TTL_MS = 6 * 60 * 60 * 1000;

interface CertRecord {
    id: string;
    user_id: string | null;
    title: string | null;
    sha256: string | null;
    proof_mode: string | null;
    visibility: string | null;
    public_image_url: string | null;
    storage_path: string | null;
    original_filename: string | null;
    file_name: string | null;
    certified_at: string | null;
    proven_at: string | null;
    created_at: string | null;
    timestamp_token: string | null;
    tsa_provider: string | null;
    tsa_url: string | null;
    team_id: string | null;
    c2pa_manifest: Record<string, unknown> | null;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(res: VercelResponse, status: number, msg: string) {
    if (!res.headersSent) {
        res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify({ error: msg }));
    }
}

function safeFilename(input: string | null | undefined, fallback: string): string {
    const base = (input ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
    return base.length > 0 ? base : fallback;
}

interface ClientLetterOptions {
    c2paIncluded: boolean;
    chainIncluded: boolean;
    legalGuideIncluded: boolean;
}

function buildClientLetter(
    cert: CertRecord,
    verifyUrl: string,
    options: ClientLetterOptions,
): string {
    const issuedAt = cert.certified_at ?? cert.proven_at ?? cert.created_at ?? '';
    const niceTitle = cert.title ?? cert.original_filename ?? cert.file_name ?? 'Verified Digital Artwork';
    const sha256 = cert.sha256 ?? '';

    const verifySteps: string[] = [
        '1. Compute SHA-256 of the supplied file and ensure it matches "SHA-256" above.',
        '2. Run `verify.sh` (or `verify.py`) inside this archive to verify the RFC3161',
        '   timestamp token (timestamp.tsr) using OpenSSL.',
    ];
    let n = 3;
    if (options.c2paIncluded) {
        verifySteps.push(`${n}. If this work contains Content Credentials, open c2pa.json to review the scrubbed manifest.`);
        n += 1;
    }
    if (options.chainIncluded) {
        verifySteps.push(`${n}. Open chain_of_evidence.json to inspect the tamper-evident audit log (SHA-256 chain).`);
        n += 1;
    }
    if (options.legalGuideIncluded) {
        verifySteps.push(`${n}. Refer to /legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf for the relevant legal context.`);
        n += 1;
    }
    verifySteps.push(`${n}. Optionally open Verify URL to compare against the public certificate page.`);

    const inclusions: string[] = [];
    if (options.c2paIncluded) inclusions.push('a scrubbed Content Credentials (C2PA) manifest as c2pa.json');
    if (options.chainIncluded) inclusions.push('a tamper-evident audit chain as chain_of_evidence.json');
    if (options.legalGuideIncluded) inclusions.push('a legal context PDF under /legal_guide/');
    const inclusionLine = inclusions.length
        ? `It additionally embeds ${inclusions.join('; ')}.`
        : '';

    return [
        'ProofMark Evidence Pack — Client Hand-off Letter',
        '',
        `Title       : ${niceTitle}`,
        `Issued at   : ${issuedAt}`,
        `SHA-256     : ${sha256}`,
        `Verify URL  : ${verifyUrl}`,
        '',
        'About this Evidence Pack',
        '------------------------',
        'This package contains the cryptographic timestamp data and verification scripts',
        'required to independently confirm that the file with the SHA-256 above existed',
        'at the issued time and has not been modified since.',
        inclusionLine,
        '',
        'How to verify (no ProofMark account required)',
        '----------------------------------------------',
        ...verifySteps,
        '',
        'Notes',
        '-----',
        "ProofMark issues RFC3161-compliant timestamp data. Whether such data is",
        'admissible as evidence depends on the venue, jurisdiction, and TSA in use.',
        'See https://proofmark.jp/trust-center for the current TSA configuration.',
    ].filter((line) => line !== '').join('\n');
}

function buildSpotClientLetter(legalGuideIncluded: boolean): string {
    const head = 'ProofMark Spot Evidence Pack\n\nThis archive contains the cryptographic timestamp data required to independently confirm the existence of your file. Keep it safe.';
    return legalGuideIncluded
        ? `${head}\nA legal context PDF is bundled under /legal_guide/.`
        : head;
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

interface ManagedStream {
    stream: Readable;
    abort: () => void;
}

async function streamSupabaseFile(
    admin: any,
    bucket: string,
    path: string,
): Promise<ManagedStream> {
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data) throw new Error(`Failed to sign URL for ${path}: ${error?.message}`);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error('stream_timeout')), STREAM_FETCH_TIMEOUT_MS);

    let fetchRes: Response;
    try {
        fetchRes = await fetch(data.signedUrl, { signal: ac.signal });
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
    if (!fetchRes.ok || !fetchRes.body) {
        clearTimeout(timer);
        ac.abort();
        throw new Error(`Failed to fetch stream for ${path}: ${fetchRes.statusText}`);
    }

    const node = Readable.fromWeb(fetchRes.body as any);
    node.once('end', () => clearTimeout(timer));
    node.once('error', () => clearTimeout(timer));
    node.once('close', () => clearTimeout(timer));

    return {
        stream: node,
        abort: () => {
            try { ac.abort(); } catch { /* noop */ }
            try { node.destroy(); } catch { /* noop */ }
            clearTimeout(timer);
        },
    };
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const log = makeLogger('generate-evidence-pack');
    res.setHeader('x-request-id', log.ctx.reqId);

    if (!methodGuard(req, res, ['GET'])) return;

    // --- Rate Limit Check ---
    if (ratelimit) {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || '127.0.0.1';
        try {
            const { success } = await ratelimit.limit(ip);
            if (!success) {
                log.warn({ event: 'ratelimit_exceeded', ip });
                fail(res, 429, 'Too many requests');
                return;
            }
        } catch (limitError) {
            // Fail-open: Redis障害時はクラッシュさせず通過させる
            log.error({ event: 'ratelimit_error', message: String(limitError) });
        }
    }

    const upstreamStreams: ManagedStream[] = [];

    try {
        const certParam = (req.query.cert as string | undefined) ?? '';
        const spotSession = (req.query.spot as string | undefined) ?? '';
        const stagingId = (req.query.staging as string | undefined) ?? '';

        if (!certParam && !spotSession) throw new HttpError(400, 'cert or spot is required');

        const admin = getAdminClient();
        let cert: CertRecord | null = null;
        let downloadKind: 'auth' | 'spot' = 'auth';
        let spotOrder: SpotOrderRecord | null = null;
        let evidencePackName = 'proofmark-evidence-pack.zip';

        if (certParam) {
            if (!UUID.test(certParam)) throw new HttpError(400, 'cert must be a UUID');
            const user = await tryUser(req);

            const { data, error } = await admin
                .from('certificates')
                .select('id, user_id, title, sha256, proof_mode, visibility, public_image_url, storage_path, original_filename, file_name, certified_at, proven_at, created_at, timestamp_token, tsa_provider, tsa_url, team_id, c2pa_manifest')
                .eq('id', certParam)
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new HttpError(404, 'Certificate not found');
            const visibility = data.visibility ?? 'private';

            const isPublic = visibility === 'public' || visibility === 'unlisted';
            let isAuthorized = isPublic || (!!user && user.id === data.user_id);
            if (!isAuthorized && !!user && data.team_id) {
                const { data: member } = await admin
                    .from('team_members')
                    .select('role')
                    .eq('team_id', data.team_id)
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (member) isAuthorized = true;
            }
            if (!isAuthorized) throw new HttpError(403, 'Not authorized');

            // --- Plan Tier Check (Monetization Guard) ---
            if (data.user_id) {
                const { data: profile } = await admin
                    .from('profiles')
                    .select('plan_tier')
                    .eq('id', data.user_id)
                    .maybeSingle();

                if (!profile || profile.plan_tier === 'free') {
                    log.warn({ event: 'plan_block', userId: data.user_id, certId: data.id });
                    throw new HttpError(403, 'Evidence Pack generation requires Creator plan or higher');
                }
            }
            // --------------------------------------------

            cert = data as CertRecord;
            evidencePackName = `evidence-pack-${(cert.id || 'cert').slice(0, 8)}.zip`;
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

        // Stream ZIP — backpressure aware
        res.status(200);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${evidencePackName}"`);
        res.setHeader('Cache-Control', 'private, no-store');

        const archive = archiver('zip', {
            zlib: { level: 6 },
            forceLocalTime: false,
        });

        const cleanupUpstreams = () => {
            for (const s of upstreamStreams) {
                try { s.abort(); } catch { /* noop */ }
            }
        };

        archive.on('warning', (err) => log.warn({ event: 'archiver.warning', message: err.message }));

        // クライアント切断 → upstream を即座に解放
        res.on('close', () => {
            if (!res.writableEnded) {
                log.warn({ event: 'evidence-pack.client_disconnect' });
                cleanupUpstreams();
                try { archive.abort(); } catch { /* noop */ }
            }
        });

        // pipeline で archiver→res を結ぶ。drain / error / cleanup を Node に
        // 任せる (Phase 12.4 罠3 への回答)。pipeline の戻り Promise は最後に
        // await する。
        const pipelineDone = pipeline(archive, res).catch((err) => {
            log.error({ event: 'pipeline.error', message: String((err as Error)?.message ?? err) });
            cleanupUpstreams();
            // headersSent の場合は何もできない (res は破棄)
        });

        if (downloadKind === 'auth' && cert) {
            const sha256 = cert.sha256 ?? '';
            const verifyUrl = `https://proofmark.jp/cert/${cert.id}`;
            const baseFile = safeFilename(cert.original_filename ?? cert.file_name, 'asset.bin');

            const c2paBlob = safeC2paJson(cert.c2pa_manifest);
            const c2paIncluded = c2paBlob !== null;

            // chain_of_evidence.json (Phase 12.4)
            let chainBuffer: Buffer | null = null;
            try {
                chainBuffer = await buildChainOfEvidence(admin, cert.id, { log });
                if (chainBuffer.byteLength > 1 * 1024 * 1024) {
                    // Audit chain は通常 数十KB ですが、念のためソフト上限
                    log.warn({ event: 'chain.size_warn', bytes: chainBuffer.byteLength });
                }
            } catch (err) {
                log.warn({ event: 'chain.build_failed', message: String((err as Error)?.message ?? err) });
                chainBuffer = null;
            }
            const chainIncluded = chainBuffer !== null && chainBuffer.byteLength > 0;

            // Legal guide PDF (Phase 12.4) — CDN 経由でグローバルキャッシュから取得
            const legalPdf = await getLegalCopyrightPdf(log);
            const legalGuideIncluded = legalPdf !== null;

            archive.append(`SHA256= ${sha256}\n`, { name: 'hash.txt', date: FIXED_ZIP_TIME });

            if (cert.timestamp_token) {
                const tsr = Buffer.from(cert.timestamp_token, 'base64');
                archive.append(tsr, { name: 'timestamp.tsr', date: FIXED_ZIP_TIME });
            } else {
                archive.append('Timestamp token is not yet issued for this certificate.\n', {
                    name: 'timestamp.MISSING.txt',
                    date: FIXED_ZIP_TIME,
                });
            }

            archive.append(
                buildClientLetter(cert, verifyUrl, { c2paIncluded, chainIncluded, legalGuideIncluded }),
                { name: 'CLIENT_LETTER.txt', date: FIXED_ZIP_TIME },
            );

            if (c2paBlob) {
                archive.append(c2paBlob.json, { name: 'c2pa.json', date: FIXED_ZIP_TIME });
                log.info({ event: 'evidence-pack.c2pa_attached', bytes: c2paBlob.bytes });
            }

            if (chainBuffer) {
                archive.append(chainBuffer, { name: 'chain_of_evidence.json', date: FIXED_ZIP_TIME });
                log.info({ event: 'evidence-pack.chain_attached', bytes: chainBuffer.byteLength });
            }

            if (legalPdf) {
                archive.append(legalPdf.buffer, {
                    name: 'legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf',
                    date: FIXED_ZIP_TIME,
                });
                log.info({ event: 'evidence-pack.legal_guide_attached', bytes: legalPdf.bytes });
            } else {
                archive.append(
                    'ProofMark_Legal_and_Compliance_Guide.pdf could not be embedded in this archive.\n' +
                    'Please refer to https://proofmark.jp/legal-guide for the latest legal context.\n',
                    { name: 'legal_guide/README.txt', date: FIXED_ZIP_TIME },
                );
            }

            archive.append(buildVerifyShellScript(), { name: 'verify.sh', date: FIXED_ZIP_TIME, mode: 0o755 });
            archive.append(buildVerifyPython(), { name: 'verify.py', date: FIXED_ZIP_TIME, mode: 0o755 });

            const meta = {
                certificate_id: cert.id,
                title: cert.title ?? null,
                sha256,
                proof_mode: cert.proof_mode,
                visibility: cert.visibility,
                certified_at: cert.certified_at,
                proven_at: cert.proven_at,
                created_at: cert.created_at,
                tsa_provider: cert.tsa_provider,
                tsa_url: cert.tsa_url,
                verify_url: verifyUrl,
                c2pa_present: c2paIncluded,
                c2pa_bytes: c2paBlob?.bytes ?? 0,
                chain_present: chainIncluded,
                legal_guide_present: legalGuideIncluded,
            };
            archive.append(JSON.stringify(meta, null, 2), { name: 'metadata.json', date: FIXED_ZIP_TIME });

            // 原画 (shareable のみ) — ストリーム結合
            if (cert.proof_mode === 'shareable' && cert.storage_path) {
                try {
                    const managed = await streamSupabaseFile(admin, 'proofmark-originals', cert.storage_path);
                    upstreamStreams.push(managed);
                    archive.append(managed.stream, { name: `original/${baseFile}`, date: FIXED_ZIP_TIME });
                } catch (err) {
                    log.warn({
                        event: 'auth.original_stream_failed',
                        path: cert.storage_path,
                        message: String((err as Error)?.message ?? err),
                    });
                    archive.append(
                        'Original file could not be streamed at archive time.\n',
                        { name: `original/${baseFile}.MISSING.txt`, date: FIXED_ZIP_TIME },
                    );
                }
            }

            // FreeTSA CA (キャッシュ済み)
            const caBundle = await fetchTsaCa();
            if (caBundle) {
                archive.append(caBundle.ca, { name: 'freetsa-ca.crt', date: FIXED_ZIP_TIME });
                archive.append(caBundle.tsa, { name: 'freetsa-tsa.crt', date: FIXED_ZIP_TIME });
            } else {
                archive.append(
                    'CA/TSA certificates could not be embedded automatically.\nPlease download from https://freetsa.org/files/ before running verify.sh.\n',
                    { name: 'freetsa.README.txt', date: FIXED_ZIP_TIME },
                );
            }
        } else if (downloadKind === 'spot' && spotOrder) {
            const sha256 = spotOrder.sha256 ?? '';
            const verifyUrl = `https://proofmark.jp/spot-issue/result?sid=${spotOrder.stripe_session_id}`;

            // Spot は監査ログ・C2PA を持たないが、Legal Guide PDF だけは同梱できる
            const legalPdf = await getLegalCopyrightPdf(log);
            const legalGuideIncluded = legalPdf !== null;

            archive.append(buildSpotClientLetter(legalGuideIncluded), {
                name: 'CLIENT_LETTER.txt', date: FIXED_ZIP_TIME,
            });
            archive.append(buildVerifyShellScript(), { name: 'verify.sh', date: FIXED_ZIP_TIME, mode: 0o755 });
            archive.append(buildVerifyPython(), { name: 'verify.py', date: FIXED_ZIP_TIME, mode: 0o755 });
            archive.append(`SHA256= ${sha256}\n`, { name: 'hash.txt', date: FIXED_ZIP_TIME });

            archive.append(
                JSON.stringify(
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
                { name: 'metadata.json', date: FIXED_ZIP_TIME },
            );

            if (legalPdf) {
                archive.append(legalPdf.buffer, {
                    name: 'legal_guide/ProofMark_Legal_and_Compliance_Guide.pdf',
                    date: FIXED_ZIP_TIME,
                });
                log.info({ event: 'evidence-pack.legal_guide_attached', kind: 'spot', bytes: legalPdf.bytes });
            }

            try {
                const managed = await streamSupabaseFile(
                    admin, 'spot-evidence', `${spotOrder.staging_id}/timestamp.tsr`,
                );
                upstreamStreams.push(managed);
                archive.append(managed.stream, { name: 'timestamp.tsr', date: FIXED_ZIP_TIME });
            } catch (err) {
                log.warn({
                    event: 'spot.tsr_missing',
                    stagingId: spotOrder.staging_id,
                    message: String((err as Error)?.message ?? err),
                });
                archive.append(
                    'Timestamp token (timestamp.tsr) could not be retrieved.\nPlease re-run the Spot verification step or contact support.\n',
                    { name: 'timestamp.MISSING.txt', date: FIXED_ZIP_TIME },
                );
            }

            const caBundle = await fetchTsaCa();
            if (caBundle) {
                archive.append(caBundle.ca, { name: 'freetsa-ca.crt', date: FIXED_ZIP_TIME });
                archive.append(caBundle.tsa, { name: 'freetsa-tsa.crt', date: FIXED_ZIP_TIME });
            }
        }

        await archive.finalize();
        await pipelineDone;

        log.info({
            event: 'evidence-pack.streamed',
            kind: downloadKind,
            certId: cert?.id ?? null,
            stagingId: spotOrder?.staging_id ?? null,
        });
    } catch (err) {
        for (const s of upstreamStreams) {
            try { s.abort(); } catch { /* noop */ }
        }
        if (err instanceof HttpError) {
            fail(res, err.status, err.message);
            return;
        }
        log.error({ event: 'evidence-pack.error', message: String((err as Error)?.message ?? err) });
        fail(res, 500, 'Internal error');
    }
}
