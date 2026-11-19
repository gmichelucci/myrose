// Edge Function autenticada do MyRose para Stripe Checkout, Sync e Customer Portal
// Isolada via prefixo mr_* no banco e metadata.app = 'myrose' na Stripe compartilhada.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^17.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function resolveBaseUrl(req: Request, rawOrigin?: string): string {
  const candidate = (rawOrigin ?? req.headers.get('origin') ?? '').trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.origin;
    }
  } catch {
    // cai no fallback abaixo
  }
  return 'https://myrose-app.pages.dev';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('MR_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('MR_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Backend Supabase não configurado' }, 500);

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ error: 'Sessão ausente' }, 401);

  const db = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !userData?.user) return json({ error: 'Sessão inválida' }, 401);

  const stripeKey = Deno.env.get('MR_STRIPE_SECRET_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  if (!stripeKey) {
    return json({ error: 'Chave STRIPE_SECRET_KEY ainda não configurada nos Secrets do Supabase.' }, 503);
  }

  const { data: studio, error: studioErr } = await db
    .from('mr_studios')
    .select('id, owner_name, business_name, email, plan_id, stripe_customer_id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();

  if (studioErr) return json({ error: studioErr.message }, 500);
  if (!studio) return json({ error: 'Apenas a proprietária do estúdio pode gerenciar a assinatura.' }, 403);

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    const body = await req.json();
    const action = String(body.action ?? 'checkout');
    const baseUrl = resolveBaseUrl(req, body.returnOrigin ? String(body.returnOrigin) : undefined);

    if (action === 'portal') {
      if (!studio.stripe_customer_id) {
        return json({ error: 'Este estúdio ainda não possui assinatura ativa na Stripe.' }, 400);
      }
      const portalConfig = Deno.env.get('MR_STRIPE_PORTAL_CONFIG_ID');
      const portal = await stripe.billingPortal.sessions.create({
        customer: studio.stripe_customer_id,
        ...(portalConfig ? { configuration: portalConfig } : {}),
        return_url: `${baseUrl}/configuracoes`,
      });
      return json({ url: portal.url });
    }

    if (action === 'sync') {
      const sessionId = String(body.sessionId ?? '').trim();
      if (!sessionId) return json({ error: 'sessionId obrigatório' }, 400);

      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
      if (session.metadata?.app !== 'myrose' || session.metadata?.studio_id !== studio.id) {
        return json({ error: 'Sessão não pertence a este estúdio' }, 403);
      }

      const sub = typeof session.subscription === 'object' && session.subscription ? session.subscription : null;
      const planId = session.metadata?.plan_id ?? sub?.metadata?.plan_id;
      const subStatus = sub?.status ?? (session.payment_status === 'paid' ? 'active' : 'free');
      const isActive = ['active', 'trialing'].includes(subStatus);

      if (isActive && planId) {
        const periodEnd = sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await db
          .from('mr_studios')
          .update({
            plan_id: planId,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : studio.stripe_customer_id,
            stripe_subscription_id: sub?.id ?? null,
            subscription_status: subStatus,
            plan_interval: session.metadata?.interval ?? 'month',
            plan_current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', studio.id);
      }
      return json({ synced: isActive, planId: isActive ? planId : studio.plan_id, status: subStatus });
    }

    if (action === 'checkout') {
      const planId = String(body.planId ?? '');
      const interval = body.interval === 'year' ? 'year' : 'month';
      if (!['starter', 'premium', 'profissional'].includes(planId)) {
        return json({ error: 'Plano inválido para checkout' }, 400);
      }

      const { data: plan, error: planErr } = await db
        .from('mr_plans')
        .select('id, name, monthly_price_cents, annual_price_cents, stripe_monthly_price_id, stripe_annual_price_id')
        .eq('id', planId)
        .single();

      if (planErr || !plan) return json({ error: 'Plano não encontrado' }, 404);

      let customerId = studio.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: studio.email || userData.user.email,
          name: studio.business_name,
          metadata: { app: 'myrose', studio_id: studio.id },
        });
        customerId = customer.id;
        await db.from('mr_studios').update({ stripe_customer_id: customerId }).eq('id', studio.id);
      }

      const savedPriceId = interval === 'year' ? plan.stripe_annual_price_id : plan.stripe_monthly_price_id;
      const unitAmount = interval === 'year' ? plan.annual_price_cents : plan.monthly_price_cents;

      const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = savedPriceId
        ? { price: savedPriceId, quantity: 1 }
        : {
            price_data: {
              currency: 'brl',
              unit_amount: unitAmount,
              recurring: { interval },
              product_data: {
                name: `MyRose — Plano ${plan.name}`,
                metadata: { app: 'myrose', plan_id: plan.id },
              },
            },
            quantity: 1,
          };

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: studio.id,
        allow_promotion_codes: true,
        line_items: [lineItem],
        metadata: {
          app: 'myrose',
          studio_id: studio.id,
          plan_id: plan.id,
          interval,
        },
        subscription_data: {
          metadata: {
            app: 'myrose',
            studio_id: studio.id,
            plan_id: plan.id,
            interval,
          },
        },
        success_url: `${baseUrl}/configuracoes?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/configuracoes?checkout=canceled`,
      });

      return json({ url: session.url, sessionId: session.id });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro interno no faturamento' }, 500);
  }
});
