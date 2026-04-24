import imageCompression from 'browser-image-compression';

export interface PreparedEvidence {
  fileToSend: File | Blob;
  originalSha256: string;
  originalName: string;
  originalSize: number;
  isCompressed: boolean;
}

/**
 * ProofMark ハイブリッド・ペイロード生成エンジン
 * ※ハッシュ計算は既存のWorker等で計算済みのもの（precomputedHash）を受け取る
 */
export async function prepareEvidencePayload(originalFile: File, precomputedHash: string): Promise<PreparedEvidence> {
  let fileToSend: File | Blob = originalFile;
  let isCompressed = false;

  // 画像ファイルの場合のみ、Vercel通過用の軽量プレビューを生成する
  if (originalFile.type.startsWith('image/')) {
    const options = {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.8,
    };

    try {
      const compressedBlob = await imageCompression(originalFile, options);
      const newFileName = originalFile.name.replace(/\.[^/.]+$/, ".webp");
      fileToSend = new File([compressedBlob], newFileName, { type: 'image/webp' });
      isCompressed = true;
      console.log(`[ProofMark] プレビュー圧縮成功: ${(originalFile.size/1024/1024).toFixed(2)}MB -> ${(fileToSend.size/1024/1024).toFixed(2)}MB`);
    } catch (error) {
      console.warn('[ProofMark] 画像圧縮に失敗。元のファイルを使用します:', error);
    }
  }

  // 画像以外のファイルで4.5MB制限を超える場合の防衛線
  const MAX_API_PAYLOAD = 4 * 1024 * 1024;
  if (!isCompressed && originalFile.size > MAX_API_PAYLOAD) {
    throw new Error('画像以外のファイルは現在4MB以下である必要があります。');
  }

  return {
    fileToSend,
    originalSha256: precomputedHash,
    originalName: originalFile.name,
    originalSize: originalFile.size,
    isCompressed,
  };
}
