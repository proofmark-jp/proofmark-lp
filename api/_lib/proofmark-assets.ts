/**
 * api/_lib/proofmark-assets.ts
 *
 * - Satori が必要とする日本語フォント (Noto Sans JP) をローカルのファイルシステムから
 *   同期的に読み込み、Lambda 寿命中はメモリキャッシュ。
 * - Bufferのメモリ共有汚染を防ぐため、厳格にArrayBufferへキャストする。
 */
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';

export interface FontCache {
    regular: ArrayBuffer;
    bold: ArrayBuffer;
}

let fontCache: FontCache | null = null;

export async function loadProofmarkFonts(): Promise<FontCache> {
    if (fontCache !== null) return fontCache;

    let regularBuffer: ArrayBuffer = new ArrayBuffer(0);
    let boldBuffer: ArrayBuffer = new ArrayBuffer(0);

    try {
        const regularPath: string = path.join(process.cwd(), 'fonts', 'NotoSansJP-PM-Regular.ttf');
        const regularRaw: Buffer = fs.readFileSync(regularPath);
        regularBuffer = regularRaw.buffer.slice(regularRaw.byteOffset, regularRaw.byteOffset + regularRaw.byteLength);
    } catch (e: unknown) {
        console.error('[proofmark-assets] Failed to load NotoSansJP-PM-Regular.ttf. Fallback to empty buffer.', e);
    }

    try {
        const boldPath: string = path.join(process.cwd(), 'fonts', 'NotoSansJP-PM-Black.ttf');
        const boldRaw: Buffer = fs.readFileSync(boldPath);
        boldBuffer = boldRaw.buffer.slice(boldRaw.byteOffset, boldRaw.byteOffset + boldRaw.byteLength);
    } catch (e: unknown) {
        console.error('[proofmark-assets] Failed to load NotoSansJP-PM-Black.ttf. Fallback to empty buffer.', e);
    }

    fontCache = { regular: regularBuffer, bold: boldBuffer };
    return fontCache;
}
