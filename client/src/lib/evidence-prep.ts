import imageCompression from 'browser-image-compression';

export interface PreparedEvidence {
  fileToSend: File | Blob;
  originalSha256: string;
  originalName: string;
  originalSize: number;
  isCompressed: boolean;
}

/**
 * ProofMark 原本保存エンジン
 * 圧縮・変換を一切行わず、純度100%のバイナリをそのまま通過させる
 */
export async function prepareEvidencePayload(originalFile: File, precomputedHash: string): Promise<PreparedEvidence> {
  // 圧縮・変換・リサイズ処理をすべて廃止。
  // 受け取った純度100%のバイナリ（originalFile）をそのまま右から左へ流す。
  return {
    fileToSend: originalFile,
    originalSha256: precomputedHash,
    originalName: originalFile.name,
    originalSize: originalFile.size,
    isCompressed: false,
  };
}

  // 🛡️ 画像以外のファイルで4.5MB制限を超える場合の防衛線
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