/**
 * GET /api/generate-evidence-pack?cert=<UUID>
 *      OR
 * GET /api/generate-evidence-pack?spot=<sessionId>&staging=<uuid>
 *
 * Streams a ZIP of the Evidence Pack so we never buffer the whole archive in memory.
 * - Authenticated cert flow: only owner OR public/unlisted certs are downloadable.
 *   Light/Creator/Studio plans get the full Evidence Pack; Free plan gets a hash-only summary.
 * - Spot guest flow: requires a paid spot_orders row. Once issued, the Evidence Pack
 *   is generated on-demand and never stored long-term (cleanup-spot-data deletes after 24h).
 *
 * Memory:
 *   We pipe `archiver` directly to `res`. Big files (originals up to a few MB) are
 *   pulled from Supabase Storage as a Web ReadableStream and converted to a Node
 *   Readable stream, then `archive.append(stream, { name, date })`. The DOSTime
 *   inside the ZIP is fixed (`FIXED_ZIP_TIME`) so CDN caches stay deterministic.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import archiver from 'archiver';
import { Readable } from 'node:stream';
import {
    HttpError,
    getAdminClient,
    json,
    makeLogger,
    methodGuard,
    tryUser,
} from './_lib/server.js';

// Vercel Node Function — increase memory & duration only if your plan allows it.
export const config = { maxDuration: 60 };

// Fixed timestamp for ZIP entries → stable CDN cache key.
const FIXED_ZIP_TIME = new Date('2026-01-01T00:00:00.000Z');

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

function buildClientLetter(cert: CertRecord, verifyUrl: string): string {
    const issuedAt = cert.certified_at ?? cert.proven_at ?? cert.created_at ?? '';
    const niceTitle = cert.title ?? cert.original_filename ?? cert.file_name ?? 'Verified Digital Artwork';
    const sha256 = cert.sha256 ?? '';
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
        '',
        'How to verify (no ProofMark account required)',
        '----------------------------------------------',
        '1. Compute SHA-256 of the supplied file and ensure it matches "SHA-256" above.',
        '2. Run `verify.sh` (or `verify.py`) inside this archive to verify the RFC3161',
        '   timestamp token (timestamp.tsr) using OpenSSL.',
        '3. Optionally open Verify URL to compare against the public certificate page.',
        '',
        'Notes',
        '-----',
        "ProofMark issues RFC3161-compliant timestamp data. Whether such data is",
        'admissible as evidence depends on the venue, jurisdiction, and TSA in use.',
        'See https://proofmark.jp/trust-center for the current TSA configuration.',
    ].join('\n');
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
        '# Provide the original file as the first argument and verify both file integrity and TST.',
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
        'import sys, hashlib, base64, subprocess, pathlib',
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

async function fetchTsaCa(): Promise<{ ca: Buffer; tsa: Buffer } | null> {
    // Optional best-effort fetch of FreeTSA CA bundle so the customer can verify offline.
    try {
        const [ca, tsa] = await Promise.all([
            fetch('https://freetsa.org/files/cacert.pem', { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.arrayBuffer() : null),
            fetch('https://freetsa.org/files/tsa.crt', { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.arrayBuffer() : null),
        ]);
        if (!ca || !tsa) return null;
        return { ca: Buffer.from(ca), tsa: Buffer.from(tsa) };
    } catch {
        return null;
    }
}

async function streamSupabaseFile(admin: any, bucket: string, path: string): Promise<Readable> {
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) throw new Error(`Failed to sign URL for ${path}: ${error?.message}`);

  const fetchRes = await fetch(data.signedUrl);
  if (!fetchRes.ok || !fetchRes.body) throw new Error(`Failed to fetch stream for ${path}: ${fetchRes.statusText}`);

  return Readable.fromWeb(fetchRes.body as any);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const log = makeLogger('generate-evidence-pack');
    res.setHeader('x-request-id', log.ctx.reqId);

    if (!methodGuard(req, res, ['GET'])) return;

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
                .select('id, user_id, title, sha256, proof_mode, visibility, public_image_url, storage_path, original_filename, file_name, certified_at, proven_at, created_at, timestamp_token, tsa_provider, tsa_url, team_id')
                .eq('id', certParam)
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new HttpError(404, 'Certificate not found');
            const visibility = data.visibility ?? 'private';

            // Authorization: owner OR public/unlisted OR team member
            const isPublic = visibility === 'public' || visibility === 'unlisted';
            let isAuthorized = isPublic || (!!user && user.id === data.user_id);
            if (!isAuthorized && !!user && data.team_id) {
                const { data: member } = await admin.from('team_members').select('role').eq('team_id', data.team_id).eq('user_id', user.id).maybeSingle();
                if (member) isAuthorized = true;
            }
            if (!isAuthorized) throw new HttpError(403, 'Not authorized');

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

        // Stream ZIP
        res.status(200);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${evidencePackName}"`);
        res.setHeader('Cache-Control', 'private, no-store');

        const archive = archiver('zip', { zlib: { level: 6 }, forceLocalTime: false });
        archive.on('warning', (err) => log.warn({ event: 'archiver.warning', message: err.message }));
        archive.on('error', (err) => {
            log.error({ event: 'archiver.error', message: err.message });
            if (!res.headersSent) {
                res.status(500).send('Archive error');
            }
        });
        archive.pipe(res);

        if (downloadKind === 'auth' && cert) {
            const sha256 = cert.sha256 ?? '';
            const verifyUrl = `https://proofmark.jp/cert/${cert.id}`;
            const baseFile = safeFilename(cert.original_filename ?? cert.file_name, 'asset.bin');

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

            archive.append(buildClientLetter(cert, verifyUrl), { name: 'CLIENT_LETTER.txt', date: FIXED_ZIP_TIME });
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
            };
            archive.append(JSON.stringify(meta, null, 2), { name: 'metadata.json', date: FIXED_ZIP_TIME });

            // Optional: original file (only if shareable + storage_path exists).
            if (cert.proof_mode === 'shareable' && cert.storage_path) {
                const stream = await streamSupabaseFile(admin, 'proofmark-originals', cert.storage_path);
                if (stream) archive.append(stream, { name: `original/${baseFile}`, date: FIXED_ZIP_TIME });
            }

            // Optional: FreeTSA CA bundle for offline verification.
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

            archive.append('ProofMark Spot Evidence Pack\n\nThis archive contains the cryptographic timestamp data required to independently confirm the existence of your file. Keep it safe.', { name: 'CLIENT_LETTER.txt', date: FIXED_ZIP_TIME });
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
                    },
                    null,
                    2,
                ),
                { name: 'metadata.json', date: FIXED_ZIP_TIME },
            );

            try {
                const tsrStream = await streamSupabaseFile(admin, 'spot-evidence', `${spotOrder.staging_id}/timestamp.tsr`);
                archive.append(tsrStream, { name: 'timestamp.tsr', date: FIXED_ZIP_TIME });
            } catch (err) {
                log.warn({ event: 'spot.tsr_missing', stagingId: spotOrder.staging_id });
            }

            const caBundle = await fetchTsaCa();
            if (caBundle) {
                archive.append(caBundle.ca, { name: 'freetsa-ca.crt', date: FIXED_ZIP_TIME });
                archive.append(caBundle.tsa, { name: 'freetsa-tsa.crt', date: FIXED_ZIP_TIME });
            }
        }

        await archive.finalize();
        log.info({ event: 'evidence-pack.streamed', kind: downloadKind, certId: cert?.id ?? null, stagingId: spotOrder?.staging_id ?? null });
    } catch (err) {
        if (err instanceof HttpError) {
            fail(res, err.status, err.message);
            return;
        }
        log.error({ event: 'evidence-pack.error', message: String((err as Error)?.message ?? err) });
        fail(res, 500, 'Internal error');
    }
}
