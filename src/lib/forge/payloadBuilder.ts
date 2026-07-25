/**
 * src/lib/forge/payloadBuilder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The Evidence Forge — Payload Builder (Absolute 100 - Flawless Execution)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

export interface EvidencePayload {
    pdfMeta: {
        certInput: any;
        coverInput: any;
    };
    files: Array<{ storagePath: string; name: string }>;
    certCreatedAt: string | Date;
    filename: string;
    ownerId: string;
}

/**
 * 🚨 Byte-Safe Truncation: 
 * UTF-8のバイナリを破壊せず、OSのファイルパス上限（255バイト）から逆算した安全なバイト数で切り捨てる
 */
function truncateByBytes(str: string, maxBytes: number): string {
    if (!str) return '';
    let result = '';
    let currentBytes = 0;
    for (const char of str) {
        const charBytes = Buffer.byteLength(char, 'utf8');
        if (currentBytes + charBytes > maxBytes) break;
        result += char;
        currentBytes += charBytes;
    }
    return result;
}

export async function fetchEvidencePayload(
    targetId: string, 
    kind: string,
    expectedOwnerId: string // 🚨 Zero-Trust RLS Emulator
): Promise<EvidencePayload> {
    
    if (kind !== 'certificate' && kind !== 'spot') {
        throw new Error(`[Forge] Critical: Unsupported payload kind '${kind}'.`);
    }
    if (kind === 'spot') {
        throw new Error(`[Forge] Spot evidence pack generation is currently isolated.`);
    }

    // 1. RLS Emulation Query
    const { data: certData, error: certError } = await supabaseAdmin
        .from('certificates')
        .select(`
            *,
            profiles (*),
            bundles (
                *,
                assets (*)
            )
        `)
        .eq('id', targetId)
        .eq('user_id', expectedOwnerId)
        .order('created_at', { foreignTable: 'bundles', ascending: false })
        .limit(1, { foreignTable: 'bundles' })
        .single();

    if (certError || !certData) {
        throw new Error(`[Forge] Fetch failed or Unauthorized for targetId: ${targetId}`);
    }

    let files: Array<{ storagePath: string; name: string }> = [];
    
    // 2. The Absolute Collision Defense (Map + Set Hybrid)
    const nameCountMap = new Map<string, number>();
    const finalNames = new Set<string>();

    if (certData.bundles && certData.bundles.length > 0) {
        const targetBundle = certData.bundles[0]; 
        if (targetBundle.assets) {
            files = targetBundle.assets.map((asset: any) => {
                // Zip Slip Defense & Native Dot Split
                const rawName = asset.file_name || 'unknown';
                const sanitized = rawName.replace(/[\/\\]/g, '_').replace(/\0/g, '');
                
                const firstDotIdx = sanitized.indexOf('.');
                const base = firstDotIdx > 0 ? sanitized.substring(0, firstDotIdx) : sanitized;
                const ext = firstDotIdx > 0 ? sanitized.substring(firstDotIdx) : '';

                let name = sanitized;
                let counter = nameCountMap.get(sanitized) || 1;

                // 確定台帳(finalNames)に存在する限り回す（自作自演の衝突も完全ブロック）
                while (finalNames.has(name)) {
                    name = `${base}_${counter}${ext}`;
                    counter++;
                    if (counter > 1000) { 
                        name = `${base}_${crypto.randomUUID().slice(0,8)}${ext}`; 
                        break; 
                    }
                }
                
                nameCountMap.set(sanitized, counter);
                finalNames.add(name);

                return {
                    name,
                    storagePath: `${certData.user_id}/${targetBundle.id}/${asset.file_name}` 
                };
            });
        }
    }

    if (files.length === 0) {
        throw new Error(`[Forge] Fatal: No evidence assets found for targetId ${targetId}.`);
    }

    const certCreatedAt = certData.created_at;
    
    // 3. OS Path Limit Defense (120 bytes max for title to leave room for ZIP envelope)
    const rawTitle = certData.title || 'evidence';
    const sanitizedTitle = rawTitle.replace(/[\/\\:*?"<>|]/g, '_');
    const safeTitle = truncateByBytes(sanitizedTitle, 120);
    const filename = `ProofMark_${safeTitle}_${targetId.substring(0, 8)}.zip`;

    const issuerName = certData.profiles?.legal_name || 'ProofMark User';

    return {
        pdfMeta: {
            certInput: certData,
            coverInput: {
                certificateId: targetId,
                title: certData.title,
                issuedAt: certCreatedAt,
                issuer: issuerName
            }
        },
        files,
        certCreatedAt,
        filename,
        ownerId: certData.user_id
    };
}