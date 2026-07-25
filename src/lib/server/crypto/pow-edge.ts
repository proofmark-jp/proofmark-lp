import { SignJWT } from 'jose';

// 👑 修正済: Edge Runtimeのメモリキャッシュを利用した Lazy Initialization
let powSecretCache: Uint8Array | null = null;
let supabaseJwtSecretCache: Uint8Array | null = null;

const getPowSecret = () => {
  if (powSecretCache) return powSecretCache;
  const secret = process.env.POW_SECRET;
  if (!secret) throw new Error('FATAL: POW_SECRET is not defined');
  powSecretCache = new TextEncoder().encode(secret);
  return powSecretCache;
};

const getSupabaseJwtSecret = () => {
  if (supabaseJwtSecretCache) return supabaseJwtSecretCache;
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('FATAL: SUPABASE_JWT_SECRET is not defined');
  supabaseJwtSecretCache = new TextEncoder().encode(secret);
  return supabaseJwtSecretCache;
};

export async function signChallenge(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', getPowSecret(), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  
  const bytes = new Uint8Array(signatureBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) result |= aBuf[i] ^ bBuf[i];
  return result === 0;
}

export async function verifyPow(signature: string, tgtHash: string, devicePub: string, nonce: string, difficulty: number): Promise<boolean> {
  const input = new TextEncoder().encode(signature + tgtHash + devicePub + nonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', input);
  const hashArray = new Uint8Array(hashBuffer);
  
  let hexString = '';
  for (let i = 0; i < hashArray.length; i++) {
    hexString += hashArray[i].toString(16).padStart(2, '0');
    if (hexString.length >= difficulty) break;
  }
  
  return hexString.startsWith('0'.repeat(difficulty));
}

export async function mintPayloadBoundJwt(targetHash: string, devicePub: string): Promise<string> {
  return await new SignJWT({
    role: 'forge_node', 
    tgt_hash: targetHash,
    device_pub: devicePub
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('24h') 
    .sign(getSupabaseJwtSecret());
}