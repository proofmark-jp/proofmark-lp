/**
 * GET /api/cron/cleanup-spot-data
 *
 * Vercel Cron entry point. Deletes Spot data older than 24 hours from:
 *  - Supabase Storage bucket "spot-evidence" (originals + tsr if any)
 *  - DB rows in `spot_orders` (and any related ephemeral artifacts)
 *
 * Security:
 *  - Verifies `Authorization: Bearer <CRON_SECRET>` header.
 *  - Vercel Cron automatically attaches the secret when configured via project Settings.
 *
 * Idempotency:
 *  - Pure DELETE/STORAGE.REMOVE per row. Replays are safe.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, json, makeLogger, methodGuard, requireEnv } from '../_lib/server.js';

export const config = { maxDuration: 300 };
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

interface SpotOrderRow {
    staging_id: string;
    paid_at: string | null;
    created_at: string | null;
    storage_paths: string[] | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const log = makeLogger('cron/cleanup-spot-data');
    res.setHeader('x-request-id', log.ctx.reqId);

    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    // Auth (Vercel Cron uses Authorization: Bearer <CRON_SECRET>)
    const secret = requireEnv('CRON_SECRET');
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${secret}`) {
        json(res, 401, { error: 'Unauthorized', reqId: log.ctx.reqId });
        return;
    }

    const admin = getAdminClient();
    const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();

    try {
        // 1) Pick rows older than cutoff.
        const { data: rows, error: fetchErr } = await admin
            .from('spot_orders')
            .select('staging_id, paid_at, created_at, storage_paths')
            .or(`paid_at.lt.${cutoff},and(paid_at.is.null,created_at.lt.${cutoff})`)
            .limit(500);

        if (fetchErr) throw fetchErr;
        const targets = (rows ?? []) as SpotOrderRow[];

        if (targets.length === 0) {
            log.info({ event: 'cron.nothing_to_clean', cutoff });
            json(res, 200, { ok: true, deleted: 0, reqId: log.ctx.reqId });
            return;
        }

        // 2) Delete storage objects (best-effort, then mark row for deletion).
        const storage = admin.storage.from('spot-evidence');
        const allPaths = targets.flatMap((r) => (Array.isArray(r.storage_paths) ? r.storage_paths : []));

        if (allPaths.length > 0) {
            // Storage.remove accepts an array; chunk to be safe.
            for (let i = 0; i < allPaths.length; i += 100) {
                const chunk = allPaths.slice(i, i + 100);
                const { error } = await storage.remove(chunk);
                if (error) log.warn({ event: 'cron.storage_remove_warn', message: error.message, chunkSize: chunk.length });
            }
        }

        // 3) Delete DB rows.
        const ids = targets.map((r) => r.staging_id);
        const { error: delErr } = await admin.from('spot_orders').delete().in('staging_id', ids);
        if (delErr) throw delErr;

        log.info({ event: 'cron.cleanup_done', cutoff, rows: targets.length, files: allPaths.length });
        json(res, 200, { ok: true, deleted: targets.length, files: allPaths.length, cutoff, reqId: log.ctx.reqId });
    } catch (err) {
        log.error({ event: 'cron.cleanup_failed', message: String((err as Error)?.message ?? err) });
        json(res, 500, { error: 'cleanup failed', reqId: log.ctx.reqId });
    }
}
