/**
 * api/_lib/legal-pdf-cache.ts — Phase 12.4
 *
 * Supabase Storage の **public バケット** に静的配置された
 *   public-assets/legal/ai_copyright_guide.pdf
 * を、Vercel Function のグローバルスコープ (= コールドスタート間共有) に
 * Buffer でキャッシュする。
 *
 * 設計の核 (PRD 罠4 への対応):
 *   1. SDK (`supabase.storage.from(...).download()`) は使わず、CDN 直 URL を
 *      `fetch` する。エッジキャッシュが効き、TLS ハンドシェイクも 1 回。
 *   2. グローバルスコープ変数 `pdfCache` で in-memory キャッシュ (TTL 6h)。
 *      PDF が ~500KB を超える場合は警戒ログを出すだけで、キャッシュはする
 *      (Vercel Node の 1024MB に対して常識的なサイズ)。
 *   3. 失敗してもサービスは止めない。`null` を返し、呼び出し側 (Evidence
 *      Pack) は「README.txt」に降格する。
 *   4. 二重 fetch を避けるため in-flight Promise を共有する。
 *
 * ENV:
 *   LEGAL_GUIDE_PDF_URL  例: https://<proj>.supabase.co/storage/v1/object/public/public-assets/legal/ai_copyright_guide.pdf
 *   (未設定なら `null` を返してフォールバック)
 */

import { optionalEnv } from './server.js';

const TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const SOFT_SIZE_WARN_BYTES = 4 * 1024 * 1024; // 4MB を超えたら警告

interface PdfCacheEntry {
    buffer: Buffer;
    bytes: number;
    fetchedAt: number;
    expiresAt: number;
    sourceUrl: string;
}

// 関数間で共有 (Vercel Node のコールドスタートで最初の 1 回だけ fetch)
let pdfCache: PdfCacheEntry | null = null;
let pdfInflight: Promise<PdfCacheEntry | null> | null = null;

function isFresh(entry: PdfCacheEntry | null): boolean {
    return !!entry && entry.expiresAt > Date.now();
}

export interface LegalPdfRef {
    buffer: Buffer;
    bytes: number;
    sourceUrl: string;
    fromCache: boolean;
}

/**
 * 静的 PDF を Buffer で返す。失敗時は null。
 * 呼び出し側は `null` の場合に「README.txt」へ降格する。
 */
export async function getLegalCopyrightPdf(
    log?: { warn: (o: Record<string, unknown>) => void; info: (o: Record<string, unknown>) => void },
): Promise<LegalPdfRef | null> {
    let url = optionalEnv('LEGAL_GUIDE_PDF_URL');
    if (!url) return null;

    try {
        const parsedUrl = new URL(url);
        const encodedPath = parsedUrl.pathname
            .split('/')
            .map(segment => {
                const decoded = decodeURIComponent(segment);
                return encodeURIComponent(decoded)
                    .replace(/%20/g, '%20')
                    .replace(/&/g, '%26')
                    .replace(/%26/g, '%26');
            })
            .join('/');
        parsedUrl.pathname = encodedPath;
        url = parsedUrl.toString();
    } catch {
        url = url.replace(/ /g, '%20').replace(/&/g, '%26');
    }

    if (isFresh(pdfCache)) {
        return {
            buffer: pdfCache!.buffer,
            bytes: pdfCache!.bytes,
            sourceUrl: pdfCache!.sourceUrl,
            fromCache: true,
        };
    }
    if (pdfInflight) {
        const inflight = await pdfInflight;
        return inflight
            ? { buffer: inflight.buffer, bytes: inflight.bytes, sourceUrl: inflight.sourceUrl, fromCache: false }
            : null;
    }

    pdfInflight = (async () => {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(new Error('legal_pdf_timeout')), FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(url, {
                signal: ac.signal,
                headers: { Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.1' },
            });
            if (!res.ok) {
                log?.warn({ event: 'legal_pdf.fetch_failed', status: res.status, url });
                return null;
            }
            const arrayBuf = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            const bytes = buffer.byteLength;
            // PDF magic %PDF- (25 50 44 46 2D)
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
                sourceUrl: url,
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
            clearTimeout(timer);
            pdfInflight = null;
        }
    })();

    const got = await pdfInflight;
    if (!got) return null;
    return { buffer: got.buffer, bytes: got.bytes, sourceUrl: got.sourceUrl, fromCache: false };
}

/** テスト/Cron 用に手動で破棄するエスケープハッチ。 */
export function resetLegalPdfCache(): void {
    pdfCache = null;
    pdfInflight = null;
}
