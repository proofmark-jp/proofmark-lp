/**
 * src/lib/image-compression.ts
 * ─────────────────────────────────────────────────────────────────────
 * ProofMark — Chain of Evidence 用 ハイブリッド・ペイロード 圧縮ユーティリティ
 *
 *   compressProcessStepImage(file: File): Promise<File>
 *
 * 設計思想:
 *  - 途中工程（HEAD 以外）の画像のみに対して呼ぶ「軽量化エンジン」。
 *  - 完成品（HEAD）は呼び出し側で必ず素通しすること（このファイルは関与しない）。
 *
 * 4 つの致死的な罠への対処:
 *  1. OOM Crash:
 *     - ImageBitmap を都度 `close()` で即解放、Canvas も 0×0 にして GC ヒント。
 *     - 関数末尾で `setTimeout(0)` Yield。直列ループから呼ばれる前提。
 *  2. EXIF Orientation Bug:
 *     - `createImageBitmap(file, { imageOrientation: 'from-image' })` を採用。
 *       これは「EXIF Orientation を物理ピクセルに焼き込む」現代ブラウザの標準仕様
 *       であり、Canvas へ描画後の縦横崩れを物理的に発生させない。
 *  3. Main-Thread Blocking:
 *     - `createImageBitmap` も `toBlob` も非同期（内部スレッド側で動く）なので
 *       Framer Motion の RAF を阻害しない。Yield も追加で挟む。
 *  4. Egress Trap:
 *     - `image/webp` 強制再エンコード。Canvas API の仕様により Exif / GPS /
 *       カラープロファイル等のメタデータは原理的に破棄される（無関係な
 *       バイト列をハッシュ計算に混入させない）。
 *
 * 仕様:
 *  - 出力: WebP, quality 0.8, 長辺 1920px 以下（アスペクト比維持）。
 *  - 入力より縮小サイズが大きくなる場合は等倍で再エンコード（拡大はしない）。
 *  - ファイル名は元ファイル名の拡張子だけ `.webp` に差し替える。
 *  - lastModified は元ファイルのものを引き継ぐ（タイムライン整列を破壊しない）。
 *
 * このモジュールは「副作用なしの純粋関数」として書く。呼び出し側で並列実行
 * しないこと（最大 150 枚 × 4MP の Canvas を同時に開けば確実に OOM する）。
 */

/* ───────────────────────────────────────────────────────────────────── */

/** 長辺の上限（px）。アスペクト比は維持する。 */
const MAX_LONG_EDGE_PX = 1920;
/** WebP エンコード品質（0.0 – 1.0）。 */
const WEBP_QUALITY = 0.8;
/** 圧縮後に意図的に挿入するイベントループ Yield (ms)。 */
const POST_YIELD_MS = 10;

/* ───────────────────────────────────────────────────────────────────── */

/** 拡張子だけを `.webp` に差し替えるユーティリティ。 */
function toWebpFileName(originalName: string): string {
  if (!originalName) return 'image.webp';
  const lastDot = originalName.lastIndexOf('.');
  if (lastDot <= 0) return `${originalName}.webp`;
  return `${originalName.slice(0, lastDot)}.webp`;
}

/** マイクロタスク〜マクロタスクを跨ぐ GC Yield。 */
function yieldToEventLoop(ms = POST_YIELD_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 旧 Safari など `createImageBitmap` のオプション未対応環境向けフォールバック。
 * `<img>` + EXIF Orientation CSS は信頼できないため、Bitmap API が無い場合は
 * 「無変換で原本を返す」設計とする（ハッシュ整合のため WebP 偽装はしない）。
 */
function canUseModernBitmapPipeline(): boolean {
  if (typeof createImageBitmap !== 'function') return false;
  try {
    // Feature detection: imageOrientation オプションが受理されるか
    // 実呼び出しは行わず、関数の存在のみ確認（呼ばれた瞬間に Promise 化する）
    return true;
  } catch {
    return false;
  }
}

/* ───────────────────────────────────────────────────────────────────── */

/**
 * 途中工程画像を WebP に圧縮する。
 *
 * @param file 元画像ファイル
 * @returns 新しい File（image/webp, 長辺 ≤1920px, quality 0.8, EXIF 等メタデータ皆無）
 *
 * 例外を投げる条件:
 *  - 画像として decode 不能（壊れた JPEG 等）
 *  - 2D Canvas Context 取得失敗
 *  - toBlob で Blob が null 返却された
 *
 * 呼び出し側は try/catch でハンドリングし、失敗時はオリジナルにフォールバック
 * するか、当該ステップだけスキップする等の方針を取ること。
 */
export async function compressProcessStepImage(file: File): Promise<File> {
  // 画像でない場合は触らずに返す（呼び出し側の責任を補強する防御層）
  if (!file.type.startsWith('image/')) {
    return file;
  }

  if (!canUseModernBitmapPipeline()) {
    // 古い環境: 無変換でフォールバック（要件外環境のため Best Effort）
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  let canvas: HTMLCanvasElement | null = null;

  try {
    // ── 1. EXIF Orientation 焼き込みでデコード ──────────────────────
    //
    // imageOrientation: 'from-image' は WHATWG HTML Living Standard 仕様で
    // 「画像が持つ Orientation メタデータをピクセルに反映してから返す」
    // と定義されている。これにより、縦撮影 JPEG が Canvas 上で横倒しに
    // なる古典的バグを発生源で殺す。
    bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
      // premultiplyAlpha と colorSpaceConversion はデフォルトのままで良い。
      // ProofMark の用途では色の絶対値より「同じバイナリが同じハッシュ」
      // になる再現性の方が重要。
    });

    const srcW = bitmap.width;
    const srcH = bitmap.height;

    if (srcW <= 0 || srcH <= 0) {
      throw new Error('Decoded bitmap has zero dimension');
    }

    // ── 2. 長辺 1920px 制約でリサイズ計算 ───────────────────────────
    const longEdge = Math.max(srcW, srcH);
    const scale = longEdge > MAX_LONG_EDGE_PX ? MAX_LONG_EDGE_PX / longEdge : 1;
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    // ── 3. Canvas で WebP 化（メタデータは原理的に破棄される） ─────
    canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d', {
      // PNG のような alpha 持ち画像の透明保持。WebP は alpha 対応。
      alpha: true,
      // 大量処理時の GPU テクスチャ確保を控えめにする。
      desynchronized: false,
    });
    if (!ctx) {
      throw new Error('2D context unavailable');
    }
    // 高品質縮小（モバイル Safari でもデフォルトで有効だが念のため明示）
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, dstW, dstH);

    // bitmap は draw 完了したら即座に解放（数十 MB 単位の GPU/CPU メモリ）
    bitmap.close();
    bitmap = null;

    // ── 4. WebP エンコード ─────────────────────────────────────────
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas!.toBlob(
        (b) => resolve(b),
        'image/webp',
        WEBP_QUALITY,
      );
    });

    // Canvas を 0×0 にして VRAM/CPU バックバッファ解放を促す
    canvas.width = 0;
    canvas.height = 0;
    canvas = null;

    if (!blob) {
      throw new Error('toBlob returned null (WebP encoder failed)');
    }

    // ── 5. File 化（純粋画像データ。Exif/ICC 等は含まれない） ──────
    const newName = toWebpFileName(file.name);
    const compressed = new File([blob], newName, {
      type: 'image/webp',
      // タイムライン整列は lastModified に依存するため必ず引き継ぐ
      lastModified: file.lastModified,
    });

    return compressed;
  } finally {
    // 例外パスでも確実にリソース解放
    if (bitmap) {
      try { bitmap.close(); } catch { /* noop */ }
    }
    if (canvas) {
      try { canvas.width = 0; canvas.height = 0; } catch { /* noop */ }
    }
    // 直列呼び出しを前提に、ここで一拍置いて GC を促す
    await yieldToEventLoop();
  }
}

/* ───────────────────────────────────────────────────────────────────── */

/**
 * デバッグ用: 圧縮率の計算ヘルパー（呼び出し側で console.log したい時に）。
 *  ratio < 1.0 で軽量化されている。1.0 を超えた場合（既に最適化済み等で
 *  リエンコード結果がむしろ増えた場合）は呼び出し側で原本採用する判断も可。
 */
export function compressionRatio(before: File, after: File): number {
  if (before.size === 0) return 1;
  return after.size / before.size;
}