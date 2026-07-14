/**
 * api/_lib/stripe.ts
 *
 * - Single source of truth for Stripe client.
 * - Maps internal plan IDs to Stripe price IDs (env-driven).
 * - Stable price ID resolution to keep Pricing UI loosely coupled to Stripe.
 *
 * Env required (set in Vercel Project Settings):
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   STRIPE_PRICE_CREATOR_MONTHLY
 *   STRIPE_PRICE_STUDIO_MONTHLY
 *   STRIPE_PRICE_SPOT
 *   APP_URL                       // e.g. https://proofmark.jp
 */

import Stripe from 'stripe';
import { requireEnv } from './server.js';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (_stripe) return _stripe;
    _stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
        apiVersion: '2025-01-27.acacia' as any,
        typescript: true,
        appInfo: { name: 'ProofMark', version: '1.0.0', url: 'https://proofmark.jp' },
    });
    return _stripe;
}

export type SupportedPlan = 'creator' | 'studio' | 'spot';

interface PlanDescriptor {
    mode: 'subscription' | 'payment';
    envPriceKey: string;
    description: string;
}

const PLAN_MAP: Record<SupportedPlan, PlanDescriptor> = {
    creator: {
        mode: 'subscription',
        envPriceKey: 'STRIPE_PRICE_CREATOR_MONTHLY',
        description: 'ProofMark Creator (monthly)',
    },
    studio: {
        mode: 'subscription',
        envPriceKey: 'STRIPE_PRICE_STUDIO_MONTHLY',
        description: 'ProofMark Studio (monthly)',
    },
    spot: {
        mode: 'payment',
        envPriceKey: 'STRIPE_PRICE_SPOT',
        description: 'ProofMark Spot — one-shot Evidence Pack',
    },
};

export function resolvePlan(plan: string): { id: SupportedPlan; mode: 'subscription' | 'payment'; priceId: string; description: string } {
    if (!Object.prototype.hasOwnProperty.call(PLAN_MAP, plan)) {
        throw new Error(`Unsupported plan: ${plan}`);
    }
    const id = plan as SupportedPlan;
    const desc = PLAN_MAP[id];
    return {
        id,
        mode: desc.mode,
        priceId: requireEnv(desc.envPriceKey),
        description: desc.description,
    };
}

export const SUPPORTED_PLAN_IDS: SupportedPlan[] = ['creator', 'studio', 'spot'];

export function appUrl(): string {
    // Vercel特有の「デプロイURLへのリダイレクト（別ドメインによるセッション喪失）」を防ぐ最強のフォールバック
    const url = process.env.APP_URL 
        || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return url.replace(/\/$/, '');
}
