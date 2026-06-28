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
import { getStripe } from './_lib/stripe.js';

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
        const planId = body.plan;

        let mode: 'payment' | 'subscription';
        let priceId: string;
        if (planId === 'spot') {
            mode = 'payment';
            priceId = process.env.STRIPE_PRICE_SPOT ?? '';
        } else if (planId === 'creator') {
            mode = 'subscription';
            priceId = process.env.STRIPE_PRICE_CREATOR ?? '';
        } else if (planId === 'studio') {
            mode = 'subscription';
            priceId = process.env.STRIPE_PRICE_STUDIO ?? '';
        } else {
            throw new HttpError(400, 'Invalid plan');
        }
        if (!priceId) throw new HttpError(500, `Missing price ID for ${planId}`);

        const stripe = getStripe();
        const admin = getAdminClient();
        const base = process.env.APP_URL
            || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        // Subscription: enforce auth & reuse customer.
        if (mode === 'subscription') {
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

            const session = await stripe.checkout.sessions.create(
                {
                    mode: 'subscription',
                    customer: customerId,
                    client_reference_id: user.id,
                    line_items: [{ price: priceId, quantity: 1 }],
                    success_url: `${base}/dashboard?upgrade=success&plan=${planId}`,
                    cancel_url: `${base}/pricing?upgrade=canceled`,
                    allow_promotion_codes: true,
                    billing_address_collection: 'auto',
                    metadata: { user_id: user.id, plan: planId, kind: 'subscription' },
                    subscription_data: { metadata: { user_id: user.id, plan: planId } },
                }
            );

            log.info({ event: 'checkout.subscription.created', userId: user.id, plan: planId, sessionId: session.id });
            json(res, 200, { url: session.url, sessionId: session.id, reqId: log.ctx.reqId });
            return;
        }

        // Spot (guest allowed)
        const user = await tryUser(req);
        const stagingId = randomUUID();
        const sha256 = body.sha256 ?? '';

        const session = await stripe.checkout.sessions.create(
            {
                mode: 'payment',
                ...(user?.id ? { client_reference_id: user.id } : {}),
                line_items: [{ price: priceId, quantity: 1 }],
                success_url: `${base}/spot-issue/result?sid={CHECKOUT_SESSION_ID}`,
                cancel_url: `${base}/spot-issue?canceled=1`,
                customer_email: body.spotEmail,
                allow_promotion_codes: true,
                metadata: {
                    kind: 'spot',
                    plan: planId,
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
            }
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
export const config = {
    runtime: 'nodejs',
    maxDuration: 15,
    api: { bodyParser: { sizeLimit: '32kb' } }
};
