/**
 * POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout session for:
 *  - Creator / Studio: monthly subscription (requires authenticated user)
 *  - Spot: one-shot payment (guest allowed; sha256 + filename are pre-staged)
 *
 * Idempotency:
 *  - subscription: keyed by (userId, plan)
 *  - spot: keyed by (sha256 || nanoid)
 *
 * Security:
 *  - Origin guard against unknown referrers.
 *  - For paid subscriptions, JWT must be valid and present.
 *  - Stripe customer is reused if already linked to this user.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import {
    HttpError,
    getAdminClient,
    isAllowedOrigin,
    json,
    makeLogger,
    methodGuard,
    optionalEnv,
    tryUser,
    requireUser,
} from './_lib/server.js';
import { appUrl, getStripe, resolvePlan, type SupportedPlan } from './_lib/stripe.js';

interface RequestBody {
    plan: string;
    // Spot-only, optional pre-staged metadata
    sha256?: string;
    filename?: string;
    spotEmail?: string;
}

const HEX64 = /^[0-9a-f]{64}$/;

function parseBody(body: unknown): RequestBody {
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid request body');
    const b = body as Record<string, unknown>;
    if (typeof b.plan !== 'string') throw new HttpError(400, 'plan is required');
    const out: RequestBody = { plan: b.plan };
    if (typeof b.sha256 === 'string') {
        const lowered = b.sha256.toLowerCase();
        if (!HEX64.test(lowered)) throw new HttpError(400, 'sha256 must be 64-char hex');
        out.sha256 = lowered;
    }
    if (typeof b.filename === 'string') out.filename = b.filename.slice(0, 255);
    if (typeof b.spotEmail === 'string') {
        const email = b.spotEmail.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new HttpError(400, 'spotEmail is not a valid email');
        }
        out.spotEmail = email || undefined;
    }
    return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

    const log = makeLogger('create-checkout-session');
    res.setHeader('x-request-id', log.ctx.reqId);

    if (!methodGuard(req, res, ['POST'])) return;

    const origin = (req.headers.origin as string | undefined) ?? '';
    if (origin && !isAllowedOrigin(origin)) {
        json(res, 403, { error: 'Origin not allowed', reqId: log.ctx.reqId });
        return;
    }

    try {
        const body = parseBody(req.body);
        const plan = resolvePlan(body.plan) as { id: SupportedPlan; mode: 'subscription' | 'payment'; priceId: string };
        const stripe = getStripe();
        const admin = getAdminClient();
        const base = appUrl();

        // Subscription: enforce auth & reuse customer.
        if (plan.mode === 'subscription') {
            const user = await requireUser(req);

            const { data: profile } = await admin
                .from('profiles')
                .select('id, stripe_customer_id, email')
                .eq('id', user.id)
                .maybeSingle();

            let customerId = profile?.stripe_customer_id ?? null;
            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: user.email ?? profile?.email ?? undefined,
                    metadata: { user_id: user.id },
                });
                customerId = customer.id;
                await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
            }

            const idempotencyKey = `sub:${user.id}:${plan.id}`;

            const session = await stripe.checkout.sessions.create(
                {
                    mode: 'subscription',
                    customer: customerId,
                    line_items: [{ price: plan.priceId, quantity: 1 }],
                    success_url: `${base}/dashboard?upgrade=success&plan=${plan.id}`,
                    cancel_url: `${base}/pricing?upgrade=canceled`,
                    allow_promotion_codes: true,
                    billing_address_collection: 'auto',
                    metadata: { user_id: user.id, plan: plan.id, kind: 'subscription' },
                    subscription_data: { metadata: { user_id: user.id, plan: plan.id } },
                },
                { idempotencyKey },
            );

            log.info({ event: 'checkout.subscription.created', userId: user.id, plan: plan.id, sessionId: session.id });
            json(res, 200, { url: session.url, sessionId: session.id, reqId: log.ctx.reqId });
            return;
        }

        // Spot (guest allowed)
        const user = await tryUser(req);
        const stagingId = randomUUID();
        const sha256 = body.sha256 ?? '';
        const idempotencyKey = `spot:${stagingId}`;

        const session = await stripe.checkout.sessions.create(
            {
                mode: 'payment',
                line_items: [{ price: plan.priceId, quantity: 1 }],
                success_url: `${base}/spot-issue/result?sid={CHECKOUT_SESSION_ID}`,
                cancel_url: `${base}/spot-issue?canceled=1`,
                customer_email: body.spotEmail,
                allow_promotion_codes: true,
                metadata: {
                    kind: 'spot',
                    plan: plan.id,
                    staging_id: stagingId,
                    sha256,
                    filename: body.filename ?? '',
                    user_id: user?.id ?? '',
                },
                payment_intent_data: {
                    metadata: {
                        kind: 'spot',
                        staging_id: stagingId,
                        sha256,
                    },
                },
            },
            { idempotencyKey },
        );

        log.info({ event: 'checkout.spot.created', sessionId: session.id, stagingId, sha256: sha256 ? sha256.slice(0, 12) : '' });
        json(res, 200, { url: session.url, sessionId: session.id, stagingId, reqId: log.ctx.reqId });
    } catch (error) {
        if (error instanceof HttpError) {
            json(res, error.status, { error: error.message, reqId: log.ctx.reqId });
            return;
        }
        log.error({ event: 'checkout.error', message: String((error as Error)?.message ?? error) });
        json(res, 500, { error: 'Internal error', reqId: log.ctx.reqId });
    }
}

// Vercel Node runtime needs default body parser for JSON.
export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };
