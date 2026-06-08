/**
 * lib/utils/imageOptimizer.ts — The Egress Defender
 *
 * - クライアントのブラウザ内で画像をリサイズ＆WebP圧縮
 * - サーバーの Image Optimization 課金を物理的にゼロにする
 */

export async function generateThumbnail(file: File, maxWidth = 800, quality = 0.7): Promise<File | null> {
  if (!file.type.startsWith('image/')) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.drawImage(img, 0, 0, width, height);
        
        // 🚨 軽量なWebPとして抽出（これがクラウド破産を防ぐ盾）
        canvas.toBlob((blob) => {
          if (!blob) return resolve(null);
          const thumbFile = new File([blob], `thumb_${file.name.replace(/\.[^/.]+$/, "")}.webp`, {
            type: 'image/webp',
          });
          resolve(thumbFile);
        }, 'image/webp', quality);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}