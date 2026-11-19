-- MyRose v2.0 — Catálogo inicial no bootstrap de novos estúdios + Estúdio vitrine (studio-demo)

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
  v_srv_lash uuid;
  v_srv_brow uuid;
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

  IF NOT EXISTS (SELECT 1 FROM public.mr_services WHERE studio_id = v_studio.id) THEN
    INSERT INTO public.mr_services (studio_id, name, active, sort_order)
    VALUES (v_studio.id, 'Extensão de Cílios', true, 0)
    RETURNING id INTO v_srv_lash;

    INSERT INTO public.mr_services (studio_id, name, active, sort_order)
    VALUES (v_studio.id, 'Sobrancelhas', true, 1)
    RETURNING id INTO v_srv_brow;

    INSERT INTO public.mr_subservices (
      studio_id, service_id, name, details, price_cents, promo_price_cents, duration_minutes, maintenance_days, active, sort_order
    ) VALUES
      (v_studio.id, v_srv_lash, 'Volume Brasileiro', 'Aplicação completa com mapeamento personalizado', 18000, NULL, 90, 20, true, 0),
      (v_studio.id, v_srv_lash, 'Fio a Fio Clássico', 'Acabamento natural fio a fio', 15000, 13500, 90, 15, true, 1),
      (v_studio.id, v_srv_brow, 'Brow Lamination', 'Alinhamento e hidratação dos fios', 12000, NULL, 60, 30, true, 2);
  END IF;

  RETURN v_studio;
END;
$$;

DO $$
DECLARE
  v_demo_uid uuid := COALESCE(
    (SELECT id FROM auth.users WHERE email = 'demo@myrose.app' LIMIT 1),
    '00000000-0000-4000-8000-00000000d300'::uuid
  );
  v_studio_id uuid;
  v_srv_lash uuid;
  v_srv_brow uuid;
  v_sub_br uuid;
  v_cli_1 uuid;
  v_day smallint;
BEGIN
  INSERT INTO public.mr_studios (
    auth_user_id, booking_slug, owner_name, business_name, specialty,
    whatsapp, email, plan_id, slot_interval_minutes, min_advance_hours,
    pix_key, deposit_percent, address
  ) VALUES (
    v_demo_uid, 'studio-demo', 'Camila Rosa', 'Studio MyRose Demo', 'Lash Designer',
    '5511999990000', 'demo@myrose.app', 'premium', 30, 2,
    'contato@myrose.app', 30, 'Rua das Rosas, 120 - São Paulo/SP'
  )
  ON CONFLICT (booking_slug) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        plan_id = 'premium',
        updated_at = now()
  RETURNING id INTO v_studio_id;

  FOR v_day IN 0..6 LOOP
    INSERT INTO public.mr_working_hours (studio_id, day_of_week, active, start_time, end_time, break_start, break_end)
    VALUES (
      v_studio_id,
      v_day,
      v_day BETWEEN 1 AND 6,
      '09:00',
      CASE WHEN v_day = 6 THEN '16:00'::time ELSE '18:00'::time END,
      '12:00',
      '13:00'
    )
    ON CONFLICT (studio_id, day_of_week) DO NOTHING;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.mr_services WHERE studio_id = v_studio_id) THEN
    INSERT INTO public.mr_services (studio_id, name, active, sort_order)
    VALUES (v_studio_id, 'Extensão de Cílios', true, 0)
    RETURNING id INTO v_srv_lash;

    INSERT INTO public.mr_services (studio_id, name, active, sort_order)
    VALUES (v_studio_id, 'Sobrancelhas', true, 1)
    RETURNING id INTO v_srv_brow;

    INSERT INTO public.mr_subservices (
      studio_id, service_id, name, details, price_cents, promo_price_cents, duration_minutes, maintenance_days, active, sort_order
    ) VALUES (
      v_studio_id, v_srv_lash, 'Volume Brasileiro', 'Aplicação completa com mapeamento personalizado', 18000, NULL, 90, 20, true, 0
    )
    RETURNING id INTO v_sub_br;

    INSERT INTO public.mr_subservices (
      studio_id, service_id, name, details, price_cents, promo_price_cents, duration_minutes, maintenance_days, active, sort_order
    ) VALUES
      (v_studio_id, v_srv_lash, 'Fio a Fio Clássico', 'Acabamento natural fio a fio', 15000, 13500, 90, 15, true, 1),
      (v_studio_id, v_srv_brow, 'Brow Lamination', 'Alinhamento e hidratação dos fios', 12000, NULL, 60, 30, true, 2);

    INSERT INTO public.mr_clients (studio_id, name, whatsapp, birth_date, notes, total_spent_cents, last_visit_at)
    VALUES (v_studio_id, 'Mariana Silva', '5511988881111', '1995-05-12', 'Prefere curvatura C e mapping Gatinho', 36000, now() - interval '19 days')
    RETURNING id INTO v_cli_1;

    INSERT INTO public.mr_clients (studio_id, name, whatsapp, birth_date, notes, total_spent_cents, last_visit_at)
    VALUES (v_studio_id, 'Juliana Costa', '5511977772222', '1998-09-23', NULL, 15000, now() - interval '5 days');

    INSERT INTO public.mr_lash_mappings (
      studio_id, client_id, client_name, technique, style, curl, thickness, sizes, adhesive, notes
    ) VALUES (
      v_studio_id, v_cli_1, 'Mariana Silva', 'Brasileiro', 'Gatinho', 'C', '0.07',
      ARRAY['8mm', '9mm', '10mm', '11mm', '12mm', '10mm'],
      'Cherry Blink 1.5s', 'Olho levemente amendoado; evitar 13mm no canto externo.'
    );

    INSERT INTO public.mr_inventory_items (studio_id, name, category, unit, quantity, min_quantity, unit_cost_cents, expires_at)
    VALUES
      (v_studio_id, 'Caixa Fios Y Brasileiro 0.07', 'Cílios/Fios', 'caixa', 4, 2, 4500, NULL),
      (v_studio_id, 'Adesivo Lash Pro 3ml', 'Colas e Removedores', 'un', 1, 2, 11000, (current_date + 45));

    INSERT INTO public.mr_expenses (studio_id, category, description, amount_cents, expense_date, is_recurring, recurring_frequency)
    VALUES (v_studio_id, 'Custos Fixos', 'Aluguel da sala', 95000, current_date - 10, true, 'mensal');
  END IF;
END $$;
