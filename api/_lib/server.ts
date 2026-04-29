/**
 * api/_lib/server.ts — shared server primitives (Sprint 3 superset)
 *
 * Backwards-compatible with earlier Sprints. New helpers added:
 *   • requireRequestActor() — extracts caller's IP / user-agent (audit fields)
 *   • requireStudioOwner()  — gates project/team mutations to plan_tier in
 *                              ('studio', 'business')
 *
 * NEVER import from a browser bundle.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ── env ────────────────────────────────────────────────────────────────────
export function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env: ${name}`);
    return v;
}
export function optionalEnv(name: string, fallback = ''): string {
    return process.env[name] ?? fallback;
}

// ── Supabase clients ───────────────────────────────────────────────────────
export function getAdminClient(): SupabaseClient {
    return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export function getUserClient(jwt: string): SupabaseClient {
    return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// ── auth ───────────────────────────────────────────────────────────────────
const JWT_RE = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;

export function getBearerToken(req: VercelRequest): string | null {
    const h = req.headers.authorization || req.headers.Authorization;
    if (!h || typeof h !== 'string') return null;
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) return null;
    const t = m[1].trim();
    return JWT_RE.test(t) ? t : null;
}

export interface AuthedUser { id: string; email: string | null; jwt: string }

export async function requireUser(req: VercelRequest): Promise<AuthedUser> {
    const token = getBearerToken(req);
    if (!token) throw new HttpError(401, 'authentication required');
    const admin = getAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) throw new HttpError(401, 'invalid session');
    return { id: data.user.id, email: data.user.email ?? null, jwt: token };
}

export async function tryUser(req: VercelRequest): Promise<AuthedUser | null> {
    try { return await requireUser(req); } catch { return null; }
}

/**
 * For Studio-only endpoints (project / team / audit mutations).
 * Throws 402 (Payment Required) if the user's plan tier isn't sufficient.
 */
export async function requireStudioPlan(userId: string): Promise<{ planTier: string }> {
    const admin = getAdminClient();
    const { data, error } = await admin
        .from('profiles')
        .select('plan_tier')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw new HttpError(500, `profile lookup failed: ${error.message}`);
    const tier = (data?.plan_tier ?? 'free') as string;
    if (!['studio', 'business'].includes(tier)) {
        throw new HttpError(402, 'studio_plan_required');
    }
    return { planTier: tier };
}

// ── HTTP helpers ───────────────────────────────────────────────────────────
export class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}

export function httpError(status: number, message: string) { return new HttpError(status, message); }

export function json(res: VercelResponse, status: number, body: Record<string, unknown>) {
    res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(body));
}

export function methodGuard(req: VercelRequest, res: VercelResponse, allow: string[]): boolean {
    if (!allow.includes(req.method ?? '')) {
        res.setHeader('Allow', allow.join(', '));
        json(res, 405, { error: 'method_not_allowed' });
        return false;
    }
    return true;
}

// ── logging ────────────────────────────────────────────────────────────────
export interface Logger {
    ctx: { reqId: string; route: string };
    info: (o: Record<string, unknown>) => void;
    warn: (o: Record<string, unknown>) => void;
    error: (o: Record<string, unknown>) => void;
}

export function makeLogger(route: string): Logger {
    const reqId =
        (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
        `req_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const ctx = { reqId, route };
    const fmt = (level: string, o: Record<string, unknown>) =>
        JSON.stringify({ level, ts: new Date().toISOString(), ...ctx, ...o });
    return {
        ctx,
        info: (o) => console.log(fmt('info', o)),
        warn: (o) => console.warn(fmt('warn', o)),
        error: (o) => console.error(fmt('error', o)),
    };
}

// ── origin guard ───────────────────────────────────────────────────────────
export function isAllowedOrigin(origin: string): boolean {
    const csv = optionalEnv(
        'ALLOWED_ORIGINS',
        'https://www.proofmark.jp,https://proofmark.jp,http://localhost:3000,http://localhost:5173',
    );
    return csv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .includes(origin);
}

// ── audit-actor extractor ──────────────────────────────────────────────────
export interface RequestActor {
    ip: string | null;
    userAgent: string | null;
}

export function getRequestActor(req: VercelRequest): RequestActor {
    const fwd = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
    const first = fwd.split(',')[0]?.trim() ?? null;
    const ip = first || (req.socket?.remoteAddress ?? null);
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;
    return { ip: ip || null, userAgent: ua };
}
