/**
 * POST /api/webhooks/stripe
 *
 * v3 — Sprint 1 finalization:
 *   1. Verifies Stripe signature.
 *   2. UPSERT-with-lock against `stripe_events` via `fn_lock_stripe_event`.
 *      The function returns a row only when the caller is allowed to (re)process.
 *      ──────────────────────────────────────────────────────────────────────
 *      Why the old INSERT-only pattern was a deadlock:
 *        - First delivery: insert OK → process → maybe TSA call fails → status='failed'.
 *        - Stripe retries the same event id → INSERT raises 23505 → we returned 200
 *          → the failed event is *never* re-processed.
 *      The new RPC flips a 'failed' row back to 'received' atomically and lets us
 *      re-run the dispatch. 'received'/'processed' rows still short-circuit to 200.
 *      ──────────────────────────────────────────────────────────────────────
 *   3. For Spot kind: marks the order as paid, fetches an RFC3161 token
 *      via `requestTimestampWithFallback`, uploads the .tsr to Supabase Storage,
 *      atomically appends the path to `spot_orders.storage_paths` via
 *      `fn_spot_append_storage_path` (no read-modify-write race).
 *   4. For Subscription kind: applies plan grant (creator/studio/free).
 *
 * Failure semantics:
 *   - Anything thrown after lock → mark event 'failed' with the reason and
 *     return 5xx so Stripe retries. The next delivery enters the lock as a
 *     "was_retry=true" event and we run the dispatcher again.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getAdminClient, json, makeLogger, methodGuard, requireEnv } from '../_lib/server.js';
import { getStripe } from '../_lib/stripe.js';
import { requestTimestampWithFallback } from '../_lib/tsa.js';

// Stripe requires the *raw* body for signature verification.
export const config = { api: { bodyParser: false }, maxDuration: 300 }; // 5分に変更

async function readRawBody(req: VercelRequest): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req as any) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

interface PlanGrant {
    user_id: string;
    plan: 'creator' | 'studio' | 'free';
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    current_period_end?: string | null;
}

async function applyPlanGrant(grant: PlanGrant) {
    const admin = getAdminClient();
    const { error } = await admin
        .from('profiles')
        .update({
            plan_tier: grant.plan,
            stripe_customer_id: grant.stripe_customer_id ?? undefined,
            stripe_subscription_id: grant.stripe_subscription_id ?? undefined,
            stripe_current_period_end: grant.current_period_end ?? undefined,
            updated_at: new Date().toISOString(),
        })
        .eq('id', grant.user_id);
    if (error) throw error;
}

async function applySpotOrderPaid(opts: {
    sessionId: string;
    paymentIntentId: string | null;
    stagingId: string;
    sha256: string;
    filename: string;
    email: string | null;
    amountTotal: number | null;
    currency: string | null;
}) {
    const admin = getAdminClient();
    const { error } = await admin.from('spot_orders').upsert(
        {
            staging_id: opts.stagingId,
            stripe_session_id: opts.sessionId,
            stripe_payment_intent_id: opts.paymentIntentId,
            sha256: opts.sha256,
            filename: opts.filename,
            email: opts.email,
            amount_total: opts.amountTotal,
            currency: opts.currency,
            status: 'paid',
            paid_at: new Date().toISOString(),
        },
        { onConflict: 'staging_id', ignoreDuplicates: false },
    );
    if (error) throw error;
}

/**
 * Synchronously fetch a TSA token for a paid spot order, store it in the
 * `spot-evidence` bucket, and atomically append its path to `storage_paths`.
 *
 * On success: spot_orders.tsa_status='issued', certified_at set.
 * On failure: spot_orders.tsa_status='failed' + tsa_error; throws so the caller
 *             marks the event as 'failed' and Stripe retries the webhook.
 */
async function issueSpotTimestamp(opts: { stagingId: string; sha256: string; reqId: string }) {
    const admin = getAdminClient();
    const { stagingId, sha256, reqId } = opts;
    const log = (event: Record<string, unknown>) =>
        console.log(JSON.stringify({ reqId, route: 'webhooks/stripe', stagingId, ...event }));

    if (!/^[0-9a-f]{64}$/i.test(sha256)) {
        throw new Error(`spot order ${stagingId}: invalid sha256 in metadata`);
    }

    // --- ここから追加 (冪等性の担保: Webhook再送時の二重課金を防ぐ) ---
    const { data: existingOrder, error: checkErr } = await admin
        .from('spot_orders')
        .select('tsa_status')
        .eq('staging_id', stagingId)
        .maybeSingle();

    if (checkErr) {
        throw new Error(`spot ${stagingId}: failed to check existing status: ${checkErr.message}`);
    }
    if (existingOrder?.tsa_status === 'issued') {
        log({ event: 'spot.tsa_already_issued', message: 'TSA token already exists. Skipping fetch to prevent double billing.' });
        return;
    }
    // --- ここまで追加 ---

    let tsa;
    try {
        tsa = await requestTimestampWithFallback(sha256, { log });
    } catch (err) {
        const message = (err as Error)?.message ?? String(err);
        await admin
            .from('spot_orders')
            .update({ tsa_status: 'failed', tsa_error: message.slice(0, 1000) })
            .eq('staging_id', stagingId);
        throw err;
    }

    const path = `${stagingId}/timestamp.tsr`;
    const { error: upErr } = await admin.storage
        .from('spot-evidence')
        .upload(path, tsa.tsr, {
            contentType: 'application/timestamp-reply',
            cacheControl: 'private, max-age=0, no-store',
            upsert: true,
        });
    if (upErr) throw new Error(`spot ${stagingId}: storage upload failed: ${upErr.message}`);

    const { error: appendErr } = await admin.rpc('fn_spot_append_storage_path', {
        p_staging_id: stagingId,
        p_path: path,
    });
    if (appendErr) throw new Error(`spot ${stagingId}: append path failed: ${appendErr.message}`);

    const { error: markErr } = await admin
        .from('spot_orders')
        .update({
            tsa_status: 'issued',
            tsa_provider: tsa.providerLabel,
            tsa_url: tsa.urlUsed,
            certified_at: tsa.certifiedAt.toISOString(),
            tsa_error: null,
        })
        .eq('staging_id', stagingId);
    if (markErr) throw markErr;

    log({ event: 'spot.tsa_issued', tsa_provider: tsa.providerLabel, attempts: tsa.attempts });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const log = makeLogger('webhooks/stripe');
    res.setHeader('x-request-id', log.ctx.reqId);

    if (!methodGuard(req, res, ['POST'])) return;

    const sig = (req.headers['stripe-signature'] as string | undefined) ?? '';
    const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');

    // ─── Step 0: signature verification (must be raw body)
    let event: Stripe.Event;
    try {
        const rawBody = await readRawBody(req);
        event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
        log.warn({ event: 'webhook.signature_failed', message: String((err as Error)?.message ?? err) });
        res.status(400).send(`Webhook signature error: ${(err as Error)?.message}`);
        return;
    }

    const admin = getAdminClient();

    // ─── Step 1: UPSERT-with-lock → only proceed when allowed to (re)process
    const { data: lockRows, error: lockErr } = await admin.rpc('fn_lock_stripe_event', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_payload: event as unknown as Record<string, unknown>,
    });
    if (lockErr) {
        log.error({ event: 'webhook.lock_failed', stripeEventId: event.id, message: lockErr.message });
        res.status(500).send('Lock failed');
        return;
    }
    const locked = Array.isArray(lockRows) ? lockRows[0] : null;
    if (!locked) {
        // Either status='received' (another worker is racing) OR status='processed'
        // (true duplicate). Both are safe to acknowledge with 200.
        log.info({ event: 'webhook.skip_duplicate_or_processed', stripeEventId: event.id });
        json(res, 200, { received: true, deduped: true });
        return;
    }

    // ─── Step 2: dispatch
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const meta = (session.metadata ?? {}) as Record<string, string>;
                const kind = meta.kind ?? 'subscription';

                if (kind === 'spot') {
                    await applySpotOrderPaid({
                        sessionId: session.id,
                        paymentIntentId: typeof session.payment_intent === 'string'
                            ? session.payment_intent
                            : (session.payment_intent?.id ?? null),
                        stagingId: meta.staging_id ?? '',
                        sha256: meta.sha256 ?? '',
                        filename: meta.filename ?? '',
                        email: session.customer_details?.email ?? session.customer_email ?? null,
                        amountTotal: session.amount_total ?? null,
                        currency: session.currency ?? null,
                    });
                    // Critical: TSA after payment so Spot ZIP has timestamp.tsr.
                    await issueSpotTimestamp({
                        stagingId: meta.staging_id ?? '',
                        sha256: meta.sha256 ?? '',
                        reqId: log.ctx.reqId,
                    });
                } else if (meta.user_id && (meta.plan === 'creator' || meta.plan === 'studio')) {
                    await applyPlanGrant({
                        user_id: meta.user_id,
                        plan: meta.plan,
                        stripe_customer_id: typeof session.customer === 'string'
                            ? session.customer
                            : (session.customer?.id ?? null),
                        stripe_subscription_id: typeof session.subscription === 'string'
                            ? session.subscription
                            : (session.subscription?.id ?? null),
                    });
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const sub = event.data.object as Stripe.Subscription;
                const meta = (sub.metadata ?? {}) as Record<string, string>;
                const userId = meta.user_id ?? '';
                const plan =
                    (meta.plan === 'studio' ? 'studio' : meta.plan === 'creator' ? 'creator' : null) as PlanGrant['plan'] | null;
                const active = ['active', 'trialing', 'past_due'].includes(sub.status);

                if (userId && plan) {
                    await applyPlanGrant({
                        user_id: userId,
                        plan: active ? plan : 'free',
                        stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null),
                        stripe_subscription_id: sub.id,
                        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                    });
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object as Stripe.Subscription;
                const meta = (sub.metadata ?? {}) as Record<string, string>;
                if (meta.user_id) {
                    // サブスクリプションIDと契約期間を明示的に null で初期化し、DBに亡霊データを残さない
                    await applyPlanGrant({ 
                        user_id: meta.user_id, 
                        plan: 'free', 
                        stripe_subscription_id: null,
                        current_period_end: null 
                    });
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                log.warn({ event: 'invoice.payment_failed', customer: invoice.customer, subscription: invoice.subscription });
                break;
            }

            default:
                log.info({ event: 'webhook.unhandled', type: event.type });
        }

        // ─── Step 3: mark as processed (terminal success state)
        const { error: markErr } = await admin.rpc('fn_mark_stripe_event_processed', { p_event_id: event.id });
        if (markErr) {
            log.warn({ event: 'webhook.mark_processed_failed', stripeEventId: event.id, message: markErr.message });
        }

        json(res, 200, { received: true });
    } catch (err) {
        const message = String((err as Error)?.message ?? err);
        log.error({ event: 'webhook.dispatch_error', stripeEventId: event.id, message });

        await admin.rpc('fn_mark_stripe_event_failed', { p_event_id: event.id, p_error: message });

        // 5xx → Stripe retries; the lock RPC will flip 'failed' back to 'received'.
        res.status(500).send('Webhook handler failed');
    }
}
