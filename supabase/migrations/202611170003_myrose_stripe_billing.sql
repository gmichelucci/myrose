ALTER TABLE public.mr_plans
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_annual_price_id text;

ALTER TABLE public.mr_studios
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_interval text,
  ADD COLUMN IF NOT EXISTS plan_current_period_end timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pub_mr_studios_stripe_cust
  ON public.mr_studios (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pub_mr_studios_stripe_sub
  ON public.mr_studios (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mr_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  studio_id uuid REFERENCES public.mr_studios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pub_mr_stripe_events_studio
  ON public.mr_stripe_events (studio_id);

ALTER TABLE public.mr_stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mr_stripe_events FROM PUBLIC, anon, authenticated;
CREATE POLICY mr_stripe_events_service_only ON public.mr_stripe_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.mr_protect_studio_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) = 'authenticated' THEN
    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
       OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
       OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
       OR NEW.plan_interval IS DISTINCT FROM OLD.plan_interval
       OR NEW.plan_current_period_end IS DISTINCT FROM OLD.plan_current_period_end THEN
      RAISE EXCEPTION 'Plano e assinatura só podem ser alterados após confirmação no checkout.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mr_protect_studio_billing() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_mr_protect_studio_billing
  BEFORE UPDATE ON public.mr_studios
  FOR EACH ROW EXECUTE FUNCTION public.mr_protect_studio_billing();
