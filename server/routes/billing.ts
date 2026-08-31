import express, { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { env } from '../env';
import { asyncRoute, billingRateLimit, validateBody } from '../security';
import { requireAuth, requireRole, requireSensitiveAuth, requireWorkspace, supabaseAdmin, type AuthenticatedRequest, writeAudit } from '../supabase';

export const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const PLAN_FEATURES: Record<'starter'|'growth'|'operator', Record<string, number | boolean>> = {
  starter: {
    'crm.core': true,
    'lead.capture': true,
    'ai.basic': true,
    'booking.core': true,
    'automations.advanced': false,
    'operator.full': false,
    'usage.users': 2,
    'usage.sms': 250,
    'usage.ai_actions': 250,
  },
  growth: {
    'crm.core': true,
    'lead.capture': true,
    'ai.basic': true,
    'booking.core': true,
    'automations.advanced': true,
    'operator.full': false,
    'usage.users': 8,
    'usage.sms': 1000,
    'usage.ai_actions': 1500,
  },
  operator: {
    'crm.core': true,
    'lead.capture': true,
    'ai.basic': true,
    'booking.core': true,
    'automations.advanced': true,
    'operator.full': true,
    'usage.users': 25,
    'usage.sms': 4000,
    'usage.ai_actions': 10000,
  },
};

function priceForPlan(plan: keyof typeof PLAN_FEATURES) {
  return {
    starter: env.STRIPE_PRICE_STARTER,
    growth: env.STRIPE_PRICE_GROWTH,
    operator: env.STRIPE_PRICE_OPERATOR,
  }[plan];
}

function planForPrice(priceId: string | null | undefined): keyof typeof PLAN_FEATURES | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === env.STRIPE_PRICE_GROWTH) return 'growth';
  if (priceId === env.STRIPE_PRICE_OPERATOR) return 'operator';
  return null;
}

function stripeStatus(status: string) {
  const allowed = new Set(['trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused']);
  return allowed.has(status) ? status : 'incomplete';
}

async function applySubscription(subscription: Stripe.Subscription) {
  const sub = subscription as any;
  const priceId = subscription.items.data[0]?.price?.id || null;
  const plan = planForPrice(priceId) || (subscription.metadata?.plan as keyof typeof PLAN_FEATURES | undefined);
  const workspaceId = subscription.metadata?.workspace_id;
  if (!workspaceId || !plan || !PLAN_FEATURES[plan]) throw new Error('SUBSCRIPTION_METADATA_INVALID');

  const { error } = await supabaseAdmin.rpc('apply_subscription_state', {
    target_workspace: workspaceId,
    target_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    target_subscription_id: subscription.id,
    target_price_id: priceId,
    target_plan: plan,
    target_status: stripeStatus(subscription.status),
    target_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    target_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    target_entitlements: PLAN_FEATURES[plan],
  });
  if (error) throw new Error(`SUBSCRIPTION_APPLY_FAILED:${error.message}`);
}

export const stripeWebhookRouter = Router();
stripeWebhookRouter.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), asyncRoute(async (req, res) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) return res.status(400).json({ error: 'STRIPE_SIGNATURE_MISSING' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: 'INVALID_STRIPE_SIGNATURE' });
  }

  const { data: claim, error: claimError } = await supabaseAdmin.rpc('claim_stripe_webhook_event', {
    target_event_id: event.id,
    target_event_type: event.type,
    target_payload: event as any,
  });
  if (claimError) return res.status(500).json({ error: 'STRIPE_EVENT_CLAIM_FAILED' });
  if (claim !== 'claimed') return res.json({ received: true, duplicate: claim === 'duplicate', inProgress: claim === 'in_progress' });

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspace_id || session.client_reference_id;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!workspaceId || !subscriptionId) throw new Error('CHECKOUT_METADATA_INVALID');
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await applySubscription(subscription);
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const eventSubscription = event.data.object as Stripe.Subscription;
      const currentSubscription = await stripe.subscriptions.retrieve(eventSubscription.id);
      await applySubscription(currentSubscription);
    }

    if (event.type === 'invoice.payment_failed' || event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const legacySubscription = (invoice as any).subscription;
      const parentSubscription = (invoice as any).parent?.subscription_details?.subscription;
      const subscriptionId = typeof legacySubscription === 'string'
        ? legacySubscription
        : typeof parentSubscription === 'string'
          ? parentSubscription
          : legacySubscription?.id || parentSubscription?.id;
      if (subscriptionId) {
        const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscription(currentSubscription);
      } else if (event.type === 'invoice.payment_failed') {
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          await supabaseAdmin.from('subscriptions').update({
            status: 'past_due',
            grace_period_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('stripe_customer_id', customerId);
        }
      }
    }

    await supabaseAdmin.from('stripe_webhook_events').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      processing_error: null,
    }).eq('stripe_event_id', event.id);
    return res.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown Stripe processing error';
    await supabaseAdmin.from('stripe_webhook_events').update({ status: 'failed', processing_error: message }).eq('stripe_event_id', event.id);
    return res.status(500).json({ error: 'STRIPE_WEBHOOK_PROCESSING_FAILED' });
  }
}));

const router = Router();
router.use(billingRateLimit, requireAuth, requireWorkspace);

router.get('/status', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const [{ data: subscription, error }, { data: entitlements }] = await Promise.all([
    supabaseAdmin.from('subscriptions').select('plan,status,current_period_end,cancel_at_period_end,trial_ends_at,grace_period_ends_at,stripe_customer_id,stripe_subscription_id,updated_at').eq('workspace_id', req.workspaceId!).maybeSingle(),
    supabaseAdmin.from('subscription_entitlements').select('feature_key,enabled,limit_value').eq('workspace_id', req.workspaceId!),
  ]);
  if (error) return res.status(500).json({ error: 'SUBSCRIPTION_READ_FAILED' });
  res.json({ subscription, entitlements: entitlements ?? [], stripeConfigured: Boolean(stripe) });
}));

router.post('/checkout', requireRole('owner','admin'), requireSensitiveAuth, validateBody(z.object({
  plan: z.enum(['starter','growth','operator']),
})), asyncRoute(async (req: AuthenticatedRequest, res) => {
  if (!stripe) return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
  const plan = req.body.plan as keyof typeof PLAN_FEATURES;
  const price = priceForPlan(plan);
  if (!price || !price.startsWith('price_')) return res.status(503).json({ error: 'STRIPE_PRICE_NOT_CONFIGURED', plan });

  const { data: existingSub, error: subError } = await supabaseAdmin.from('subscriptions')
    .select('stripe_customer_id,stripe_subscription_id,status')
    .eq('workspace_id', req.workspaceId!).maybeSingle();
  if (subError) return res.status(500).json({ error: 'SUBSCRIPTION_READ_FAILED' });
  if (existingSub?.stripe_subscription_id && ['active','trialing','past_due'].includes(existingSub.status)) {
    return res.status(409).json({ error: 'ACTIVE_SUBSCRIPTION_EXISTS', usePortal: true });
  }

  let customerId = existingSub?.stripe_customer_id || null;
  if (!customerId) {
    const { data: workspace } = await supabaseAdmin.from('workspaces').select('name').eq('id', req.workspaceId!).single();
    const customer = await stripe.customers.create({
      email: req.auth!.email || undefined,
      name: workspace?.name || undefined,
      metadata: { workspace_id: req.workspaceId! },
    }, { idempotencyKey: `customer:${req.workspaceId}` });
    customerId = customer.id;
    await supabaseAdmin.from('subscriptions').upsert({
      workspace_id: req.workspaceId!,
      stripe_customer_id: customerId,
      plan: 'starter',
      status: 'incomplete',
      updated_at: new Date().toISOString(),
    });
  }

  const providedKey = String(req.header('idempotency-key') || req.requestId || '').slice(0, 200);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${env.APP_URL}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/app/billing?checkout=cancelled`,
    client_reference_id: req.workspaceId!,
    subscription_data: { metadata: { workspace_id: req.workspaceId!, plan } },
    metadata: { workspace_id: req.workspaceId!, plan },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  }, { idempotencyKey: `checkout:${req.workspaceId}:${plan}:${providedKey}` });

  await writeAudit(req, 'billing.checkout.created', 'workspace', req.workspaceId, { plan });
  res.json({ checkoutUrl: session.url });
}));

router.get('/checkout-status', asyncRoute(async (req: AuthenticatedRequest, res) => {
  if (!stripe) return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
  const sessionId = String(req.query.session_id || '');
  if (!sessionId.startsWith('cs_')) return res.status(400).json({ error: 'INVALID_CHECKOUT_SESSION' });
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const ownerWorkspace = session.metadata?.workspace_id || session.client_reference_id;
  if (ownerWorkspace !== req.workspaceId) return res.status(404).json({ error: 'CHECKOUT_SESSION_NOT_FOUND' });
  res.json({ status: session.status, paymentStatus: session.payment_status });
}));

router.post('/portal', requireRole('owner','admin'), requireSensitiveAuth, asyncRoute(async (req: AuthenticatedRequest, res) => {
  if (!stripe) return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
  const { data: subscription } = await supabaseAdmin.from('subscriptions').select('stripe_customer_id').eq('workspace_id', req.workspaceId!).maybeSingle();
  if (!subscription?.stripe_customer_id) return res.status(404).json({ error: 'STRIPE_CUSTOMER_NOT_FOUND' });
  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${env.APP_URL}/app/billing`,
  });
  await writeAudit(req, 'billing.portal.created', 'workspace', req.workspaceId);
  res.json({ portalUrl: portal.url });
}));

export default router;
