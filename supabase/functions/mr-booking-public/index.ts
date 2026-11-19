// Edge Function consolidada do portal público (/agendar/:codigo e /ficha/:token)
// Prefixo mr_* no schema public (isolado do projeto irmão e portátil).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get('MR_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('MR_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return json({ error: 'Backend MyRose não configurado' }, 500);

  const db = createClient(url, serviceKey);
  const reqUrl = new URL(req.url);
  const action = reqUrl.searchParams.get('action') ?? 'profile';

  try {
    if (req.method === 'GET' && action === 'profile') {
      const codigo = (reqUrl.searchParams.get('codigo') ?? '').trim().toLowerCase();
      if (!codigo) return json({ error: 'Código do estúdio obrigatório' }, 400);

      const { data: studio, error } = await db
        .from('mr_studios')
        .select('id, booking_slug, business_name, owner_name, specialty, whatsapp, address, pix_key, deposit_percent, slot_interval_minutes, min_advance_hours')
        .eq('booking_slug', codigo)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!studio) return json({ error: 'Estúdio não encontrado' }, 404);

      const [{ data: services }, { data: subservices }, { data: blockedDays }] = await Promise.all([
        db.from('mr_services').select('id, name, sort_order').eq('studio_id', studio.id).eq('active', true).order('sort_order'),
        db.from('mr_subservices').select('id, service_id, name, details, price_cents, promo_price_cents, duration_minutes').eq('studio_id', studio.id).eq('active', true).order('sort_order'),
        db.from('mr_blocked_days').select('blocked_date, reason').eq('studio_id', studio.id).gte('blocked_date', new Date().toISOString().slice(0, 10)),
      ]);

      return json({ studio, services: services ?? [], subservices: subservices ?? [], blockedDays: blockedDays ?? [] });
    }

    if (req.method === 'GET' && action === 'slots') {
      const codigo = (reqUrl.searchParams.get('codigo') ?? '').trim().toLowerCase();
      const dateStr = reqUrl.searchParams.get('date') ?? '';
      const duration = Math.max(15, Math.min(480, Number(reqUrl.searchParams.get('duration') ?? 60)));
      if (!codigo || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return json({ error: 'Parâmetros codigo e date (YYYY-MM-DD) obrigatórios' }, 400);
      }

      const { data: studio, error: studioErr } = await db
        .from('mr_studios')
        .select('id, slot_interval_minutes, min_advance_hours')
        .eq('booking_slug', codigo)
        .maybeSingle();
      if (studioErr) return json({ error: studioErr.message }, 500);
      if (!studio) return json({ error: 'Estúdio não encontrado' }, 404);

      const { data: blocked } = await db
        .from('mr_blocked_days')
        .select('id')
        .eq('studio_id', studio.id)
        .eq('blocked_date', dateStr)
        .maybeSingle();
      if (blocked) return json({ slots: [], reason: 'Dia bloqueado pelo estúdio' });

      const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
      const { data: hours } = await db
        .from('mr_working_hours')
        .select('*')
        .eq('studio_id', studio.id)
        .eq('day_of_week', dow)
        .maybeSingle();
      if (!hours || !hours.active) return json({ slots: [], reason: 'Estúdio fechado neste dia' });

      const { data: busy } = await db
        .from('mr_appointments')
        .select('start_time, end_time')
        .eq('studio_id', studio.id)
        .eq('appointment_date', dateStr)
        .neq('status', 'cancelado');

      const startMin = toMinutes(hours.start_time);
      const endMin = toMinutes(hours.end_time);
      const breakStart = hours.break_start ? toMinutes(hours.break_start) : null;
      const breakEnd = hours.break_end ? toMinutes(hours.break_end) : null;
      const step = Math.max(15, studio.slot_interval_minutes || 30);
      const slots: Array<{ start: string; end: string }> = [];

      for (let t = startMin; t + duration <= endMin; t += step) {
        const tEnd = t + duration;
        const hitsBreak = breakStart !== null && breakEnd !== null && t < breakEnd && tEnd > breakStart;
        const hitsBusy = (busy ?? []).some((b) => t < toMinutes(b.end_time) && tEnd > toMinutes(b.start_time));
        if (!hitsBreak && !hitsBusy) {
          slots.push({ start: toHHMM(t), end: toHHMM(tEnd) });
        }
      }

      return json({ slots });
    }

    if (req.method === 'POST' && action === 'book') {
      const body = await req.json();
      const codigo = String(body.codigo ?? '').trim().toLowerCase();
      const clientName = String(body.clientName ?? '').trim();
      const clientWhatsapp = String(body.clientWhatsapp ?? '').replace(/\D/g, '');
      const dateStr = String(body.date ?? '');
      const startTime = String(body.startTime ?? '');
      const subserviceIds = Array.isArray(body.subserviceIds) ? body.subserviceIds.map(String) : [];

      if (!codigo || clientName.length < 2 || clientWhatsapp.length < 10 || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(startTime) || subserviceIds.length === 0) {
        return json({ error: 'Dados incompletos para agendamento' }, 400);
      }

      const { data: studio, error: studioErr } = await db.from('mr_studios').select('id').eq('booking_slug', codigo).maybeSingle();
      if (studioErr) return json({ error: studioErr.message }, 500);
      if (!studio) return json({ error: 'Estúdio não encontrado' }, 404);

      const { data: chosen } = await db
        .from('mr_subservices')
        .select('id, name, price_cents, promo_price_cents, duration_minutes')
        .eq('studio_id', studio.id)
        .eq('active', true)
        .in('id', subserviceIds);
      if (!chosen || chosen.length === 0) return json({ error: 'Nenhum procedimento válido selecionado' }, 400);

      const duration = chosen.reduce((acc, s) => acc + s.duration_minutes, 0);
      const totalCents = chosen.reduce((acc, s) => acc + (s.promo_price_cents ?? s.price_cents), 0);
      const startMin = toMinutes(startTime);
      const endTime = toHHMM(startMin + duration);

      const { data: conflict } = await db
        .from('mr_appointments')
        .select('id')
        .eq('studio_id', studio.id)
        .eq('appointment_date', dateStr)
        .neq('status', 'cancelado')
        .lt('start_time', endTime)
        .gt('end_time', startTime)
        .limit(1);
      if (conflict && conflict.length > 0) return json({ error: 'Horário acabou de ser ocupado' }, 409);

      const { data: existingClient } = await db
        .from('mr_clients')
        .select('id')
        .eq('studio_id', studio.id)
        .eq('whatsapp', clientWhatsapp)
        .maybeSingle();

      let clientId = existingClient?.id ?? null;
      if (!clientId) {
        const { data: createdClient } = await db
          .from('mr_clients')
          .insert({ studio_id: studio.id, name: clientName, whatsapp: clientWhatsapp })
          .select('id')
          .single();
        clientId = createdClient?.id ?? null;
      }

      const { data: appointment, error: apptErr } = await db
        .from('mr_appointments')
        .insert({
          studio_id: studio.id,
          client_id: clientId,
          client_name: clientName,
          client_whatsapp: clientWhatsapp,
          appointment_date: dateStr,
          start_time: startTime,
          end_time: endTime,
          status: 'agendado',
          total_cents: totalCents,
          notes: body.notes ? String(body.notes).slice(0, 500) : null,
        })
        .select('id, appointment_date, start_time, end_time, total_cents')
        .single();
      if (apptErr || !appointment) return json({ error: apptErr?.message ?? 'Erro ao salvar agendamento' }, 500);

      await db.from('mr_appointment_items').insert(
        chosen.map((s) => ({
          appointment_id: appointment.id,
          subservice_id: s.id,
          subservice_name: s.name,
          price_cents: s.promo_price_cents ?? s.price_cents,
        }))
      );

      return json({ appointment }, 201);
    }

    if (req.method === 'GET' && action === 'anamnesis') {
      const token = (reqUrl.searchParams.get('token') ?? '').trim();
      if (!token) return json({ error: 'Token obrigatório' }, 400);

      const { data: link, error: linkErr } = await db
        .from('mr_anamnesis_links')
        .select('id, studio_id, client_id, areas, expires_at, used_at')
        .eq('token', token)
        .maybeSingle();
      if (linkErr) return json({ error: linkErr.message }, 500);
      if (!link) return json({ error: 'Link inválido' }, 404);
      if (new Date(link.expires_at) < new Date()) return json({ error: 'Link expirado' }, 410);

      const [{ data: client }, { data: studio }] = await Promise.all([
        db.from('mr_clients').select('name, whatsapp').eq('id', link.client_id).single(),
        db.from('mr_studios').select('business_name').eq('id', link.studio_id).single(),
      ]);

      return json({ link, clientName: client?.name ?? '', studioName: studio?.business_name ?? 'MyRose' });
    }

    if (req.method === 'POST' && action === 'anamnesis') {
      const body = await req.json();
      const token = String(body.token ?? '').trim();
      if (!token || typeof body.answers !== 'object' || body.answers === null) {
        return json({ error: 'Dados inválidos' }, 400);
      }

      const { data: link, error: linkErr } = await db
        .from('mr_anamnesis_links')
        .select('id, studio_id, client_id, areas, expires_at')
        .eq('token', token)
        .maybeSingle();
      if (linkErr) return json({ error: linkErr.message }, 500);
      if (!link) return json({ error: 'Link inválido' }, 404);
      if (new Date(link.expires_at) < new Date()) return json({ error: 'Link expirado' }, 410);

      await db.from('mr_anamnesis_records').upsert(
        {
          studio_id: link.studio_id,
          client_id: link.client_id,
          areas: Array.isArray(body.areas) ? body.areas : link.areas,
          answers: body.answers,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'studio_id,client_id' }
      );
      await db.from('mr_anamnesis_links').update({ used_at: new Date().toISOString() }).eq('id', link.id);
      return json({ ok: true });
    }

    return json({ error: 'Ação desconhecida' }, 404);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});
