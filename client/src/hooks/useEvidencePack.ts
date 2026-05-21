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

/* Noto Sans JP TTF — Vercelの自社ドメインから最速配信 (404完全回避) */
const NOTO_SANS_JP_TTF_URL = '/NotoSansJP-Regular.ttf';
const NOTO_SANS_JP_BOLD_TTF_URL = '/NotoSansJP-Bold.ttf';

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
        async (certId: string, theme: 'color' | 'mono' = 'color'): Promise<void> => {
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
                const certPdf = await buildCertificatePdf(payload.certificate, theme, (p) =>
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

// --- Helper: テキストの自動改行 ---
function drawWrappedText(
    page: any, text: string, x: number, y: number, maxWidth: number,
    font: any, size: number, color: any, lineHeight: number
): void {
    let currentLine = '';
    let cursorY = y;
    for (const char of text) {
        const testLine = currentLine + char;
        const width = font.widthOfTextAtSize(testLine, size);
        if (width > maxWidth && currentLine.length > 0) {
            page.drawText(currentLine, { x, y: cursorY, font, size, color });
            currentLine = char;
            cursorY -= lineHeight;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        page.drawText(currentLine, { x, y: cursorY, font, size, color });
    }
}

// --- Core PDF Builder ---
async function buildCertificatePdf(
    meta: CertificateMeta,
    theme: 'color' | 'mono',
    onProgress: (p: number) => void,
): Promise<Uint8Array> {
    onProgress(0.05);
    
    // 1. フォントとテンプレートのロード
    const fonts = await loadNotoSansJp();
    const templatePath = theme === 'color' ? '/template-color.pdf' : '/template-mono.pdf';
    const templateBytes = await fetch(templatePath).then(res => {
        if (!res.ok) throw new Error(`Template not found: ${templatePath}`);
        return res.arrayBuffer();
    });

    onProgress(0.45);

    // 2. PDFドキュメントの初期化（白紙作成ではなく、テンプレートの読み込み）
    const pdf = await PDFDocument.load(templateBytes);
    pdf.registerFontkit(fontkit);

    // 3. 欧文・和文の混植フォント登録 (subset: false で文字化け完全防止)
    const fontRegular = await pdf.embedFont(fonts.regular, { subset: false });
    const fontMono = await pdf.embedFont(StandardFonts.Courier);
    
    const pages = pdf.getPages();
    const page1 = pages[0]; // 1ページ目 (表紙・挨拶)
    const page2 = pages[1]; // 2ページ目 (検証手順)

    // 色の定義 (Ink)
    const ink = rgb(0x0f / 255, 0x0f / 255, 0x11 / 255);
    const inkSubtle = rgb(0x3a / 255, 0x3a / 255, 0x42 / 255);
    const purple = rgb(0x6c / 255, 0x3e / 255, 0xf4 / 255);

   // ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝
      // 【最終最適化版】ベースライン独立型・動的追従フッターシステム
      // ご提示の神グリッド座標をベースに、長文ファイル名のみ自動でIDを押し下げます
      // ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝ ＝
      
      const FOOTER_X = 140.0; // ラベルの直後に100%美しく揃うX軸基準線
      const MAX_TEXT_WIDTH = 240.0; // 署名欄（sinn）の手前まで使える安全な最大描画幅

      // ── Page 1: Footer 注入 ────────────────────────────────
      const P1_Y_ROW1 = 68.5; // 1行目: 発行日の絶対高さ
      const P1_Y_ROW2 = 56.5; // 2行目: 納品物の開始高さ

      // 1行目: 発行日（ご提示のサイズ 9.0 を維持）
      page1.drawText(meta.issuedAtJst, { x: FOOTER_X, y: P1_Y_ROW1, size: 9.0, font: fontRegular, color: ink });
      
      // 2行目: 納品物 (切り詰めを完全撤廃。どれだけ長くても自動で折り返して全文字描画)
      // 改行が入るたびに、この関数が自動で下方向へテキストを展開します
      drawWrappedText(page1, meta.fileName, FOOTER_X, P1_Y_ROW2, MAX_TEXT_WIDTH, fontRegular, 9.0, ink, 12.0);
      
      // ファイル名が現在のフォントサイズ(9.0)で枠幅(240pt)を超えた場合の行数を数学的に算出
      const textWidth = fontRegular.widthOfTextAtSize(meta.fileName, 9.0);
      const lineCount = Math.ceil(textWidth / MAX_TEXT_WIDTH);

      // 3行目: 証明書ID (ご提示の高さ 44.5 を基準とし、ファイル名が2行以上になった時だけ自動で押し下げ)
      // これにより、通常の長さなら「44.5」にジャストフィットし、長文でも文字が重なりません
      const p1_idY = lineCount > 1 ? P1_Y_ROW2 - (lineCount * 12.0) : 44.5;
      page1.drawText(meta.id, { x: FOOTER_X, y: p1_idY, size: 9.5, font: fontMono, color: inkSubtle });


      // ── Page 2: Body & Footer 注入 ─────────────────────────
      // 01・オンライン検証 URL（ご提示の完璧な位置 [638.0] を100%固定）
      page2.drawText(meta.verifyUrl, { x: 75.5, y: 638.0, size: 9.5, font: fontMono, color: purple });
      
      // 2ページ目フッター (ご提示いただいた位置で完全に直列同期)
      const P2_Y_ROW1 = 55.0; // 1行目: 発行日
      const P2_Y_ROW3 = 44.0; // 2行目: 証明書ID（ラベルのベースラインへ完全直列）

      page2.drawText(meta.issuedAtJst, { x: FOOTER_X, y: P2_Y_ROW1, size: 9.0, font: fontRegular, color: ink });
      page2.drawText(meta.id, { x: FOOTER_X, y: P2_Y_ROW3, size: 9.5, font: fontMono, color: inkSubtle });

      onProgress(0.95);
      const bytes = await pdf.save();
      onProgress(1);
      return bytes;
    }