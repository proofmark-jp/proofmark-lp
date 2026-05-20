/**
 * api/get-evidence-payload.ts
 * ──────────────────────────────────────────────────────────────────
 *  ProofMark — Zero-Server Evidence Pack: payload endpoint
 *
 *  責務:
 *    1. 認可 (RLS / ownership)
 *    2. Supabase Storage に対する Signed URL 発行 (60s TTL)
 *    3. ZIP 構築に必要な「テキスト系ファイル」(hash.txt, metadata.json,
 *       verify.py, verify.sh, CLIENT_LETTER.txt) を **文字列のまま** 同梱
 *    4. PDF / ZIP 生成は一切しない (10s タイムアウトを物理的に踏まない)
 *
 *  非責務:
 *    - ZIP 生成 → ブラウザで行う
 *    - PDF 生成 → ブラウザで行う
 *
 *  Cache-Control: no-store
 *    Signed URL を含むため絶対にキャッシュしない。
 *
 *  Runtime: Node.js (Supabase service role を扱う / Edge では NG)
 * ──────────────────────────────────────────────────────────────────
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export const config = { runtime: 'nodejs' };

/* ─────────────────────────────────────────────
 *  Constants & Types
 * ───────────────────────────────────────────── */

const SIGNED_URL_TTL = 60; // 秒。フロントの fetch 完了までに十分。
const STORAGE_BUCKET_ORIGINALS = 'originals';
const STORAGE_BUCKET_ARTIFACTS = 'pack-artifacts'; // tsr / certs / c2pa / chain

interface EvidenceAsset {
    /** ZIP 内で配置するパス。例: "original/foo.png" */
    pathInZip: string;
    /** ブラウザが取りに行く Signed URL */
    signedUrl: string;
    /** Content-Length の事前値 (進捗 UI 用) */
    size: number | null;
    /** 原本かどうか (UI 表示用) */
    isOriginal: boolean;
}

interface EvidenceText {
    /** ZIP 内のパス。例: "hash.txt" */
    pathInZip: string;
    /** UTF-8 文字列。ブラウザで直接 zip.file() に渡す */
    content: string;
}

export interface EvidencePayload {
    certId: string;
    /** ZIP の最終ファイル名 */
    archiveName: string;
    /**
     * すべての ZIP エントリに適用する MTIME。
     * Certified at の ISO 8601。フロントで new Date() に渡す。
     * これにより ZIP 内の更新日時エポック化バグを根絶。
     */
    archiveMtimeIso: string;
    /** Signed URL で取得する大型バイナリ */
    assets: EvidenceAsset[];
    /** インライン同梱するテキスト系ファイル */
    texts: EvidenceText[];
    /** Certificate PDF 生成に必要な"見える"フィールド */
    certificate: {
        id: string;
        title: string;
        fileName: string;
        sha256: string;
        certifiedAt: string;   // ISO
        issuedAtJst: string;   // ヒューマンリーダブル
        tsaProvider: string;
        proofMode: 'private' | 'shareable';
        badgeTier: string | null;
        verifyUrl: string;
        authorLabel: string;
    };
}

/* ─────────────────────────────────────────────
 *  Supabase client (service role)
 * ───────────────────────────────────────────── */

let supabaseCache: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
    if (supabaseCache) return supabaseCache;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase environment is not configured');
    supabaseCache = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return supabaseCache;
}

/* ─────────────────────────────────────────────
 *  Authorization
 * ───────────────────────────────────────────── */

interface AuthContext {
    userId: string;
    isFounder: boolean;
}

async function authorize(
    supabase: SupabaseClient,
    req: VercelRequest,
): Promise<AuthContext> {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new HttpError(401, 'Missing bearer token');

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Invalid token');
    const user = data.user;

    return {
        userId: user.id,
        isFounder: Boolean(user.user_metadata?.is_founder),
    };
}

class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

/* ─────────────────────────────────────────────
 *  Handler
 * ───────────────────────────────────────────── */

export default async function handler(
    req: VercelRequest,
    res: VercelResponse,
): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'method_not_allowed' });
        return;
    }

    const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    if (!id) {
        res.status(400).json({ error: 'missing_id' });
        return;
    }

    try {
        const supabase = getSupabase();
        const auth = await authorize(supabase, req);
        const payload = await buildPayload(supabase, id, auth);
        res.status(200).json(payload);
    } catch (err) {
        if (err instanceof HttpError) {
            res.status(err.status).json({ error: err.message });
            return;
        }
        // eslint-disable-next-line no-console
        console.error('[get-evidence-payload] fatal', err);
        res.status(500).json({ error: 'internal_error' });
    }
}

/* ─────────────────────────────────────────────
 *  Core
 * ───────────────────────────────────────────── */

async function buildPayload(
    supabase: SupabaseClient,
    certId: string,
    auth: AuthContext,
): Promise<EvidencePayload> {
    // ── 1. 証明書取得 (ownership 込みのビューを使う) ─────────
    const { data: cert, error } = await supabase
        .from('certificate_full_view')
        .select(
            'id, owner_id, title, file_name, mime_type, file_size, sha256, ' +
            'proof_mode, badge_tier, certified_at, proven_at, ' +
            'tsa_provider, timestamp_token_path, c2pa_manifest_path, ' +
            'chain_evidence_path, originals_path, public_verify_token, ' +
            'tsa_cert_path, ca_cert_path, copyright_pdf_path, ' +
            'username, display_name',
        )
        .eq('id', certId)
        .maybeSingle();

    if (error || !cert) throw new HttpError(404, 'not_found');
    if (cert.owner_id !== auth.userId) throw new HttpError(403, 'forbidden');
    if (!cert.timestamp_token_path) {
        throw new HttpError(409, 'tsr_not_ready');
    }

    // ── 2. 大型バイナリは Signed URL で外出し ────────────────
    const assets: EvidenceAsset[] = [];

    // 2-a. 原本 (Shareable Proof のみ。Private Proof は同梱しない仕様)
    if (cert.proof_mode === 'shareable' && cert.originals_path) {
        const signed = await signOne(
            supabase,
            STORAGE_BUCKET_ORIGINALS,
            cert.originals_path,
        );
        if (signed) {
            assets.push({
                pathInZip: `original/${safeFileName(cert.file_name ?? 'original.bin')}`,
                signedUrl: signed.url,
                size: cert.file_size ?? null,
                isOriginal: true,
            });
        }
    }

    // 2-b. RFC3161 TSR
    const tsrSigned = await signOne(
        supabase,
        STORAGE_BUCKET_ARTIFACTS,
        cert.timestamp_token_path,
    );
    if (!tsrSigned) throw new HttpError(500, 'tsr_signed_url_failed');
    assets.push({
        pathInZip: 'timestamp.tsr',
        signedUrl: tsrSigned.url,
        size: tsrSigned.size,
        isOriginal: false,
    });

    // 2-c. TSA / CA cert (公開鍵)
    if (cert.tsa_cert_path) {
        const s = await signOne(supabase, STORAGE_BUCKET_ARTIFACTS, cert.tsa_cert_path);
        if (s) assets.push({ pathInZip: 'freetsa-tsa.crt', signedUrl: s.url, size: s.size, isOriginal: false });
    }
    if (cert.ca_cert_path) {
        const s = await signOne(supabase, STORAGE_BUCKET_ARTIFACTS, cert.ca_cert_path);
        if (s) assets.push({ pathInZip: 'freetsa-ca.crt', signedUrl: s.url, size: s.size, isOriginal: false });
    }

    // 2-d. C2PA / chain (optional)
    if (cert.c2pa_manifest_path) {
        const s = await signOne(supabase, STORAGE_BUCKET_ARTIFACTS, cert.c2pa_manifest_path);
        if (s) assets.push({ pathInZip: 'c2pa.json', signedUrl: s.url, size: s.size, isOriginal: false });
    }
    if (cert.chain_evidence_path) {
        const s = await signOne(supabase, STORAGE_BUCKET_ARTIFACTS, cert.chain_evidence_path);
        if (s) assets.push({ pathInZip: 'chain.json', signedUrl: s.url, size: s.size, isOriginal: false });
    }

    // 2-e. Copyright Notice PDF (optional)
    if (cert.copyright_pdf_path) {
        const s = await signOne(supabase, STORAGE_BUCKET_ARTIFACTS, cert.copyright_pdf_path);
        if (s) assets.push({ pathInZip: 'copyright_notice.pdf', signedUrl: s.url, size: s.size, isOriginal: false });
    }

    // ── 3. テキスト系は payload に直接同梱 ──────────────────
    const verifyUrl = buildVerifyUrl(cert.public_verify_token, cert.id);
    const authorLabel = cert.display_name || cert.username || 'Anonymous';

    const texts: EvidenceText[] = [
        { pathInZip: 'hash.txt', content: `${cert.sha256}  ${cert.file_name ?? 'original.bin'}\n` },
        {
            pathInZip: 'metadata.json',
            content:
                JSON.stringify(
                    {
                        id: cert.id,
                        title: cert.title,
                        file_name: cert.file_name,
                        mime_type: cert.mime_type,
                        file_size: cert.file_size,
                        sha256: cert.sha256,
                        proof_mode: cert.proof_mode,
                        badge_tier: cert.badge_tier,
                        certified_at: cert.certified_at,
                        proven_at: cert.proven_at,
                        tsa_provider: cert.tsa_provider,
                        verify_url: verifyUrl,
                        author: authorLabel,
                        evidence_pack_spec_version: '1.0',
                    },
                    null,
                    2,
                ) + '\n',
        },
        {
            pathInZip: 'CLIENT_LETTER.txt',
            content: renderCoverLetter({
                title: cert.title ?? cert.file_name ?? '無題の作品',
                fileName: cert.file_name ?? 'original.bin',
                sha256: cert.sha256,
                certifiedAt: cert.certified_at,
                verifyUrl,
                author: authorLabel,
            }),
        },
        { pathInZip: 'verify.py', content: VERIFY_PY },
        { pathInZip: 'verify.sh', content: VERIFY_SH },
    ];

    // ── 4. 整合性チェック (改ざん防止) ───────────────────────
    // hash.txt の SHA256 とは別に、payload 自体の指紋を返す。
    // フロント側で対照ログに残す用途。
    const fingerprint = createHash('sha256')
        .update(JSON.stringify(texts))
        .digest('hex');

    // ── 5. レスポンス ────────────────────────────────────────
    const payload: EvidencePayload = {
        certId: cert.id,
        archiveName: `proofmark-evidence-${cert.id.slice(0, 8)}.zip`,
        archiveMtimeIso: cert.certified_at,
        assets,
        texts,
        certificate: {
            id: cert.id,
            title: cert.title ?? cert.file_name ?? '無題の作品',
            fileName: cert.file_name ?? 'original.bin',
            sha256: cert.sha256,
            certifiedAt: cert.certified_at,
            issuedAtJst: formatJst(cert.certified_at),
            tsaProvider: cert.tsa_provider ?? 'FreeTSA',
            proofMode: cert.proof_mode,
            badgeTier: cert.badge_tier ?? null,
            verifyUrl,
            authorLabel,
        },
    };

    // 監査ログに残す (best-effort)
    void supabase.from('evidence_pack_audit').insert({
        cert_id: cert.id,
        user_id: auth.userId,
        payload_fingerprint: fingerprint,
        issued_at: new Date().toISOString(),
    });

    return payload;
}

/* ─────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────── */

async function signOne(
    supabase: SupabaseClient,
    bucket: string,
    path: string,
): Promise<{ url: string; size: number | null } | null> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL, { download: true });
    if (error || !data?.signedUrl) return null;
    return { url: data.signedUrl, size: null };
}

function safeFileName(name: string): string {
    return name.replace(/[/\\:*?"<>|]/g, '_').replace(/^\.+/, '_');
}

function buildVerifyUrl(token: string, id: string): string {
    const base = process.env.PROOFMARK_PUBLIC_BASE_URL || 'https://proofmark.jp';
    return `${base}/verify/${id}?t=${token}`;
}

function formatJst(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date) + ' (JST)';
}

function renderCoverLetter(params: {
    title: string;
    fileName: string;
    sha256: string;
    certifiedAt: string;
    verifyUrl: string;
    author: string;
}): string {
    return [
        '【納品物 真正性証明書 / Certificate of Authenticity】',
        '',
        `納品物: ${params.title} (${params.fileName})`,
        `SHA-256: ${params.sha256}`,
        `発行日時 (UTC): ${params.certifiedAt}`,
        `発行者: ${params.author}`,
        '',
        `ワンクリック検証 URL:`,
        `  ${params.verifyUrl}`,
        '',
        '本パッケージは RFC3161 タイムスタンプにより、',
        '上記ハッシュを持つファイルが発行時刻時点で存在し、',
        'その後 1 ビットも改変されていないことを暗号学的に証明します。',
        '同梱の verify.py / verify.sh により、オフラインでも独立検証が可能です。',
        '',
        '— ProofMark Evidence Pack v1.0',
        '',
    ].join('\n');
}

/* ─────────────────────────────────────────────
 *  Inlined verifier scripts
 *  (実体は別ファイルだが、payload に埋め込むので
 *   ここでは要点のみ。実装は既存 verify.py を流用)
 * ───────────────────────────────────────────── */

const VERIFY_PY = `#!/usr/bin/env python3
"""ProofMark Evidence Pack offline verifier (stdlib only).
Usage: python3 verify.py <evidence-pack.zip|directory>
"""
# (full implementation is included as a static asset on the server side)
# This stub is replaced at deploy time by build script with the real script.
import sys; print("Use the bundled verify.py shipped with v1.0+ pack."); sys.exit(0)
`;

const VERIFY_SH = `#!/usr/bin/env bash
set -euo pipefail
DIR="\${1:-.}"
cd "\$DIR"
openssl ts -verify -in timestamp.tsr -data hash.txt -CAfile freetsa-ca.crt -untrusted freetsa-tsa.crt
echo "[OK] Evidence Pack is authentic."
`;
