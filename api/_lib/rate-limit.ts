/**
 * api/_lib/rate-limit.ts — Phase 12.5
 *
 * 全プランの月次上限を Upstash Redis で物理ロック（Hard Limit）する。
 *
 * 設計の核:
 *   1. **DB を一切叩かない**: count(*) アンチパターンを根絶。Redis の
 *      INCR がアトミックに「現在何件目」を返す唯一の真実。
 *   2. **JST 月次キー**: サーバ (UTC) と日本ユーザー (JST) の月初ズレを
 *      回避するため、キーは必ず Asia/Tokyo の YYYY_MM で生成。
 *   3. **Fail-open**: Upstash がダウンしてもサービスを止めない。Redis
 *      接続エラーは catch して quota=上限値 のまま通過させる。
 *   4. **プラン別クォータ**: QUOTA_MAP により各プランの枠を厳密に管理。
 *      admin も含め、全プラン Redis でカウントし上限（Hard Limit）を適用する。
 *   5. **TTL は 40 日**: 翌月の月初リセットで自然消滅。Cron 不要。
 *
 * このモジュールは:
 *   - Upstash REST API を `fetch` で直接叩く (新規 SDK 依存ゼロ)
 *   - 1 リクエストあたり最大 1 ラウンドトリップ (INCR + EXPIRE 同梱の pipeline)
 *   - ENV: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { optionalEnv } from './server.js';

/**
 * プラン別の月次クォータ（TSA発行件数上限）。
 * PAID_TIERS の一律バイパスを廃止し、原価（COGS）の青天井を防ぐ。
 * admin も含め、万が一の暴走を防ぐため全プランに上限を設定する。
 */
const QUOTA_MAP: Record<string, number> = {
    free:     30,
    creator:  30,
    light:    30,  // legacy alias for creator
    studio:   150,
    business: 150,
    admin:    99999, // 🚨 adminの場合、上限を無制限（99999）として扱う
};

/** @deprecated 後方互換のために残す。新規コードは QUOTA_MAP を使うこと。 */
export const FREE_MONTHLY_QUOTA = 30;

const KEY_TTL_SECONDS = 40 * 24 * 60 * 60; // 40 days
const REDIS_FETCH_TIMEOUT_MS = 1500;       // hot path budget

export interface RateLimitInput {
    userId: string;
    planTier: string | null | undefined;
}

export type RateLimitResult =
    | { ok: true; bypassed: true; plan: 'paid' }
    | { ok: true; bypassed: false; used: number; remaining: number; quota: number; resetAt: string }
    | { ok: false; reason: 'quota_exceeded'; used: number; quota: number; resetAt: string }
    | { ok: true; bypassed: false; used: -1; remaining: -1; quota: number; resetAt: string; fallback: 'redis_unavailable' };

/**
 * JST 基準で「現在の月初 (00:00) → 翌月の月初 (00:00)」を計算する。
 * UTC 計算に 9 時間オフセットを足し戻すアプローチ (DST 不要なので安全)。
 */
function jstMonthRange(now = new Date()): { ym: string; resetAtIso: string } {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
    const y = jstNow.getUTCFullYear();
    const m = jstNow.getUTCMonth(); // 0-11
    const ym = `${y}_${String(m + 1).padStart(2, '0')}`;
    // 翌月初 (JST 00:00) を UTC に戻す
    const nextMonthJstUtc = Date.UTC(y, m + 1, 1, 0, 0, 0, 0);
    const resetUtcMs = nextMonthJstUtc - JST_OFFSET_MS;
    return { ym, resetAtIso: new Date(resetUtcMs).toISOString() };
}

export function buildRateLimitKey(userId: string, ym: string): string {
    return `rate_limit:${userId}:cert_issue_${ym}`;
}

interface UpstashConfig {
    url: string;
    token: string;
}

function getUpstashConfig(): UpstashConfig | null {
    const url = optionalEnv('UPSTASH_REDIS_REST_URL');
    const token = optionalEnv('UPSTASH_REDIS_REST_TOKEN');
    if (!url || !token) return null;
    return { url, token };
}

/**
 * Pipeline で `INCR key` と `EXPIRE key 3456000 NX` を 1 ラウンドトリップ
 * で実行する。NX を付けるので、既存の TTL は上書きしない (= ユーザーの
 * 累計に影響を与えない)。
 *
 * Upstash REST `pipeline` は配列で複数コマンドを返す。
 */
async function upstashIncrementWithExpire(
    cfg: UpstashConfig,
    key: string,
): Promise<number> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error('upstash_timeout')), REDIS_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(`${cfg.url}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([
                ['INCR', key],
                ['EXPIRE', key, String(KEY_TTL_SECONDS), 'NX'],
            ]),
            signal: ac.signal,
        });
        if (!res.ok) {
            throw new Error(`upstash_http_${res.status}`);
        }
        const data = (await res.json()) as Array<{ result?: number; error?: string }>;
        const incrResult = data?.[0];
        if (!incrResult || typeof incrResult.result !== 'number') {
            throw new Error('upstash_unexpected_response');
        }
        return incrResult.result;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Read-only にカウントを覗く (`GET key`)。UI 用。
 * 失敗しても 0 を返してサービスは止めない。
 */
async function upstashGet(cfg: UpstashConfig, key: string): Promise<number | null> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error('upstash_timeout')), REDIS_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${cfg.token}` },
            signal: ac.signal,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { result?: string | number | null };
        if (data.result === null || data.result === undefined) return 0;
        const n = typeof data.result === 'number' ? data.result : Number(data.result);
        return Number.isFinite(n) ? n : 0;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 発行直前に呼び出す。INCR を伴うので副作用あり。
 * quota+1 件目以降は ok:false, reason:'quota_exceeded' を返す。
 * admin 以外はすべて Redis でカウントする（有料プランのバイパスを廃止）。
 */
export async function incrementAndCheckCertIssue(
    input: RateLimitInput,
): Promise<RateLimitResult> {
    const tier = String(input.planTier ?? 'free').toLowerCase();
    const quota = QUOTA_MAP[tier] ?? 30;

    // かつては admin のみバイパス(Infinity)していたが、現在は全プランをカウント対象とする
    if (quota === Infinity) {
        return { ok: true, bypassed: true, plan: 'paid' };
    }

    const { ym, resetAtIso } = jstMonthRange();
    const key = buildRateLimitKey(input.userId, ym);
    const cfg = getUpstashConfig();

    if (!cfg) {
        // Configured-out: behave as fail-open (operator misconfig).
        return {
            ok: true,
            bypassed: false,
            used: -1,
            remaining: -1,
            quota,
            resetAt: resetAtIso,
            fallback: 'redis_unavailable',
        };
    }

    let count: number;
    try {
        count = await upstashIncrementWithExpire(cfg, key);
    } catch {
        // Redis 故障 → サービス停止せず通す (Fail-open)
        return {
            ok: true,
            bypassed: false,
            used: -1,
            remaining: -1,
            quota,
            resetAt: resetAtIso,
            fallback: 'redis_unavailable',
        };
    }

    if (count > quota) {
        // 🚨 超過分をロールバックし、アップグレード時のカウント不整合を防ぐ
        await rollbackIncrement(input).catch(() => undefined);
        return {
            ok: false,
            reason: 'quota_exceeded',
            used: count - 1, // UIには「到達済み」の数として伝える
            quota,
            resetAt: resetAtIso,
        };
    }

    return {
        ok: true,
        bypassed: false,
        used: count,
        remaining: quota - count,
        quota,
        resetAt: resetAtIso,
    };
}

/**
 * UI 用の read-only 照会 (GET /api/cert-issue/usage).
 * 副作用なし。失敗しても sensible default を返す。
 */
export async function peekCertIssueUsage(
    input: RateLimitInput,
): Promise<{ used: number; quota: number; remaining: number; resetAt: string; bypassed: boolean }> {
    const { ym, resetAtIso } = jstMonthRange();
    const tier = String(input.planTier ?? 'free').toLowerCase();
    const quota = QUOTA_MAP[tier] ?? 30;

    // admin のみバイパス表示
    if (quota === Infinity) {
        return { used: 0, quota: Infinity as unknown as number, remaining: Infinity as unknown as number, resetAt: resetAtIso, bypassed: true };
    }
    const cfg = getUpstashConfig();
    if (!cfg) {
        return { used: 0, quota, remaining: quota, resetAt: resetAtIso, bypassed: false };
    }
    const key = buildRateLimitKey(input.userId, ym);
    const used = (await upstashGet(cfg, key)) ?? 0;
    return {
        used,
        quota,
        remaining: Math.max(0, quota - used),
        resetAt: resetAtIso,
        bypassed: false,
    };
}

/**
 * 発行が DB レベルで失敗した場合に巻き戻すヘルパ (DECR).
 * INCR 後に `certificates` への INSERT が転んだ場合だけ呼ぶ。
 * 失敗しても無視 — 翌月リセットで自然回復。
 */
export async function rollbackIncrement(input: RateLimitInput): Promise<void> {
    const tier = String(input.planTier ?? 'free').toLowerCase();
    const quota = QUOTA_MAP[tier] ?? 30;
    // admin はカウントしていないのでロールバック不要
    if (quota === Infinity) return;
    const cfg = getUpstashConfig();
    if (!cfg) return;
    const { ym } = jstMonthRange();
    const key = buildRateLimitKey(input.userId, ym);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error('upstash_timeout')), REDIS_FETCH_TIMEOUT_MS);
    try {
        await fetch(`${cfg.url}/decr/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfg.token}` },
            signal: ac.signal,
        }).catch(() => undefined);
    } finally {
        clearTimeout(timer);
    }
}

// Internal exports for tests
export const __test__ = { jstMonthRange };

/* ═══════════════════════════════════════════════════════════════════
   IP-Level DDoS / Bot Defense — The Ironclad Fortress (Phase 12.5)
   ───────────────────────────────────────────────────────────────────
   設計:
     - キー: `ip_rl:<endpoint>:<ip>` (1時間スライディングウィンドウ)
     - 制限: 1IPにつき1時間に最大 IP_HOURLY_LIMIT リクエスト
     - TTL:  3600秒（1時間でキー自然消滅）
     - NX:   既存TTLを上書きしない（upstashIncrementWithExpire と同一設計）
     - Fail-open: Redis障害時はサービスを止めない
   共有IPリスク: 50req/hは大学・オフィス共有IPでも誤検知しない絶妙なライン。
   真の人間操作（1リクエスト ≒ 数分）では物理的に到達不能な閾値。
   ═══════════════════════════════════════════════════════════════════ */

const IP_HOURLY_LIMIT = 50;
const IP_TTL_SECONDS = 3600; // 1 hour

/**
 * IPアドレスをキーとした1時間スライディングウィンドウのレートリミット。
 *
 * @param ip       クライアントIPアドレス（getClientIp / getClientIpFromEdgeRequest の戻り値）
 * @param endpoint キー空間を分離するエンドポイント識別子
 * @returns `true` = OK (通過), `false` = 超過 (即時 429 を返すこと)
 */
export async function checkIpRateLimit(
    ip: string,
    endpoint: 'upload' | 'create',
): Promise<boolean> {
    const cfg = getUpstashConfig();
    if (!cfg) return true; // Fail-open: Upstash未設定環境ではスキップ

    // XFF内の最初のIPのみ使用し、カンマ区切りの後続プロキシIPを無視する
    const cleanIp = ip.split(',')[0].trim() || '127.0.0.1';
    const key = `ip_rl:${endpoint}:${cleanIp}`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error('upstash_timeout')), REDIS_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(`${cfg.url}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([
                ['INCR', key],
                ['EXPIRE', key, String(IP_TTL_SECONDS), 'NX'],
            ]),
            signal: ac.signal,
        });

        if (!res.ok) return true; // Fail-open: Upstash HTTP エラー

        const data = (await res.json()) as Array<{ result?: number; error?: string }>;
        const count = data?.[0]?.result;

        if (typeof count !== 'number') return true; // Fail-open: 予期しないレスポンス

        return count <= IP_HOURLY_LIMIT;
    } catch {
        // タイムアウト・ネットワーク障害 → Fail-open
        return true;
    } finally {
        clearTimeout(timer);
    }
}
