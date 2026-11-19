-- MyRose v2.0 — Migration consolidada
-- Tabelas isoladas por prefixo mr_* no schema public + helper SECURITY DEFINER em schema não-exposto myrose
-- Portabilidade: ZERO FKs para tabelas externas ou auth.users; exportável via pg_dump --table='public.mr_*'

CREATE SCHEMA IF NOT EXISTS myrose;
REVOKE ALL ON SCHEMA myrose FROM PUBLIC, anon;

CREATE TABLE IF NOT EXISTS public.mr_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_price_cents integer NOT NULL CHECK (monthly_price_cents >= 0),
  annual_price_cents integer NOT NULL CHECK (annual_price_cents >= 0),
  client_limit integer,
  mapping_limit integer,
  beauty_ai_monthly_limit integer NOT NULL DEFAULT 0,
  bia_monthly_limit integer NOT NULL DEFAULT 0,
  team_limit integer NOT NULL DEFAULT 0,
  inventory_enabled boolean NOT NULL DEFAULT false,
  reminders_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT false
);

INSERT INTO public.mr_plans (
  id, name, monthly_price_cents, annual_price_cents,
  client_limit, mapping_limit, beauty_ai_monthly_limit, bia_monthly_limit, team_limit,
  inventory_enabled, reminders_enabled, whatsapp_enabled
) VALUES
  ('gratuito', 'Gratuito', 0, 0, 5, 5, 0, 0, 0, false, false, false),
  ('starter', 'Starter', 3900, 39600, 30, 30, 30, 150, 0, true, true, false),
  ('premium', 'Premium', 4900, 46800, 100, 100, 100, 450, 3, true, true, true),
  ('profissional', 'Profissional', 9900, 89100, NULL, NULL, 999999, 650, 8, true, true, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.mr_studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL,
  booking_slug text UNIQUE NOT NULL,
  owner_name text NOT NULL,
  business_name text NOT NULL,
  specialty text NOT NULL DEFAULT 'Lash Designer',
  whatsapp text,
  email text NOT NULL,
  plan_id text NOT NULL DEFAULT 'gratuito' REFERENCES public.mr_plans(id),
  currency text NOT NULL DEFAULT 'BRL',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  slot_interval_minutes integer NOT NULL DEFAULT 30 CHECK (slot_interval_minutes >= 10),
  min_advance_hours integer NOT NULL DEFAULT 2 CHECK (min_advance_hours >= 0),
  pix_key text,
  deposit_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (deposit_percent BETWEEN 0 AND 100),
  address text,
  google_review_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mr_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  auth_user_id uuid,
  name text NOT NULL,
  role_title text NOT NULL DEFAULT 'Lash Designer',
  email text NOT NULL,
  whatsapp text,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (commission_percent BETWEEN 0 AND 100),
  separate_agenda boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION myrose.mr_current_studio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.mr_studios WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1),
    (SELECT studio_id FROM public.mr_collaborators WHERE auth_user_id = (SELECT auth.uid()) AND active = true LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION myrose.mr_current_studio_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION myrose.mr_current_studio_id() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.mr_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  whatsapp text NOT NULL,
  birth_date date,
  notes text,
  active boolean NOT NULL DEFAULT true,
  total_spent_cents integer NOT NULL DEFAULT 0,
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mr_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.mr_subservices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.mr_services(id) ON DELETE CASCADE,
  name text NOT NULL,
  details text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  promo_price_cents integer CHECK (promo_price_cents IS NULL OR promo_price_cents >= 0),
  duration_minutes integer NOT NULL DEFAULT 90 CHECK (duration_minutes > 0),
  maintenance_days integer,
  image_path text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.mr_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  active boolean NOT NULL DEFAULT true,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  break_start time DEFAULT '12:00',
  break_end time DEFAULT '13:00',
  UNIQUE (studio_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.mr_blocked_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason text,
  UNIQUE (studio_id, blocked_date)
);

CREATE TABLE IF NOT EXISTS public.mr_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.mr_clients(id) ON DELETE SET NULL,
  collaborator_id uuid REFERENCES public.mr_collaborators(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_whatsapp text NOT NULL DEFAULT '',
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'realizado', 'cancelado')),
  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  deposit_paid_cents integer NOT NULL DEFAULT 0 CHECK (deposit_paid_cents >= 0),
  payment_method text NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mr_appointment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.mr_appointments(id) ON DELETE CASCADE,
  subservice_id uuid REFERENCES public.mr_subservices(id) ON DELETE SET NULL,
  subservice_name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.mr_anamnesis_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.mr_clients(id) ON DELETE CASCADE,
  areas text[] NOT NULL DEFAULT '{}',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, client_id)
);

CREATE TABLE IF NOT EXISTS public.mr_anamnesis_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.mr_clients(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  areas text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.mr_lash_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.mr_clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  technique text NOT NULL,
  style text NOT NULL,
  curl text NOT NULL DEFAULT 'C',
  thickness text NOT NULL DEFAULT '0.07',
  sizes text[] NOT NULL DEFAULT '{}',
  adhesive text NOT NULL,
  notes text,
  drawing_path text,
  drawing_data_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mr_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  expense_date date NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_frequency text CHECK (recurring_frequency IN ('semanal', 'mensal', 'trimestral', 'anual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mr_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  quantity numeric(10,2) NOT NULL DEFAULT 0,
  min_quantity numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost_cents integer,
  expires_at date,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.mr_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.mr_inventory_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'saida')),
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
  total_cost_cents integer,
  expense_id uuid REFERENCES public.mr_expenses(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mr_whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.mr_studios(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  message text NOT NULL,
  UNIQUE (studio_id, template_type)
);

-- Índices para FKs e RLS
CREATE INDEX IF NOT EXISTS idx_pub_mr_studios_plan ON public.mr_studios (plan_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_colabs_studio ON public.mr_collaborators (studio_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_colabs_auth ON public.mr_collaborators (auth_user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_pub_mr_clients_studio_wa ON public.mr_clients (studio_id, whatsapp);
CREATE INDEX IF NOT EXISTS idx_pub_mr_services_studio ON public.mr_services (studio_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_subservices_service ON public.mr_subservices (studio_id, service_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_subservices_srv_id ON public.mr_subservices (service_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_appts_studio_date ON public.mr_appointments (studio_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_pub_mr_appts_client ON public.mr_appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_appts_colab ON public.mr_appointments (collaborator_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_appt_items_appt ON public.mr_appointment_items (appointment_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_appt_items_sub ON public.mr_appointment_items (subservice_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_anamnesis_client ON public.mr_anamnesis_records (client_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_anamnesis_links_studio ON public.mr_anamnesis_links (studio_id, client_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_anamnesis_links_client ON public.mr_anamnesis_links (client_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_mappings_studio ON public.mr_lash_mappings (studio_id, client_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_mappings_client ON public.mr_lash_mappings (client_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_expenses_studio_date ON public.mr_expenses (studio_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_pub_mr_inv_items_studio ON public.mr_inventory_items (studio_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_inv_movs_item ON public.mr_inventory_movements (item_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_inv_movs_exp ON public.mr_inventory_movements (expense_id);
CREATE INDEX IF NOT EXISTS idx_pub_mr_inv_movs_studio ON public.mr_inventory_movements (studio_id);

-- RLS & Grants mínimos
ALTER TABLE public.mr_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_plans_public_read ON public.mr_plans
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.mr_studios ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_studios_owner_rw ON public.mr_studios
  FOR ALL TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) OR id = (SELECT myrose.mr_current_studio_id()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'mr_collaborators', 'mr_clients', 'mr_services', 'mr_subservices', 'mr_working_hours',
      'mr_blocked_days', 'mr_appointments', 'mr_anamnesis_records', 'mr_anamnesis_links',
      'mr_lash_mappings', 'mr_expenses', 'mr_inventory_items', 'mr_inventory_movements', 'mr_whatsapp_templates'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY mr_tenant_isolation ON public.%I FOR ALL TO authenticated USING (studio_id = (SELECT myrose.mr_current_studio_id())) WITH CHECK (studio_id = (SELECT myrose.mr_current_studio_id()))',
      tbl
    );
  END LOOP;
END $$;

ALTER TABLE public.mr_appointment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_tenant_items ON public.mr_appointment_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mr_appointments a
      WHERE a.id = appointment_id AND a.studio_id = (SELECT myrose.mr_current_studio_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mr_appointments a
      WHERE a.id = appointment_id AND a.studio_id = (SELECT myrose.mr_current_studio_id())
    )
  );

-- Triggers e bootstrap RPC
CREATE OR REPLACE FUNCTION public.mr_enforce_client_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NEW.active = false THEN
    RETURN NEW;
  END IF;

  SELECT p.client_limit INTO v_limit
  FROM public.mr_studios s
  JOIN public.mr_plans p ON p.id = s.plan_id
  WHERE s.id = NEW.studio_id;

  IF v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.mr_clients
    WHERE studio_id = NEW.studio_id AND active = true AND id <> NEW.id;

    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'Limite de % clientes atingido para o plano atual.', v_limit
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mr_enforce_client_plan_limit() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_mr_enforce_client_limit
  BEFORE INSERT OR UPDATE ON public.mr_clients
  FOR EACH ROW EXECUTE FUNCTION public.mr_enforce_client_plan_limit();

CREATE OR REPLACE FUNCTION public.mr_bootstrap_studio(
  p_owner_name text,
  p_business_name text,
  p_email text,
  p_slug text,
  p_whatsapp text DEFAULT NULL
)
RETURNS public.mr_studios
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_studio public.mr_studios;
  v_day smallint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  INSERT INTO public.mr_studios (auth_user_id, owner_name, business_name, email, booking_slug, whatsapp)
  VALUES (v_uid, trim(p_owner_name), trim(p_business_name), lower(trim(p_email)), lower(trim(p_slug)), p_whatsapp)
  ON CONFLICT (auth_user_id) DO UPDATE
    SET business_name = EXCLUDED.business_name,
        updated_at = now()
  RETURNING * INTO v_studio;

  FOR v_day IN 1..6 LOOP
    INSERT INTO public.mr_working_hours (studio_id, day_of_week, active)
    VALUES (v_studio.id, v_day, true)
    ON CONFLICT (studio_id, day_of_week) DO NOTHING;
  END LOOP;

  RETURN v_studio;
END;
$$;

REVOKE ALL ON FUNCTION public.mr_bootstrap_studio(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mr_bootstrap_studio(text, text, text, text, text) TO authenticated, service_role;

-- Storage buckets isolados do MyRose (privado para mappings com Signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('mr-mappings', 'mr-mappings', false),
  ('mr-catalogo', 'mr-catalogo', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY mr_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('mr-mappings', 'mr-catalogo')
    AND (storage.foldername(name))[1] = (SELECT myrose.mr_current_studio_id()::text)
  );

CREATE POLICY mr_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('mr-mappings', 'mr-catalogo')
    AND (storage.foldername(name))[1] = (SELECT myrose.mr_current_studio_id()::text)
  );

CREATE POLICY mr_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('mr-mappings', 'mr-catalogo')
    AND (storage.foldername(name))[1] = (SELECT myrose.mr_current_studio_id()::text)
  )
  WITH CHECK (
    bucket_id IN ('mr-mappings', 'mr-catalogo')
    AND (storage.foldername(name))[1] = (SELECT myrose.mr_current_studio_id()::text)
  );

CREATE POLICY mr_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('mr-mappings', 'mr-catalogo')
    AND (storage.foldername(name))[1] = (SELECT myrose.mr_current_studio_id()::text)
  );
