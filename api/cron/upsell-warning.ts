import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cronからのリクエストか、あるいは手動の認証ヘッダーがあるか確認（セキュリティ）
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 27日前に作成された、まだパージされていないFreeプラン（または該当）の証明書を取得
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 27);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    const { data: certs, error } = await supabase
      .from('certificates')
      .select(`
        id, 
        title, 
        user_id,
        profiles ( email, username )
      `)
      .eq('is_asset_purged', false)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (error) throw error;
    if (!certs || certs.length === 0) {
      return res.status(200).json({ message: 'No targets found for today.' });
    }

    // 🚨 ユーザーごとにメール送信（チャンク処理でAPI制限とOOMを回避）
    const CHUNK_SIZE = 50;
    let sentCount = 0;

    for (let i = 0; i < certs.length; i += CHUNK_SIZE) {
      const chunk = certs.slice(i, i + CHUNK_SIZE);
      const sendPromises = chunk.map(async (cert: any) => {
        const userEmail = cert.profiles?.email;
        if (!userEmail) return;

        const emailHtml = `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #000;">⚠️ 証明書の原本ストレージ期限が迫っています</h2>
            <p>${cert.profiles?.username || 'クリエイター'} 様</p>
            <p>あなたがProofMarkで証明した作品「<strong>${cert.title}</strong>」の原本ストレージ保存期間（30日）が、あと<strong>3日</strong>で終了します。</p>
            <p>期間が終了すると、公開ページから原本ファイルが自動的に削除され、クライアントが直接ダウンロードできなくなります。（※暗号学的なハッシュ台帳は保持されます）</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #00d4aa; padding: 16px; margin: 24px 0;">
              <h3 style="margin-top: 0; color: #0f172a;">Evidence Vaultで永遠に守りませんか？</h3>
              <p style="margin-bottom: 0;">Creatorプランへアップグレードすると、作品は「永久不変の原本ストレージ（Evidence Vault）」に保管され、決して削除されることはありません。</p>
            </div>
            
            <a href="https://www.proofmark.jp/pricing" style="display: inline-block; background-color: #000; color: #deff9a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">プランをアップグレードする</a>
          </div>
        `;

        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'ProofMark <noreply@proofmark.jp>',
              to: userEmail,
              subject: '【ProofMark】原本ファイルの保存期限があと3日です',
              html: emailHtml
            })
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Resend API response status: ${response.status} - ${errBody}`);
          }

          sentCount++;
        } catch (err) {
          console.error(`Failed to send email to ${userEmail} for certificate ${cert.id}:`, err);
        }
      });

      await Promise.allSettled(sendPromises);
      // 🚨 Resend APIのレートリミット防衛のため、チャンク間に1秒の待機を挟む
      if (i + CHUNK_SIZE < certs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return res.status(200).json({ message: `Successfully sent ${sentCount} upsell emails.` });

  } catch (err) {
    console.error('Upsell Cron Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
