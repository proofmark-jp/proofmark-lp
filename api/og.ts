import { VercelRequest, VercelResponse } from '@vercel/node';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { html } from 'satori-html';
import sharp from 'sharp';

let cachedFontData: ArrayBuffer | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const url = new URL(req.url!, `${protocol}://${host}`);

    const title = (req.query.title as string) || url.searchParams.get('title') || 'Digital Certificate';
    const thumbUrl = (req.query.thumb as string) || url.searchParams.get('thumb');
    const hash = (req.query.hash as string) || url.searchParams.get('hash') || '000000000000';
    const timestamp = (req.query.timestamp as string) || url.searchParams.get('timestamp') || 'N/A';
    const creator = (req.query.creator as string) || url.searchParams.get('creator') || 'Anonymous';

    if (!cachedFontData) {
      try {
        const fontRes = await fetch(
          'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf'
        );
        if (!fontRes.ok) throw new Error('Failed to fetch font');
        cachedFontData = await fontRes.arrayBuffer();
      } catch (fontErr) {
        console.error('Font fetch error:', fontErr);
        throw new Error('Font rendering engine failed to initialize.');
      }
    }
    const fontData = cachedFontData;

    let base64Thumb = '';
    if (thumbUrl) {
      try {
        // SSRF 防衛: 許可されたドメイン（Supabaseストレージ等）のみ許可する
        const allowedDomains = ['layesvzeeaiqqbhwdlgb.supabase.co', 'proofmark.jp'];
        const thumbDomain = new URL(thumbUrl).hostname;
        if (!allowedDomains.includes(thumbDomain)) {
          throw new Error('Unauthorized thumbnail domain');
        }

        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 3000); // 3秒でタイムアウト

        const imageRes = await fetch(thumbUrl, { signal: ctl.signal });
        clearTimeout(timer);

        if (imageRes.ok) {
          const imageBuffer = await imageRes.arrayBuffer();
          // OOM防衛: 10MB以上の画像は処理しない
          if (imageBuffer.byteLength < 10 * 1024 * 1024) {
            const pngBuffer = await sharp(Buffer.from(imageBuffer))
              .resize(1200, 630, { fit: 'cover' })
              .png()
              .toBuffer();
            base64Thumb = `data:image/png;base64,${pngBuffer.toString('base64')}`;
          }
        }
      } catch (err) {
        console.error('Failed to process thumbnail:', err);
        // サムネイル処理が失敗しても、OGP画像自体は生成してフォールバックさせる
      }
    }

    const markup = html`<div style="display: flex; height: 100%; width: 100%; flex-direction: column; position: relative; background-color: #07061A; font-family: 'Noto Sans JP', sans-serif;">
      ${base64Thumb ?
        `<img src="${base64Thumb}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" />` :
        `<div style="display: flex; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: #1C1A38;"></div>`
      }
      <div style="display: flex; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: linear-gradient(to bottom, rgba(13, 11, 36, 0) 0%, rgba(13, 11, 36, 0.4) 40%, rgba(13, 11, 36, 0.95) 80%, rgba(13, 11, 36, 1) 100%);"></div>
      <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; width: 100%; padding: 60px; position: absolute; top: 0; left: 0;">
        <div style="display: flex; flex-direction: row; align-items: center; font-size: 36px; font-weight: 900; color: #F0EFF8;">
          <img src="https://proofmark.jp/apple-touch-icon.png" width="48" height="48" style="border-radius: 12px; margin-right: 12px;" />
          <div style="display: flex; flex-direction: row;">
            <div style="display: flex;">Proof</div>
            <div style="display: flex; color: #00D4AA;">Mark</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column;">
          <div style="display: flex; flex-direction: column; margin-bottom: 24px;">
            <div style="display: flex; font-size: 64px; font-weight: 900; color: #F0EFF8; line-height: 1.1; max-width: 1080px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
            <div style="display: flex; font-size: 32px; font-weight: 600; color: #A8A0D8; margin-top: 8px;">By ${creator}</div>
          </div>
          <div style="display: flex; flex-direction: row; align-items: center; background-color: rgba(28, 26, 56, 0.8); border: 1px solid rgba(168, 160, 216, 0.2); border-radius: 16px; padding: 16px 24px; font-size: 22px; color: #A8A0D8;">
            <div style="display: flex; color: #F0EFF8;">[ File ]</div>
            <div style="display: flex; margin: 0 12px; opacity: 0.7;">➔</div>
            <div style="display: flex; color: #6C3EF4;">(SHA-256)</div>
            <div style="display: flex; margin: 0 12px; opacity: 0.7;">➔</div>
            <div style="display: flex; color: #00D4AA; background-color: rgba(0, 212, 170, 0.1); padding: 2px 8px; border-radius: 4px;">[${hash.substring(0, 12)}...]</div>
            <div style="display: flex; margin: 0 12px; opacity: 0.7;">➔</div>
            <div style="display: flex; color: #6C3EF4;">(RFC3161)</div>
            <div style="display: flex; margin: 0 12px; opacity: 0.7;">➔</div>
            <div style="display: flex; color: #00D4AA; background-color: rgba(0, 212, 170, 0.1); padding: 2px 8px; border-radius: 4px;">[${timestamp}]</div>
          </div>
        </div>
      </div>
    </div>`;

    const svg = await satori(markup as any, {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(pngBuffer);

  } catch (e: any) {
    console.error('Failed to generate OGP image:', e);
    return res.status(500).json({ error: 'Failed to generate the image', details: e.message });
  }
}