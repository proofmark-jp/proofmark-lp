/**
 * client/src/hooks/useEvidencePack.ts
 * ──────────────────────────────────────────────────────────────────
 *  Zero-Server Evidence Pack pipeline
 *
 *  Phase:
 *    1. fetch payload (API)
 *    2. fetch all signed-url assets in parallel with progress
 *    3. generate Certificate_of_Authenticity.pdf with pdf-lib + Noto Sans JP
 *    4. zip everything with JSZip — date forced to certified_at
 *    5. trigger download via file-saver
 *
 *  全行程ブラウザで完結。Vercel タイムアウトの影響を受けない。
 * ──────────────────────────────────────────────────────────────────
 */

import { useCallback, useRef, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { supabase } from '@/lib/supabase';

/* ─────────────────────────────────────────────
 *  Types (バックエンドと同形)
 * ───────────────────────────────────────────── */

interface EvidenceAsset {
    pathInZip: string;
    signedUrl: string;
    size: number | null;
    isOriginal: boolean;
}

interface EvidenceText {
    pathInZip: string;
    content: string;
    encoding?: 'utf8' | 'base64';
}

interface EvidencePayload {
    certId: string;
    archiveName: string;
    archiveMtimeIso: string;
    assets: EvidenceAsset[];
    texts: EvidenceText[];
    certificate: {
        id: string;
        title: string;
        fileName: string;
        sha256: string;
        certifiedAt: string;
        issuedAtJst: string;
        tsaProvider: string;
        proofMode: 'private' | 'shareable';
        badgeTier: string | null;
        verifyUrl: string;
        authorLabel: string;
    };
}

export type EvidencePackPhase =
    | 'idle'
    | 'fetching_payload'
    | 'downloading_assets'
    | 'generating_certificate'
    | 'packing_archive'
    | 'saving'
    | 'done'
    | 'error';

export interface EvidencePackState {
    phase: EvidencePackPhase;
    /** 0..1 */
    progress: number;
    /** ユーザに見せる現在ステップ文 */
    message: string;
    error: string | null;
}

const PHASE_LABELS: Record<EvidencePackPhase, string> = {
    idle: '',
    fetching_payload: '鍵束を発行しています…',
    downloading_assets: '安全に証拠ファイルを取得中…',
    generating_certificate: '納品証明書 (PDF) を生成中…',
    packing_archive: 'Evidence Pack を封緘中…',
    saving: 'ダウンロードを開始しています…',
    done: '完了しました',
    error: 'エラーが発生しました',
};

/* 進捗のフェーズ別レンジ。フェーズ進行で連続的に増えるよう設計。 */
const PHASE_RANGES: Record<EvidencePackPhase, [number, number]> = {
    idle: [0, 0],
    fetching_payload: [0.0, 0.05],
    downloading_assets: [0.05, 0.7],
    generating_certificate: [0.7, 0.85],
    packing_archive: [0.85, 0.99],
    saving: [0.99, 1.0],
    done: [1.0, 1.0],
    error: [0, 0],
};

/* Noto Sans JP TTF — pdf-lib に embed 可能な形 */
const NOTO_SANS_JP_TTF_URL =
'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-jp@0.4.3/NotoSansJP_400Regular.ttf';
const NOTO_SANS_JP_BOLD_TTF_URL =
'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-jp@0.4.3/NotoSansJP_700Bold.ttf';

let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

/* ─────────────────────────────────────────────
 *  Hook
 * ───────────────────────────────────────────── */

export function useEvidencePack() {
    const [state, setState] = useState<EvidencePackState>({
        phase: 'idle',
        progress: 0,
        message: '',
        error: null,
    });
    const abortRef = useRef<AbortController | null>(null);

    const setPhase = useCallback(
        (phase: EvidencePackPhase, sub: number = 0): void => {
            const [lo, hi] = PHASE_RANGES[phase];
            const progress = lo + (hi - lo) * Math.max(0, Math.min(1, sub));
            setState((prev) => ({
                ...prev,
                phase,
                progress,
                message: PHASE_LABELS[phase],
            }));
        },
        [],
    );

    const download = useCallback(
        async (certId: string): Promise<void> => {
            // 二重発火防止
            abortRef.current?.abort();
            abortRef.current = new AbortController();
            const { signal } = abortRef.current;

            try {
                setState({ phase: 'fetching_payload', progress: 0, message: PHASE_LABELS.fetching_payload, error: null });

                // ── 1. payload 取得 ───────────────────────────────
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;
                if (!token) throw new Error('ログインセッションが切れています。再ログインしてください。');

                const payloadRes = await fetch(`/api/get-evidence-payload?id=${encodeURIComponent(certId)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal,
                });
                if (!payloadRes.ok) {
                    const errBody = await payloadRes.json().catch(() => ({}));
                    throw new Error(errBody.error || `payload fetch failed (${payloadRes.status})`);
                }
                const payload = (await payloadRes.json()) as EvidencePayload;
                setPhase('fetching_payload', 1);

                // ── 2. アセットを並列 fetch (進捗付き) ─────────────
                setPhase('downloading_assets', 0);
                const downloaded = await fetchAssetsWithProgress(payload.assets, signal, (p) =>
                    setPhase('downloading_assets', p),
                );

                // ── 3. Certificate PDF 生成 ───────────────────────
                setPhase('generating_certificate', 0);
                const certPdf = await buildCertificatePdf(payload.certificate, (p) =>
                    setPhase('generating_certificate', p),
                );
                setPhase('generating_certificate', 1);

                // ── 4. ZIP パッキング ────────────────────────────
                setPhase('packing_archive', 0);
                const mtime = new Date(payload.archiveMtimeIso);
                const safeMtime = Number.isNaN(mtime.getTime()) ? new Date() : mtime;

                const zip = new JSZip();

                // 4-a. テキスト (常に先頭で確定させる)
                for (const t of payload.texts) {
                    zip.file(t.pathInZip, t.content, {
                        date: safeMtime,
                        base64: t.encoding === 'base64' // ← Base64バイナリを正しく復元
                    });
                }
                // 4-b. PDF
                zip.file('Certificate_of_Authenticity.pdf', certPdf, { date: safeMtime });
                // 4-c. アセット (バイナリ)
                for (const a of downloaded) {
                    zip.file(a.pathInZip, a.buffer, {
                        date: safeMtime,
                        binary: true,
                        // 大型ファイルは無圧縮で時短 (元から圧縮済みの場合の体感速度を優先)
                        compression: a.isLarge ? 'STORE' : 'DEFLATE',
                        compressionOptions: a.isLarge ? undefined : { level: 6 },
                    });
                }

                const zipBlob = await zip.generateAsync(
                    {
                        type: 'blob',
                        mimeType: 'application/zip',
                        streamFiles: true,
                        compression: 'DEFLATE',
                        compressionOptions: { level: 6 },
                    },
                    (meta) => {
                        // 0..100 で来る
                        setPhase('packing_archive', meta.percent / 100);
                    },
                );

                // ── 5. 保存 ──────────────────────────────────────
                setPhase('saving', 0.5);
                saveAs(zipBlob, payload.archiveName);
                setPhase('done', 1);
            } catch (err) {
                if ((err as Error)?.name === 'AbortError') {
                    setState({ phase: 'idle', progress: 0, message: '', error: null });
                    return;
                }
                setState({
                    phase: 'error',
                    progress: 0,
                    message: PHASE_LABELS.error,
                    error: (err as Error)?.message ?? 'unknown error',
                });
                // eslint-disable-next-line no-console
                console.error('[useEvidencePack]', err);
            }
        },
        [setPhase],
    );

    const cancel = useCallback((): void => {
        abortRef.current?.abort();
    }, []);

    const reset = useCallback((): void => {
        abortRef.current?.abort();
        setState({ phase: 'idle', progress: 0, message: '', error: null });
    }, []);

    return { state, download, cancel, reset };
}

/* ─────────────────────────────────────────────
 *  Asset fetch with combined progress
 * ───────────────────────────────────────────── */

interface DownloadedAsset {
    pathInZip: string;
    buffer: ArrayBuffer;
    isLarge: boolean;
    isOriginal: boolean;
}

const LARGE_ASSET_THRESHOLD_BYTES = 5 * 1024 * 1024;

async function fetchAssetsWithProgress(
    assets: EvidenceAsset[],
    signal: AbortSignal,
    onProgress: (p: number) => void,
): Promise<DownloadedAsset[]> {
    // 並列度を制限 (Supabase Storage への同時接続を抑制)
    const CONCURRENCY = 4;

    // 「不明サイズ」は 1MB と推定し、後で実測補正
    const estimated = assets.map((a) => a.size ?? 1_048_576);
    const totalEstimated = estimated.reduce((s, v) => s + v, 0) || 1;
    const received = new Array<number>(assets.length).fill(0);

    const emit = (): void => {
        const sum = received.reduce((s, v) => s + v, 0);
        onProgress(Math.min(1, sum / totalEstimated));
    };

    const downloadOne = async (asset: EvidenceAsset, index: number): Promise<DownloadedAsset> => {
        const res = await fetch(asset.signedUrl, { signal });
        if (!res.ok) throw new Error(`Failed to fetch ${asset.pathInZip}: HTTP ${res.status}`);

        const lengthHeader = res.headers.get('content-length');
        const length = lengthHeader ? Number(lengthHeader) : asset.size ?? null;
        if (length && length > estimated[index]) {
            // 推定より大きかったら全体を補正
            estimated[index] = length;
        }

        if (!res.body) {
            const buf = await res.arrayBuffer();
            received[index] = buf.byteLength;
            emit();
            return {
                pathInZip: asset.pathInZip,
                buffer: buf,
                isLarge: buf.byteLength >= LARGE_ASSET_THRESHOLD_BYTES,
                isOriginal: asset.isOriginal,
            };
        }

        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                chunks.push(value);
                bytes += value.byteLength;
                received[index] = bytes;
                emit();
            }
        }
        const merged = new Uint8Array(bytes);
        let offset = 0;
        for (const c of chunks) {
            merged.set(c, offset);
            offset += c.byteLength;
        }
        return {
            pathInZip: asset.pathInZip,
            buffer: merged.buffer,
            isLarge: bytes >= LARGE_ASSET_THRESHOLD_BYTES,
            isOriginal: asset.isOriginal,
        };
    };

    // pool runner
    const out = new Array<DownloadedAsset | null>(assets.length).fill(null);
    let cursor = 0;
    const workers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(CONCURRENCY, assets.length); w++) {
        workers.push(
            (async () => {
                while (true) {
                    const i = cursor++;
                    if (i >= assets.length) return;
                    out[i] = await downloadOne(assets[i], i);
                }
            })(),
        );
    }
    await Promise.all(workers);
    return out as DownloadedAsset[];
}

/* ─────────────────────────────────────────────
 *  Certificate PDF builder (pdf-lib + Noto Sans JP)
 *  → index-5.html のレイアウトを 1mm 単位で再現
 *
 *  A4 (210 × 297 mm) — pdf-lib は points (1mm ≈ 2.834)
 * ───────────────────────────────────────────── */

const MM = 2.83465;

interface CertificateMeta {
    id: string;
    title: string;
    fileName: string;
    sha256: string;
    certifiedAt: string;
    issuedAtJst: string;
    tsaProvider: string;
    proofMode: 'private' | 'shareable';
    badgeTier: string | null;
    verifyUrl: string;
    authorLabel: string;
}

async function loadNotoSansJp(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
    if (fontCache) return fontCache;
    const [regular, bold] = await Promise.all([
        fetch(NOTO_SANS_JP_TTF_URL).then((r) => r.arrayBuffer()),
        fetch(NOTO_SANS_JP_BOLD_TTF_URL).then((r) => r.arrayBuffer()),
    ]);
    fontCache = { regular, bold };
    return fontCache;
}

async function buildCertificatePdf(
    meta: CertificateMeta,
    onProgress: (p: number) => void,
): Promise<Uint8Array> {
    onProgress(0.05);
    const fonts = await loadNotoSansJp();
    onProgress(0.45);

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);

    const fontRegular = await pdf.embedFont(fonts.regular, { subset: true });
    const fontBold = await pdf.embedFont(fonts.bold, { subset: true });
    const fontMono = await pdf.embedFont(StandardFonts.Courier);

    const page = pdf.addPage([210 * MM, 297 * MM]);
    const { width, height } = page.getSize();

    // index-5.html: 余白 30mm
    const margin = 30 * MM;

    // ── トーン ──
    const ink = rgb(0x1d / 255, 0x1d / 255, 0x1f / 255);     // #1d1d1f
    const inkSoft = rgb(0x6e / 255, 0x6e / 255, 0x73 / 255); // #6e6e73
    const inkSubtle = rgb(0x86 / 255, 0x86 / 255, 0x8b / 255);
    const accent = rgb(0x6c / 255, 0x3e / 255, 0xf4 / 255);
    const success = rgb(0x00 / 255, 0xb8 / 255, 0x96 / 255);
    const rule = rgb(0xd2 / 255, 0xd2 / 255, 0xd7 / 255);

    let cursorY = height - margin;

    // ── Eyebrow ──
    page.drawText('CERTIFICATE OF AUTHENTICITY', {
        x: margin,
        y: cursorY,
        size: 9,
        font: fontBold,
        color: inkSubtle,
        characterSpacing: 3,
    });
    cursorY -= 8 * MM;

    // ── Title (JP) ──
    page.drawText('納品物 真正性証明書', {
        x: margin,
        y: cursorY - 6 * MM,
        size: 28,
        font: fontBold,
        color: ink,
    });
    cursorY -= 18 * MM;

    // ── Divider ──
    page.drawLine({
        start: { x: margin, y: cursorY },
        end: { x: width - margin, y: cursorY },
        thickness: 0.4,
        color: rule,
    });
    cursorY -= 10 * MM;

    // ── Issued by block (right-aligned author / left meta) ──
    page.drawText('発行者 / Issued by', {
        x: margin,
        y: cursorY,
        size: 8,
        font: fontBold,
        color: inkSubtle,
        characterSpacing: 1.5,
    });
    cursorY -= 5 * MM;
    page.drawText(meta.authorLabel, {
        x: margin,
        y: cursorY,
        size: 13,
        font: fontBold,
        color: ink,
    });

    // 発行日 (右寄せ)
    const dateLabel = '発行日時 / Certified at';
    page.drawText(dateLabel, {
        x: width - margin - fontBold.widthOfTextAtSize(dateLabel, 8),
        y: cursorY + 5 * MM,
        size: 8,
        font: fontBold,
        color: inkSubtle,
        characterSpacing: 1.5,
    });
    page.drawText(meta.issuedAtJst, {
        x: width - margin - fontBold.widthOfTextAtSize(meta.issuedAtJst, 13),
        y: cursorY,
        size: 13,
        font: fontBold,
        color: ink,
    });
    cursorY -= 14 * MM;

    // ── Statement (本文) ──
    const statement = [
        '本書は、下記に示すデジタル成果物が、明記された発行日時に、',
        '明記された発行者の手から確かに納品されたことを、',
        '国際標準 RFC3161 タイムスタンプおよび SHA-256 ハッシュにより、',
        '第三者が独立して検証可能な形で証明するものです。',
    ];
    for (const line of statement) {
        page.drawText(line, {
            x: margin,
            y: cursorY,
            size: 10.5,
            font: fontRegular,
            color: inkSoft,
            lineHeight: 16,
        });
        cursorY -= 5.5 * MM;
    }
    cursorY -= 4 * MM;

    // ── Asset card (rounded panel) ──
    const cardX = margin;
    const cardW = width - margin * 2;
    const cardH = 38 * MM;
    drawCard(page, cardX, cursorY - cardH, cardW, cardH, rule);

    let inner = cursorY - 8 * MM;
    page.drawText('NAME', {
        x: cardX + 6 * MM, y: inner, size: 7.5, font: fontBold, color: inkSubtle, characterSpacing: 2,
    });
    page.drawText(truncate(meta.title, 64), {
        x: cardX + 6 * MM, y: inner - 5 * MM, size: 14, font: fontBold, color: ink,
    });
    inner -= 12 * MM;

    page.drawText('FILE', {
        x: cardX + 6 * MM, y: inner, size: 7.5, font: fontBold, color: inkSubtle, characterSpacing: 2,
    });
    page.drawText(truncate(meta.fileName, 64), {
        x: cardX + 6 * MM, y: inner - 5 * MM, size: 11, font: fontRegular, color: ink,
    });
    inner -= 12 * MM;

    page.drawText('SHA-256', {
        x: cardX + 6 * MM, y: inner, size: 7.5, font: fontBold, color: inkSubtle, characterSpacing: 2,
    });
    // hash は monospace + 折返し
    const hashLines = chunkString(meta.sha256, 32);
    let hashY = inner - 5 * MM;
    for (const h of hashLines) {
        page.drawText(h, {
            x: cardX + 6 * MM, y: hashY, size: 10, font: fontMono, color: ink,
        });
        hashY -= 4.6 * MM;
    }
    cursorY -= cardH + 10 * MM;

    // ── Verify URL + ID ──
    page.drawText('ワンクリック検証', {
        x: margin, y: cursorY, size: 8, font: fontBold, color: inkSubtle, characterSpacing: 1.5,
    });
    cursorY -= 5.5 * MM;
    page.drawText(meta.verifyUrl, {
        x: margin, y: cursorY, size: 11, font: fontBold, color: accent,
    });
    cursorY -= 10 * MM;

    // ── Trust footer ──
    page.drawLine({
        start: { x: margin, y: cursorY },
        end: { x: width - margin, y: cursorY },
        thickness: 0.4,
        color: rule,
    });
    cursorY -= 8 * MM;

    page.drawText('RFC3161 · SHA-256 · Independent Verifiable', {
        x: margin, y: cursorY, size: 9, font: fontBold, color: success, characterSpacing: 2,
    });

    const tsaLabel = `TSA: ${meta.tsaProvider}`;
    page.drawText(tsaLabel, {
        x: width - margin - fontRegular.widthOfTextAtSize(tsaLabel, 9),
        y: cursorY, size: 9, font: fontRegular, color: inkSoft,
    });
    cursorY -= 5.5 * MM;
    page.drawText(`Certificate ID: ${meta.id}`, {
        x: margin, y: cursorY, size: 8.5, font: fontMono, color: inkSubtle,
    });

    // ── ProofMark seal (右下) — シンプルなマーク + テキスト
    page.drawText('ProofMark', {
        x: width - margin - fontBold.widthOfTextAtSize('ProofMark', 11),
        y: cursorY,
        size: 11,
        font: fontBold,
        color: ink,
    });

    onProgress(0.95);
    const bytes = await pdf.save();
    onProgress(1);
    return bytes;
}

function drawCard(
    page: ReturnType<PDFDocument['addPage']>,
    x: number,
    y: number,
    w: number,
    h: number,
    borderColor: ReturnType<typeof rgb>,
): void {
    page.drawRectangle({
        x, y, width: w, height: h,
        color: rgb(0.99, 0.99, 0.992),
        borderColor,
        borderWidth: 0.5,
    });
}

function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return `${str.slice(0, max - 1)}…`;
}

function chunkString(s: string, n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
    return out;
}
