/**
 * api/_lib/og-signer-edge.ts
 * ──────────────────────────────────────────────────────────────────
 * Antigravity Payload Signer (Edge-safe)
 * プロキシで取得したすべてのデータをURLに乗せ、改ざんを防ぐための暗号化を行う。
 */

export interface OgPayload {
    id: string;
    title: string;
    hash: string;
    author: string;
    depth: number;
    timeSpan: string;
    origin: string;
    mid: string;
    head: string;
}

// 🛡️ 署名用のシリアライズ（OGP側と完全に一致させること）
export function serializeOgPayload(p: OgPayload): string {
    return `${p.id}||${p.title}||${p.hash}||${p.author}||${p.depth}||${p.timeSpan}||${p.origin}||${p.mid}||${p.head}`;
}

export async function generateSignedOgpUrlEdge(p: OgPayload): Promise<string> {
    const secret = process.env.OGP_HMAC_SECRET;
    if (!secret) return '';

    const payloadStr = serializeOgPayload(p);
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payloadStr));
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const sigHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const params = new URLSearchParams({
        id: p.id,
        t: p.title,
        h: p.hash,
        a: p.author,
        d: p.depth.toString(),
        tm: p.timeSpan,
        o: p.origin,
        m: p.mid,
        hd: p.head,
        sig: sigHex
    });

    return `https://proofmark.jp/api/og-vault?${params.toString()}`;
}