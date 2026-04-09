import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1.0,
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// FreeTSAのエンドポイント（将来有料プランに切り替える際はこちらを変更します）
const TSA_URL = 'https://freetsa.org/tsr';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // セキュリティ対策：POSTリクエスト以外は弾く
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { hash, certId } = req.body;
        if (!hash || !certId) {
            return res.status(400).json({ error: 'Missing hash or certId' });
        }

        // 1. クライアントから送られたハッシュ値(16進数文字列)を純粋なバイナリ(Buffer)に変換
        const hashBuffer = Buffer.from(hash, 'hex');
        if (hashBuffer.length !== 32) {
            return res.status(400).json({ error: 'Invalid SHA-256 hash length' });
        }

        // 2. ASN.1 タイムスタンプ要求(TSQ)の純粋なバイナリ構築（ライブラリ依存ゼロの魔術）
        // SHA-256用の国際規格プレフィックス（固定）とサフィックス（証明書要求=true）
        const prefix = Buffer.from([
            0x30, 0x3A, 0x02, 0x01, 0x01, 0x30, 0x33, 0x30, 0x0D,
            0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04,
            0x02, 0x01, 0x05, 0x00, 0x04, 0x20
        ]);
        const suffix = Buffer.from([0x01, 0x01, 0xFF]);

        // これらを結合して「タイムスタンプ要求データ」を完成させる
        const tsqBuffer = Buffer.concat([prefix, hashBuffer, suffix]);

        // 3. FreeTSAのサーバーへ暗号通信（HTTP POST）を実行
        const tsaResponse = await fetch(TSA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/timestamp-query',
                'Accept': 'application/timestamp-reply',
            },
            body: tsqBuffer
        });

        if (!tsaResponse.ok) {
            throw new Error(`TSA responded with status: ${tsaResponse.status}`);
        }

        // 4. FreeTSAから返ってきたトークン(TSR)の受け取りと保存用Base64化
        const tsrArrayBuffer = await tsaResponse.arrayBuffer();
        const tsrBuffer = Buffer.from(tsrArrayBuffer);
        const timestampTokenBase64 = tsrBuffer.toString('base64'); // ← これが最強の証拠になります

        // 5. TSRバイナリから「国際標準時（GeneralizedTime）」を超高速で抽出
        // （ライブラリを使わず、バイナリ配列の中から直接タグ(0x18)を探し出して解析します）
        let certifiedAt = new Date(); // フォールバック（万が一見つからなかった時用）
        for (let i = 0; i < tsrBuffer.length - 16; i++) {
            if (tsrBuffer[i] === 0x18) { // GeneralizedTimeのタグ
                const len = tsrBuffer[i + 1];
                if (len >= 15 && len <= 19) {
                    const timeStr = tsrBuffer.subarray(i + 2, i + 2 + len).toString('ascii');
                    // YYYYMMDDHHMMSSZ のフォーマットか検証
                    if (/^20\d{12,16}Z$/.test(timeStr)) {
                        const y = timeStr.slice(0, 4);
                        const m = timeStr.slice(4, 6);
                        const d = timeStr.slice(6, 8);
                        const h = timeStr.slice(8, 10);
                        const min = timeStr.slice(10, 12);
                        const s = timeStr.slice(12, 14);
                        certifiedAt = new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
                        break; // 見つけたら即終了（超高速）
                    }
                }
            }
        }

        // 6. Supabaseの該当証明書データを更新（先ほど作った関門1のカラムに注入）
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/certificates?id=eq.${certId}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                timestamp_token: timestampTokenBase64,
                tsa_provider: 'freetsa',
                certified_at: certifiedAt.toISOString()
            })
        });

        if (!updateRes.ok) {
            throw new Error('Failed to update Supabase record');
        }

        // 全て成功したらフロントエンドに完了を伝える
        return res.status(200).json({ success: true, certified_at: certifiedAt.toISOString() });

    } catch (error: any) {
        console.error('RFC3161 Timestamp Error:', error);
        Sentry.captureException(error);
        await Sentry.flush(2000); // 🌟 追加: 送信完了まで最大2秒待機する
        return res.status(500).json({ error: error.message });
    }
}