/**
 * app/api/webhooks/stripe/route.ts
 * ─────────────────────────────────────────────────────────────────────────
 * The Apex Webhook Receiver (Next.js 15 App Router Edition)
 * * ⚡ Absolute Defenses:
 * 1. Native Raw Body: Next.js 15仕様に準拠し、req.text() で安全に署名検証を実行。
 * 2. Absolute Idempotency (絶対冪等性): 決済日時は new Date() ではなく、
 * 必ず Stripe の event.created (真の決済時刻) を使用し、リトライ時の時間ズレを物理遮断。
 * 3. Strict State Commit: イベントの完了打刻 (processed) に失敗した場合は
 * 絶対に 200 OK を返さず 500 を返し、Stripe に安全なリトライを強制する。
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminClient, makeLogger, requireEnv } from '@/lib/server'; // パスは適宜エイリアス(@/)へ調整
import { getStripe } from '@/lib/stripe';
import { requestTimestampWithFallback } from '@/lib/tsa';

// 👑 Next.js 15 Route Segment Config: タイムアウトの正しい指定方法
export const maxDuration = 300; // 5分

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
            updated_at: new Date().toISOString(), // プロフィール更新日時は現在時刻で正解
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
    eventCreated: number; // 👑 追加: Stripeイベントの真の発生時刻(UNIX秒)
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
            // 👑 The Apex Fix: リトライされても決済時刻がズレない絶対冪等性の担保
            paid_at: new Date(opts.eventCreated * 1000).toISOString(),
        },
        { onConflict: 'staging_id', ignoreDuplicates: false },
    );
    if (error) throw error;
}

async function issueSpotTimestamp(opts: { stagingId: string; sha256: string; reqId: string }) {
    const admin = getAdminClient();
    const { stagingId, sha256, reqId } = opts;
    const log = (event: Record<string, unknown>) =>
        console.log(JSON.stringify({ reqId, route: 'webhooks/stripe', stagingId, ...event }));

    if (!/^[0-9a-f]{64}$/i.test(sha256)) {
        throw new Error(`spot order ${stagingId}: invalid sha256 in metadata`);
    }

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

    let tsa;
    try {
        tsa = await requestTimestampWithFallback(sha256, { log });
    } catch (err) {
        const message = (err as Error)?.message ?? String(err);
        await admin
            .from('spot_orders')
            .update({ tsa_status: 'failed', tsa_error: message.slice(0, 1000) })
            .eq('staging_id', stagingId);
        throw err; // 上位にエラーを伝播させ、Stripeにリトライを要求する
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

// 👑 The Apex Fix: App Router ネイティブの POST ハンドラー
export async function POST(req: Request) {
    const log = makeLogger('webhooks/stripe');
    const reqId = log.ctx?.reqId || crypto.randomUUID();

    const sig = req.headers.get('stripe-signature') ?? '';
    const webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
        // 🛡️ Raw Body の抽出
        const rawBody = await req.text();
        event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
        log.warn({ event: 'webhook.signature_failed', message: String((err as Error)?.message ?? err) });
        return new NextResponse(`Webhook signature error: ${(err as Error)?.message}`, { status: 400 });
    }

    const admin = getAdminClient();

    // ─── Step 1: UPSERT-with-lock
    const { data: lockRows, error: lockErr } = await admin.rpc('fn_lock_stripe_event', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_payload: event as unknown as Record<string, unknown>,
    });

    if (lockErr) {
        log.error({ event: 'webhook.lock_failed', stripeEventId: event.id, message: lockErr.message });
        return new NextResponse('Lock failed', { status: 500 });
    }

    const locked = Array.isArray(lockRows) ? lockRows[0] : null;
    if (!locked) {
        log.info({ event: 'webhook.skip_duplicate_or_processed', stripeEventId: event.id });
        return NextResponse.json({ received: true, deduped: true }, { status: 200 });
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
                        eventCreated: event.created, // 👑 追加: イベント発生時刻
                    });
                    await issueSpotTimestamp({
                        stagingId: meta.staging_id ?? '',
                        sha256: meta.sha256 ?? '',
                        reqId: reqId,
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

        // ─── Step 3: mark as processed
        const { error: markErr } = await admin.rpc('fn_mark_stripe_event_processed', { p_event_id: event.id });
        if (markErr) {
            // 👑 The Apex Fix: 完了打刻に失敗した場合、絶対に200を返さず例外を投げてStripeにリトライさせる
            throw new Error(`Failed to commit 'processed' state to stripe_events: ${markErr.message}`);
        }

        return NextResponse.json({ received: true }, {
            status: 200,
            headers: {
                'x-request-id': reqId,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
            }
        });

    } catch (err) {
        const message = String((err as Error)?.message ?? err);
        log.error({ event: 'webhook.dispatch_error', stripeEventId: event.id, message });

        // エラー状態の打刻。これが失敗しても、ロックの仕様上「received」に留まるため次回の再送でリトライ可能
        const { error: failErr } = await admin.rpc('fn_mark_stripe_event_failed', { p_event_id: event.id, p_error: message });
        if (failErr) {
            log.error({ event: 'webhook.mark_failed_error', stripeEventId: event.id, message: failErr.message });
        }

        return new NextResponse('Webhook handler failed', { status: 500 });
    }
}