/**
 * ─────────────────────────────────────────────────────────────────────────────
 * app/api/webhooks/stripe/route.ts
 * Blueprint §IV.3 — ProofMark Stripe Webhook Fortress (The Perfected Forge)
 *
 * Runtime:   Node.js (Stripe SDK は Edge Runtime 非対応)
 * Idempotency: fn_lock_stripe_event によるゾンビロック解除付き排他制御
 * Resolution: profiles.stripe_customer_id による Reverse Lookup
 * Time Source: event.created (Unix timestamp) — never Date.now()
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Stripe クライアント初期化 ─────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

// ── Supabase Service Role クライアント (RLS 完全バイパス) ──────────────────────
function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('[Stripe Webhook] SUPABASE env vars missing');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ── Utilities: User Resolution & Billing ─────────────────────────────────────
async function resolveUserByCustomerId(
  supabase: ReturnType<typeof getServiceSupabase>,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !data) {
    return null;
  }
  return data.id as string;
}

interface BillingUpdate {
  plan_tier?: string;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string;
  stripe_current_period_end?: string | null;
}

async function updateProfileBilling(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  update: BillingUpdate,
): Promise<void> {
  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) {
    throw new Error(`Profile billing update failed: ${error.message}`);
  }
}

function resolvePlanTier(priceId: string): string {
  const map: Record<string, string> = {
    [process.env.STRIPE_PRICE_LIGHT ?? '__none_light__']: 'light',
    [process.env.STRIPE_PRICE_CREATOR ?? '__none_creator__']: 'creator',
    [process.env.STRIPE_PRICE_STUDIO ?? '__none_studio__']: 'studio',
  };
  return map[priceId] ?? 'free';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST Handler: The Absolute Fortress
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(req: Request): Promise<NextResponse> {
  // 1. Raw Body Acquisition (req.json() は署名検証を破壊するため絶対禁止)
  const rawBody = await req.text();
  const stripeSignature = req.headers.get('stripe-signature');

  if (!stripeSignature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Stripe Webhook] Secret not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // 2. Stripe Signature Verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown signature error';
    console.error('[Stripe Webhook] Signature failure:', message);
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  // 3. Supabase Service Role Init
  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Supabase init error' }, { status: 500 });
  }

  // 4. The Core Lock (Idempotency Guard via RPC)
  const { data: lockData, error: lockError } = await supabase.rpc('fn_lock_stripe_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_payload: event as unknown as Record<string, unknown>,
  });

  if (lockError) {
    console.error('[Stripe Webhook] Core Lock failure:', lockError);
    return NextResponse.json({ error: 'Failed to acquire idempotency lock' }, { status: 500 });
  }

  // fn_lock_stripe_event は競合時（既に処理済・処理中）に何も返さない
  // 返却データがない = ロック取得失敗 = 処理スキップ
  if (!lockData || (Array.isArray(lockData) && lockData.length === 0)) {
    console.info(`[Stripe Webhook] Event ${event.id} locked by another process or already processed. Skipping.`);
    return NextResponse.json({ received: true, skipped: true }, { status: 200 });
  }

  // 5. Event Routing & Mutation
  try {
    switch (event.type) {
      
      // ━━ checkout.session.completed ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Spot 決済ルート (The Spot Resolver RPC)
        if (session.mode === 'payment') {
          const certificateId = session.metadata?.certificate_id;
          if (certificateId) {
            const { error: spotError } = await supabase.rpc('fn_fulfill_spot_payment', {
              p_event_id: event.id,
              p_certificate_id: certificateId,
            });

            if (spotError) {
              throw new Error(`Spot fulfillment failed: ${spotError.message}`);
            }
            console.info(`[Stripe Webhook] Spot payment fulfilled for certificate: ${certificateId}`);
          }
          break;
        }

        // サブスクリプション決済ルート
        if (session.mode === 'subscription') {
          const customerId = typeof session.customer === 'string' 
            ? session.customer 
            : (session.customer as Stripe.Customer | null)?.id ?? null;

          if (!customerId) throw new Error('Missing customer id');

          const userId = await resolveUserByCustomerId(supabase, customerId);

          if (!userId) {
            const metaUserId = session.metadata?.user_id;
            if (metaUserId) {
              const subscriptionId = typeof session.subscription === 'string'
                ? session.subscription
                : (session.subscription as Stripe.Subscription | null)?.id ?? null;

              await updateProfileBilling(supabase, metaUserId, {
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
              });
              console.info(`[Stripe Webhook] Linked new customer ${customerId} to user ${metaUserId}`);
            } else {
              throw new Error(`Cannot resolve user for customer ${customerId}`);
            }
          }
        }
        break;
      }

      // ━━ customer.subscription.created / updated ━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer as Stripe.Customer).id;

        const userId = await resolveUserByCustomerId(supabase, customerId);
        if (!userId) throw new Error(`Cannot resolve user for customer ${customerId}`);

        const priceId = subscription.items.data[0]?.price.id ?? '';
        const planTier = resolvePlanTier(priceId);
        
        // サーバーの現在時刻ではなく Stripe の不変なタイムスタンプを利用
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        const isActive = ['active', 'trialing'].includes(subscription.status);
        const effectivePlan = isActive ? planTier : 'free';

        await updateProfileBilling(supabase, userId, {
          plan_tier: effectivePlan,
          stripe_subscription_id: subscription.id,
          stripe_current_period_end: periodEnd,
        });

        console.info(`[Stripe Webhook] User ${userId} plan updated to ${effectivePlan}`);
        break;
      }

      // ━━ customer.subscription.deleted ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer as Stripe.Customer).id;

        const userId = await resolveUserByCustomerId(supabase, customerId);
        if (!userId) throw new Error(`Cannot resolve user for customer ${customerId}`);

        await updateProfileBilling(supabase, userId, {
          plan_tier: 'free',
          stripe_subscription_id: null,
          stripe_current_period_end: null,
        });

        console.info(`[Stripe Webhook] User ${userId} subscription deleted. Downgraded to free.`);
        break;
      }
    }

    // 6. The Committer (成功の記録)
    const { error: markError } = await supabase.rpc('fn_mark_stripe_event_processed', {
      p_event_id: event.id
    });

    if (markError) {
      console.error(`[Stripe Webhook] Failed to mark event ${event.id} as processed:`, markError);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (err: unknown) {
    // 7. The Fallback (失敗の記録)
    const message = err instanceof Error ? err.message : 'Unknown processing error';
    console.error(`[Stripe Webhook] Processing error for event ${event.id}:`, message);

    await supabase.rpc('fn_mark_stripe_event_failed', {
      p_event_id: event.id,
      p_error: message
    });

    return NextResponse.json({ error: 'Processing failed', detail: message }, { status: 500 });
  }
}