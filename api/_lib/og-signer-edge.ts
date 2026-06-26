export async function generateSignedOgpUrlEdge(id: string, revision: string = '1'): Promise<string> {
    const secret = process.env.OGP_HMAC_SECRET;
    if (!secret) return '';
    
    const payload = `${id}:${revision}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const sigHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `https://proofmark.jp/api/og-vault?id=${id}&rev=${revision}&sig=${sigHex}`;
}
