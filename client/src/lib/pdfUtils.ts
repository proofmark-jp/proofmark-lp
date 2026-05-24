import { jsPDF } from 'jspdf';

/**
 * 既存のフォントファイルを利用した最適化PDFユーティリティ
 */
export async function optimizeImageForPdf(dataUrl: string, maxDim: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas ctx not available'));
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

/**
 * フォントをローカルの public/fonts/ からロードしてjsPDFに登録
 */
export async function loadJapaneseFont(doc: jsPDF): Promise<void> {
  // すでに登録済みならスキップ
  if (doc.getFontList()['NotoSansJP']) return;

  try {
    // ローカルのパスからロード（fetchはブラウザのキャッシュが効く）
    const response = await fetch('/fonts/NotoSansJP-Regular.ttf');
    if (!response.ok) throw new Error('Font fetch failed');
    const arrayBuffer = await response.arrayBuffer();
    
    // Uint8ArrayをBase64文字列に変換
    const binary = new Uint8Array(arrayBuffer);
    let base64 = '';
    for (let i = 0; i < binary.byteLength; i++) {
      base64 += String.fromCharCode(binary[i]);
    }
    const fontBase64 = btoa(base64);

    doc.addFileToVFS('NotoSansJP.ttf', fontBase64);
    doc.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal');
  } catch (error) {
    console.error('Font loading error:', error);
  }
}