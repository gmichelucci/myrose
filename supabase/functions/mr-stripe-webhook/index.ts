// Webhook exclusivo do MyRose para eventos Stripe
// Isolado de projetos irmãos na mesma conta Stripe: ignora silenciosamente (HTTP 200) eventos sem metadata.app='myrose' nem vínculo em public.mr_studios.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^17.0.0';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('MR_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('MR_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const stripeKey = Deno.env.get('MR_STRIPE_SECRET_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const webhookSecret = Deno.env.get('MR_STRIPE_WEBHOOK_SECRET') ?? Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

  if (!supabaseUrl || !serviceKey || !stripeKey || !webhookSecret) {
    return json({ error: 'Secrets Stripe do MyRose não configurados' }, 500);
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return json({ error: 'Cabeçalho stripe-signature ausente' }, 400);

  const bodyText = await req.text();
  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(bodyText, sig, webhookSecret);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Assinatura inválida' }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey);

  // Resolve se o evento realmente pertence ao MyRose antes de registrar idempotência
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.app !== 'myrose') {
      return json({ received: true, ignored: 'not_myrose' });
    }
    const studioId = session.metadata?.studio_id ?? session.client_reference_id;
    if (!studioId) return json({ received: true, ignored: 'missing_studio_id' });

    const { error: dupErr } = await db.from('mr_stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      studio_id: studioId,
    });
    if (dupErr?.code === '23505') return json({ received: true, duplicate: true });

    if (session.payment_status === 'unpaid') {
      return json({ received: true, status: 'awaiting_payment' });
    }

    let subStatus = 'active';
    let periodEnd: string | null = null;
    const subId = typeof session.subscription === 'string' ? session.subscription : null;
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      subStatus = sub.status;
      periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    }

    await db
      .from('mr_studios')
      .update({
        plan_id: session.metadata?.plan_id ?? 'starter',
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_subscription_id: subId,
        subscription_status: subStatus,
        plan_interval: session.metadata?.interval ?? 'month',
        plan_current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studioId);

    return json({ received: true, updated: studioId });
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === 'string' ? sub.customer : null;

    let studioId = sub.metadata?.app === 'myrose' ? sub.metadata?.studio_id : undefined;
    if (!studioId && customerId) {
      const { data: found } = await db
        .from('mr_studios')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      studioId = found?.id;
    }
    if (!studioId) {
      return json({ received: true, ignored: 'not_myrose' });
    }

    const { error: dupErr } = await db.from('mr_stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      studio_id: studioId,
    });
    if (dupErr?.code === '23505') return json({ received: true, duplicate: true });

    const item = sub.items?.data?.[0];
    const priceId = item?.price?.id;
    let planId = sub.metadata?.plan_id ?? null;

    if (priceId) {
      const { data: matchedPlan } = await db
        .from('mr_plans')
        .select('id')
        .or(`stripe_monthly_price_id.eq.${priceId},stripe_annual_price_id.eq.${priceId}`)
        .maybeSingle();
      if (matchedPlan?.id) planId = matchedPlan.id;
    }

    const downgraded =
      event.type === 'customer.subscription.deleted' ||
      ['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status);

    await db
      .from('mr_studios')
      .update({
        plan_id: downgraded ? 'gratuito' : planId ?? 'starter',
        stripe_customer_id: customerId,
        stripe_subscription_id: downgraded ? null : sub.id,
        subscription_status: sub.status,
        plan_interval: item?.price?.recurring?.interval ?? sub.metadata?.interval ?? 'month',
        plan_current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studioId);

    return json({ received: true, updated: studioId });
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
    if (!customerId) return json({ received: true, ignored: 'no_customer' });

    const { data: studio } = await db
      .from('mr_studios')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (!studio) return json({ received: true, ignored: 'not_myrose' });

    await db
      .from('mr_studios')
      .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
      .eq('id', studio.id);
    return json({ received: true, flagged: studio.id });
  }

  return json({ received: true, ignored: event.type });
});
