/**
 * app/api/generate-evidence-pack/route.ts [Part 1/2]
 * ─────────────────────────────────────────────────────────────────────────────
 * The Evidence Forge — Absolute Backend Streaming Engine (Rev.6 - The Final Apex)
 *
 * ⚡ Architecture Guardrails:
 * 1. Zero-Trust Ticket (Atomic): Redis GETDELによるTOCTOU完全防御。
 * 2. Fire-and-Forget Audit: TTFB遅延ゼロを実現する非同期ロギングの完全並走。
 * 3. FinOps JSONB Metadata: 転送量、処理時間、国コードを記録し将来のマネタイズへ直結。
 * 4. The Envelope Pattern: 確実性と速度を両立するインフラ限界への最適解。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { Readable } from 'stream';

// ビジネスロジック関数（既存インポート）
import { fetchEvidencePayload } from '@/lib/forge/payloadBuilder'; 
import { generateCertificatePdfBuffer, generateCoverLetterPdfBuffer } from '@/lib/pdf/generatorServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────
// Infrastructure Clients
// ─────────────────────────────────────────────────────────
const redis = new Redis({
    url: process.env.KV_REST_API_URL || '',
    token: process.env.KV_REST_API_TOKEN || '',
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 🚨 RLSバイパス用特権クライアント（ゼロトラスト・インサート用）
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

// ─────────────────────────────────────────────────────────
// The Immutable Ledger (Audit Log Helper)
// ─────────────────────────────────────────────────────────
type AuditLogStatus = 'STARTED' | 'COMPLETED' | 'ABORTED' | 'FAILED';

interface AuditMetadata {
    country?: string;
    stripe_payment_intent_id?: string;
    auth_session_id?: string;
    bytes_sent?: number;
    duration_ms?: number;
}

/**
 * 🚨 TTFB遅延ゼロ・ロギング (Fire-and-Forget)
 * awaitせずに裏で走らせるため、エラーは内部で完全に握り潰す。
 */
async function initAuditLog(
    targetId: string, 
    kind: string, 
    request: NextRequest, 
    initialMetadata: AuditMetadata
): Promise<string | null> {
    try {
        const forwardedFor = request.headers.get('x-forwarded-for');
        const ipAddress = request.ip || (forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1');
        const userAgent = request.headers.get('user-agent') || 'Unknown';

        const { data, error } = await Promise.race([
            supabaseAdmin.from('audit_logs').insert([{
                target_id: targetId,
                kind: kind,
                status: 'STARTED',
                ip_address: ipAddress,
                user_agent: userAgent,
                metadata: initialMetadata // JSONBへの戦略的仕込み
            }]).select('id').single(),
            // 🚨 500msの絶対的タイムアウト（The Slowest Link Trap防御）
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Audit Log INIT Timeout')), 500))
        ]);

        if (error) throw error;
        return data.id;
    } catch (err) {
        console.error('[Audit Log Error] Failed to INIT log (Ignored to protect TTFB):', err);
        return null; // 欠損時はnullを返し、本流を止めない
    }
}

/**
 * ストリーム完了・中断時の最終状態と計測データを記録する
 */
async function updateAuditLog(
    logId: string | null, 
    status: AuditLogStatus, 
    finalMetadata?: AuditMetadata
): Promise<void> {
    if (!logId) return; 
    try {
        const updateData: any = { status, updated_at: new Date().toISOString() };
        if (finalMetadata) {
            // jsonb_setと同等のマージ処理（Supabase JS経由）
            // ※既存メタデータとの完全なマージは要件次第だが、今回は上書き/追加想定
            updateData.metadata = finalMetadata; 
        }

        const { error } = await supabaseAdmin
            .from('audit_logs')
            .update(updateData)
            .eq('id', logId);

        if (error) throw error;
    } catch (err) {
        console.error(`[Audit Log Error] Failed to UPDATE log to ${status}:`, err);
    }
}

// ─────────────────────────────────────────────────────────
// Core Router (GET / Streamer)
// ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    const startTime = Date.now();
    let isStreamStarted = false;
    let initLogPromise: Promise<string | null> = Promise.resolve(null);

    try {
        const { searchParams } = new URL(request.url);
        const ticketId = searchParams.get('ticket');

        if (!ticketId || typeof ticketId !== 'string') {
            return new NextResponse('Bad Request: Missing ticket', { status: 400 });
        }

        // 1. Zero-Trust Ticket Validation (Atomic GETDEL)
        // 🚨 TOCTOU脆弱性を物理的に無効化するRedisのアトミック操作
        const ticketDataStr = await redis.getdel<string>(`ticket:${ticketId}`);

        if (!ticketDataStr) {
            return new NextResponse('Unauthorized: Invalid or expired ticket', { status: 401 });
        }

        const ticketPayload = typeof ticketDataStr === 'string' ? JSON.parse(ticketDataStr) : ticketDataStr;
        const { targetId, kind, stripe_payment_intent_id, auth_session_id } = ticketPayload;

        // 2. 攻めのメタデータ抽出（Geo-Compliance Tracker & Chargeback Defender）
        const initialMetadata: AuditMetadata = {
            country: request.headers.get('x-vercel-ip-country') || 'Unknown',
            stripe_payment_intent_id,
            auth_session_id
        };

        // 3. Fire-and-Forget Audit (The Masked I/O)
        // 🚨 awaitしない。プロセスの裏側に投げ捨てて、TTFBへの遅延をゼロにする。
        initLogPromise = initAuditLog(targetId, kind, request, initialMetadata);

        // 4. DBペイロード調達（ビジネスロジック）
        // Redisチケットに封入されている所有者IDを渡し、DBレベルの弾圧を有効化する
        const payload = await fetchEvidencePayload(targetId, kind, ticketPayload.userId); 
        // ※ ticketPayload内のユーザーIDの変数名が userId でない場合は適宜合わせること。
        if (!payload || !payload.files) throw new Error('Evidence data corrupted.');

        isStreamStarted = true;

        // -------------------------------------------------------------
        // [ Part 2: The Two-Phase Stream Engine ]
        // -------------------------------------------------------------

        // 5. Heavy Computation: PDF Generation (Node.js WASM/Yoga layer)
        const certPdfBuffer = await generateCertificatePdfBuffer(payload.pdfMeta.certInput);
        
        // 🚨 FinOps Defense: ユーザーキャンセルによるゾンビ・プロセスの即死処理
        if (request.signal.aborted) {
            console.warn('[Forge] Client aborted connection during cert PDF generation.');
            const logId = await initLogPromise; // 裏で走っていたINITを回収
            await updateAuditLog(logId, 'ABORTED', { duration_ms: Date.now() - startTime });
            return new NextResponse(null, { status: 499, statusText: 'Client Closed Request' });
        }

        const coverPdfBuffer = await generateCoverLetterPdfBuffer(payload.pdfMeta.coverInput);

        if (request.signal.aborted) {
            console.warn('[Forge] Client aborted connection during cover PDF generation.');
            const logId = await initLogPromise;
            await updateAuditLog(logId, 'ABORTED', { duration_ms: Date.now() - startTime });
            return new NextResponse(null, { status: 499, statusText: 'Client Closed Request' });
        }

        // 6. The Envelope Pattern: 決定論的ZIPのエントリ属性固定化
        // MS-DOSの2秒解像度とローカルタイムの揺らぎを物理的に排除する
        const stableTime = new Date(payload.certCreatedAt);
        stableTime.setUTCMilliseconds(0);
        stableTime.setUTCSeconds(Math.floor(stableTime.getUTCSeconds() / 2) * 2);
        
        const fileOptions = { 
            date: stableTime, 
            mode: 0o644 // パーミッションの絶対固定
        };

        // 7. The Streamer Setup
        const passthrough = new PassThrough();
        const archive = archiver('zip', {
            // 🚨 Egress Bankruptcy Defense: 圧縮レベル1 (最高速・最低圧縮)
            // テキストデータの転送量爆発を防ぎつつ、CPUを枯渇させない最適解
            zlib: { level: 1 }, 
        });

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn('[Archiver Warning] File stat missing, skipping:', err);
            } else {
                console.error('[Archiver Warning escalated to Error]', err);
                passthrough.destroy(err);
            }
        });

        archive.on('error', (err) => {
            console.error('[Archiver Error]', err);
            passthrough.destroy(err);
        });

        archive.pipe(passthrough);

        // PDFアセットの封入
        archive.append(certPdfBuffer, { name: '01_Certificate.pdf', ...fileOptions });
        archive.append(coverPdfBuffer, { name: '02_CoverLetter.pdf', ...fileOptions });
        
        // 8. Upstream Backpressure & JIT URL Fetching
        for (const file of payload.files) {
            // 🚨 600秒（10分）の長期一括発行と同義の都度生成（Vercel 300秒の壁より長い）
            const { data: urlData, error: urlError } = await supabaseAdmin.storage
                .from('evidences')
                .createSignedUrl(file.storagePath, 600);

            if (urlError || !urlData?.signedUrl) {
                throw new Error(`Failed to generate signed URL for ${file.name}`);
            }

            // 🚨 Supabase SDK (Blob一括展開) を破棄し、ネイティブFetchでストリーム直結
            const upstreamRes = await fetch(urlData.signedUrl);
            
            // 🚨 サイレント・コラプション（エラー文字列のバイナリ混入）の物理遮断
            if (!upstreamRes.ok || !upstreamRes.body) {
                throw new Error(`[Fetch Error] Upstream returned ${upstreamRes.status} for file ${file.name}`);
            }

            const nodeStream = Readable.fromWeb(upstreamRes.body as any);
            archive.append(nodeStream, { name: `assets/${file.name}`, ...fileOptions });
        }

        archive.finalize();

        // 9. The Web Stream Bridge & Two-Phase Audit (RESOLUTION)
        let totalBytesSent = 0;

        const readableWebStream = new ReadableStream({
            start(controller) {
                passthrough.on('data', (chunk) => {
                    totalBytesSent += chunk.length; // メタデータ: 送信バイト数の追跡
                    controller.enqueue(chunk);
                    // 🚨 Vercel RAM 1024MB枯渇防御 (下流への背圧制御)
                    if (controller.desiredSize !== null && controller.desiredSize <= 0) {
                        passthrough.pause();
                    }
                });

                passthrough.on('end', async () => {
                    // 👑 The Masked I/O Resolution: 終わった処理のIDをここで初めて回収
                    const logId = await initLogPromise;
                    const durationMs = Date.now() - startTime;
                    
                    // ログ書き込み完了までコンテナを延命させる（await）
                    await updateAuditLog(logId, 'COMPLETED', { 
                        bytes_sent: totalBytesSent, 
                        duration_ms: durationMs 
                    });
                    
                    controller.close();
                });

                passthrough.on('error', (err) => {
                    controller.error(err);
                });
            },
            pull() {
                passthrough.resume();
            },
            async cancel(reason) {
                // 👑 The Two-Phase Stream Audit: ABORTED
                console.warn('[Stream Cancelled / TCP Dropped]', reason);
                const logId = await initLogPromise;
                const durationMs = Date.now() - startTime;
                
                await updateAuditLog(logId, 'ABORTED', { 
                    bytes_sent: totalBytesSent, 
                    duration_ms: durationMs 
                });
                
                archive.abort();
                passthrough.destroy();
            }
        });

        // 10. The Absolute RFC 5987 Encoder (非推奨 escape() の完全排除)
        const strictEncode = (str: string) => 
            encodeURIComponent(str)
                .replace(/'/g, '%27')
                .replace(/\(/g, '%28')
                .replace(/\)/g, '%29')
                .replace(/\*/g, '%2A');

        const encodedFilename = strictEncode(payload.filename);

        // 11. Output Delivery (Dynamic Headers)
        return new NextResponse(readableWebStream, {
            headers: {
                'Content-Type': 'application/zip',
                // RFC 5987 完全準拠のヘッダー構築
                'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
                // 🚨 The Edge Compression Suicide Defense: 'no-transform' によるVercel再圧縮暴走の遮断
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, no-transform',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });

    } catch (err: any) {
        console.error('[The Forge Error]', err);
        
        const logId = await initLogPromise;
        const durationMs = Date.now() - startTime;

        if (logId) {
            await updateAuditLog(logId, 'FAILED', { duration_ms: durationMs });
        }

        if (!isStreamStarted) {
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }

        // ストリーム開始後のエラーは強制切断でOSダウンローダーに失敗を認知させる
        return new NextResponse(null, { status: 500, statusText: 'Internal Server Error' });
    }
}