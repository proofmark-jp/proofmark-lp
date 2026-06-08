/**
 * api/cron/gc.ts — The Great Sweeper (True Perfect Version)
 *
 * - Quarantine ゾンビファイルの討伐
 * - Spot (24h) / Free (30d) の物理ファイル完全パージ
 * - Originals と Public の【両バケット同時焼却】
 * - タイムアウトクラッシュを防ぐ OOM/Timeout チャンク処理 (Batch Limit)
 */

export const config = { runtime: 'edge' };

import { json, supabaseAdmin } from '../_shared.js';

const BATCH_LIMIT = 100; // Supabase Storage APIの安全圏 (Vercel Edge タイムアウト防衛)
const ORIGINALS_BUCKET = 'proofmark-originals';
const PUBLIC_BUCKET = 'proofmark-public';

export default async function handler(request: Request): Promise<Response> {
  // 🚨 Vercel Cron Security: 外部からの不正なトリガーを物理的に遮断
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json(401, { error: 'Unauthorized: Invalid CRON_SECRET' });
  }

  const results = { zombies_purged: 0, ttl_assets_purged: 0, errors: [] as string[] };

  try {
    /* ── 1. Quarantine ゾンビファイルの討伐 ── */
    const { data: zombies, error: zErr } = await supabaseAdmin.rpc('get_orphaned_quarantine_paths');
    
    if (zErr) {
      results.errors.push(`Zombie RPC Error: ${zErr.message}`);
    } else if (zombies && zombies.length > 0) {
      const targets = zombies.slice(0, BATCH_LIMIT).map((z: any) => z.storage_path);
      
      const { error: rmErr } = await supabaseAdmin.storage.from(ORIGINALS_BUCKET).remove(targets);
      if (rmErr) {
        results.errors.push(`Zombie Remove Error: ${rmErr.message}`);
      } else {
        results.zombies_purged = targets.length;
      }
    }

    /* ── 2. TTL (Spot/Free) のアセットパージと台帳更新 ── */
    const { data: ttlAssets, error: ttlErr } = await supabaseAdmin.rpc('get_ttl_purge_targets');
    
    if (ttlErr) {
      results.errors.push(`TTL RPC Error: ${ttlErr.message}`);
    } else if (ttlAssets && ttlAssets.length > 0) {
      const targets = ttlAssets.slice(0, BATCH_LIMIT);
      
      const originalPaths = targets.map((t: any) => t.storage_path);
      
      // Shareable の場合、Publicバケット側のパスも特定する
      const publicPaths = targets
        .filter((t: any) => t.proof_mode === 'shareable')
        .map((t: any) => {
          const ext = t.storage_path.split('.').pop();
          return `certificates/${t.cert_id}.${ext}`;
        });

      // ① Storage API経由で確実に「物理ファイル」を焼却 (Originals)
      const { error: rmOrigErr } = await supabaseAdmin.storage.from(ORIGINALS_BUCKET).remove(originalPaths);
      
      // ② Publicバケットの分身も焼却 (ベストエフォート)
      if (publicPaths.length > 0 && !rmOrigErr) {
        await supabaseAdmin.storage.from(PUBLIC_BUCKET).remove(publicPaths);
      }
      
      if (rmOrigErr) {
        results.errors.push(`TTL Remove Error: ${rmOrigErr.message}`);
      } else {
        // ③ 物理焼却に成功した場合「のみ」、DBのパージフラグを倒しURLも剥奪する（The Saga Pattern）
        const idsToUpdate = targets.map((t: any) => t.cert_id);
        const { error: updErr } = await supabaseAdmin
          .from('certificates')
          .update({ 
            is_asset_purged: true, 
            purged_at: new Date().toISOString(), 
            storage_path: null,
            public_image_url: null // 🚨 漏洩防止：公開URLの完全剥奪
          })
          .in('id', idsToUpdate);

        if (updErr) {
          results.errors.push(`TTL DB Update Error: ${updErr.message}`);
        } else {
          results.ttl_assets_purged = idsToUpdate.length;
        }
      }
    }

    return json(200, { success: true, results });

  } catch (err: any) {
    console.error('[GC Batch Fatal Error]', err);
    return json(500, { error: err.message || 'Fatal error during GC process' });
  }
}