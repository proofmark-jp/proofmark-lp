/**
 * api/_lib/legal-pdf-cache.ts
 *
 * Supabase Storage の public バケットに配置された法的ガイドPDFを、
 * Supabase SDK を用いて安全に取得し、メモリにキャッシュする。
 * URLエンコード問題やCDNのキャッシュ罠を完全に回避する堅牢版。
 */

import { getAdminClient } from './server.js';

const TTL_MS = 6 * 60 * 60 * 1000;
const SOFT_SIZE_WARN_BYTES = 4 * 1024 * 1024; // 4MB を超えたら警告

interface PdfCacheEntry {
    buffer: Buffer;
    bytes: number;
    fetchedAt: number;
    expiresAt: number;
}

export interface LegalPdfRef {
    buffer: Buffer;
    bytes: number;
    fromCache: boolean;
}

// コールドスタート間で共有する in-memory キャッシュ
let pdfCache: PdfCacheEntry | null = null;
let pdfInflight: Promise<PdfCacheEntry | null> | null = null;

export async function getLegalCopyrightPdf(
    log?: { warn: (o: Record<string, unknown>) => void; info: (o: Record<string, unknown>) => void },
): Promise<LegalPdfRef | null> {
    
    // キャッシュが有効なら即座に返す
    if (pdfCache && pdfCache.expiresAt > Date.now()) {
        return { buffer: pdfCache.buffer, bytes: pdfCache.bytes, fromCache: true };
    }
    // 既に誰かがfetch中なら相乗りする
    if (pdfInflight) {
        const inflight = await pdfInflight;
        return inflight ? { buffer: inflight.buffer, bytes: inflight.bytes, fromCache: false } : null;
    }

    pdfInflight = (async () => {
        try {
            const admin = getAdminClient();
            
            // SDKを使用して安全にダウンロード（URLエンコード問題などを内部で解決）
            const { data, error } = await admin.storage
                .from('proofmark-public')
                .download('legal/ProofMark_Legal_and_Compliance_Guide.pdf');

            if (error || !data) {
                log?.warn({ event: 'legal_pdf.sdk_download_failed', message: error?.message });
                return null;
            }

            const arrayBuf = await data.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            const bytes = buffer.byteLength;

            // PDF magic %PDF- (25 50 44 46 2D) の検証（破損ファイル対策）
            const isPdf = buffer.length >= 5 &&
                buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 &&
                buffer[3] === 0x46 && buffer[4] === 0x2d;

            if (!isPdf) {
                log?.warn({ event: 'legal_pdf.not_pdf', bytes, head: buffer.subarray(0, 8).toString('hex') });
                return null;
            }

            if (bytes > SOFT_SIZE_WARN_BYTES) {
                log?.warn({ event: 'legal_pdf.soft_size_warn', bytes });
            }

            const entry: PdfCacheEntry = {
                buffer,
                bytes,
                fetchedAt: Date.now(),
                expiresAt: Date.now() + TTL_MS,
            };
            pdfCache = entry;
            log?.info({ event: 'legal_pdf.cached', bytes });
            return entry;
            
        } catch (err) {
            log?.warn({ event: 'legal_pdf.fetch_error', message: String((err as Error)?.message ?? err) });
            return null;
        } finally {
            pdfInflight = null;
        }
    })();

    const got = await pdfInflight;
    if (!got) return null;
    return { buffer: got.buffer, bytes: got.bytes, fromCache: false };
}

/** テスト/Cron 用に手動で破棄するエスケープハッチ。 */
export function resetLegalPdfCache(): void {
    pdfCache = null;
    pdfInflight = null;
}