import {
  DEFAULT_WHATSAPP_TEMPLATES,
  type AnamnesisLink,
  type AnamnesisRecord,
  type Appointment,
  type AppointmentStatus,
  type Client,
  type Collaborator,
  type Expense,
  type InventoryItem,
  type LashMapping,
  type PlanId,
  type ServiceCategory,
  type Studio,
  type Subservice,
  type WhatsAppTemplate,
  type WorkingHour,
} from '../types/domain';
import {
  canAddResource,
  computeAvailableSlots,
  getPlan,
  hasTimeConflict,
  toHHMM,
  toMinutes,
} from '../lib/domain';
import { getPublicFunctionUrl, isSupabaseConfigured, supabase } from '../lib/supabase';

const LOCAL_STORE_KEY = 'myrose_local_state_v2';

export interface StudioWorkspace {
  studio: Studio;
  clients: Client[];
  services: ServiceCategory[];
  subservices: Subservice[];
  workingHours: WorkingHour[];
  blockedDates: string[];
  appointments: Appointment[];
  mappings: LashMapping[];
  expenses: Expense[];
  inventory: InventoryItem[];
  collaborators: Collaborator[];
  anamnesisRecords: AnamnesisRecord[];
  anamnesisLinks: AnamnesisLink[];
  templates: WhatsAppTemplate[];
}

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function buildSeedState(): StudioWorkspace {
  const studioId = 'studio-myrose-demo';
  const defaultHours: WorkingHour[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    active: day >= 1 && day <= 6,
    start_time: '09:00',
    end_time: day === 6 ? '16:00' : '18:00',
    break_start: '12:00',
    break_end: '13:00',
  }));

  return {
    studio: {
      id: studioId,
      auth_user_id: 'demo-owner',
      booking_slug: 'studio-demo',
      owner_name: 'Camila Rosa',
      business_name: 'Studio MyRose Demo',
      specialty: 'Lash Designer',
      whatsapp: '5511999990000',
      email: 'contato@myrose.app',
      plan_id: 'premium',
      slot_interval_minutes: 30,
      min_advance_hours: 2,
      pix_key: 'contato@myrose.app',
      deposit_percent: 30,
      address: 'Rua das Rosas, 120 - São Paulo/SP',
      google_review_url: 'https://g.page/r/studio-myrose/review',
    },
    services: [
      { id: 'srv-1', studio_id: studioId, name: 'Extensão de Cílios', active: true },
      { id: 'srv-2', studio_id: studioId, name: 'Sobrancelhas', active: true },
    ],
    subservices: [
      {
        id: 'sub-1',
        studio_id: studioId,
        service_id: 'srv-1',
        name: 'Volume Brasileiro',
        details: 'Aplicação completa com mapeamento personalizado',
        price_cents: 18000,
        promo_price_cents: null,
        duration_minutes: 90,
        maintenance_days: 20,
        active: true,
      },
      {
        id: 'sub-2',
        studio_id: studioId,
        service_id: 'srv-1',
        name: 'Fio a Fio Clássico',
        details: 'Acabamento natural fio a fio',
        price_cents: 15000,
        promo_price_cents: 13500,
        duration_minutes: 90,
        maintenance_days: 15,
        active: true,
      },
      {
        id: 'sub-3',
        studio_id: studioId,
        service_id: 'srv-2',
        name: 'Brow Lamination',
        details: 'Alinhamento e hidratação dos fios',
        price_cents: 12000,
        promo_price_cents: null,
        duration_minutes: 60,
        maintenance_days: 30,
        active: true,
      },
    ],
    clients: [
      {
        id: 'cli-1',
        studio_id: studioId,
        name: 'Mariana Silva',
        whatsapp: '5511988881111',
        birth_date: '1995-05-12',
        notes: 'Prefere curvatura C e mapping Gatinho',
        active: true,
        total_spent_cents: 36000,
        last_visit_at: todayISO(-19),
        created_at: new Date().toISOString(),
      },
      {
        id: 'cli-2',
        studio_id: studioId,
        name: 'Juliana Costa',
        whatsapp: '5511977772222',
        birth_date: '1998-09-23',
        notes: null,
        active: true,
        total_spent_cents: 15000,
        last_visit_at: todayISO(-5),
        created_at: new Date().toISOString(),
      },
    ],
    workingHours: defaultHours,
    blockedDates: [],
    appointments: [
      {
        id: 'apt-1',
        studio_id: studioId,
        client_id: 'cli-1',
        collaborator_id: null,
        client_name: 'Mariana Silva',
        client_whatsapp: '5511988881111',
        appointment_date: todayISO(0),
        start_time: '10:00',
        end_time: '11:30',
        status: 'confirmado',
        total_cents: 18000,
        deposit_paid_cents: 5400,
        payment_method: 'pix',
        notes: 'Manutenção Volume Brasileiro',
        items: [{ subservice_id: 'sub-1', subservice_name: 'Volume Brasileiro', price_cents: 18000 }],
      },
      {
        id: 'apt-2',
        studio_id: studioId,
        client_id: 'cli-2',
        collaborator_id: null,
        client_name: 'Juliana Costa',
        client_whatsapp: '5511977772222',
        appointment_date: todayISO(-3),
        start_time: '14:00',
        end_time: '15:30',
        status: 'realizado',
        total_cents: 13500,
        deposit_paid_cents: 0,
        payment_method: 'cartao_credito',
        notes: null,
        items: [{ subservice_id: 'sub-2', subservice_name: 'Fio a Fio Clássico', price_cents: 13500 }],
      },
    ],
    mappings: [
      {
        id: 'map-1',
        studio_id: studioId,
        client_id: 'cli-1',
        client_name: 'Mariana Silva',
        technique: 'Brasileiro',
        style: 'Gatinho',
        curl: 'C',
        thickness: '0.07',
        sizes: ['8mm', '9mm', '10mm', '11mm', '12mm', '10mm'],
        adhesive: 'Cherry Blink 1.5s',
        notes: 'Olho levemente amendoado; evitar 13mm no canto externo.',
        drawing_data_url: null,
        created_at: new Date().toISOString(),
      },
    ],
    expenses: [
      {
        id: 'exp-1',
        studio_id: studioId,
        category: 'Custos Fixos',
        description: 'Aluguel da sala',
        amount_cents: 95000,
        expense_date: todayISO(-10),
        is_recurring: true,
        recurring_frequency: 'mensal',
      },
    ],
    inventory: [
      {
        id: 'inv-1',
        studio_id: studioId,
        name: 'Caixa Fios Y Brasileiro 0.07',
        category: 'Cílios/Fios',
        unit: 'caixa',
        quantity: 4,
        min_quantity: 2,
        unit_cost_cents: 4500,
        expires_at: null,
      },
      {
        id: 'inv-2',
        studio_id: studioId,
        name: 'Adesivo Lash Pro 3ml',
        category: 'Colas e Removedores',
        unit: 'un',
        quantity: 1,
        min_quantity: 2,
        unit_cost_cents: 11000,
        expires_at: todayISO(45),
      },
    ],
    collaborators: [],
    anamnesisRecords: [],
    anamnesisLinks: [],
    templates: DEFAULT_WHATSAPP_TEMPLATES,
  };
}

function readLocalState(): StudioWorkspace {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) return JSON.parse(raw) as StudioWorkspace;
  } catch {
    // ignora storage corrompido e recria seed
  }
  const seed = buildSeedState();
  writeLocalState(seed);
  return seed;
}

function writeLocalState(next: StudioWorkspace): void {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(next));
  } catch {
    // ignora limite de storage
  }
}

function uid(): string {
  return crypto.randomUUID();
}

export async function loadStudioWorkspace(studioId: string): Promise<StudioWorkspace> {
  if (!isSupabaseConfigured || !supabase) {
    return readLocalState();
  }

  const [
    { data: studio, error: studioErr },
    { data: clients },
    { data: services },
    { data: subservices },
    { data: workingHours },
    { data: blocked },
    { data: appointments },
    { data: mappings },
    { data: expenses },
    { data: inventory },
    { data: collaborators },
    { data: anamnesisRecords },
    { data: anamnesisLinks },
    { data: savedTemplates },
  ] = await Promise.all([
    supabase.from('mr_studios').select('*').eq('id', studioId).single(),
    supabase.from('mr_clients').select('*').eq('studio_id', studioId).eq('active', true).order('name'),
    supabase.from('mr_services').select('*').eq('studio_id', studioId).eq('active', true).order('sort_order'),
    supabase.from('mr_subservices').select('*').eq('studio_id', studioId).eq('active', true).order('sort_order'),
    supabase.from('mr_working_hours').select('*').eq('studio_id', studioId).order('day_of_week'),
    supabase.from('mr_blocked_days').select('blocked_date').eq('studio_id', studioId),
    supabase.from('mr_appointments').select('*, items:mr_appointment_items(*)').eq('studio_id', studioId).order('appointment_date', { ascending: false }),
    supabase.from('mr_lash_mappings').select('*').eq('studio_id', studioId).order('created_at', { ascending: false }),
    supabase.from('mr_expenses').select('*').eq('studio_id', studioId).order('expense_date', { ascending: false }),
    supabase.from('mr_inventory_items').select('*').eq('studio_id', studioId).eq('active', true).order('name'),
    supabase.from('mr_collaborators').select('*').eq('studio_id', studioId).order('name'),
    supabase.from('mr_anamnesis_records').select('*').eq('studio_id', studioId),
    supabase.from('mr_anamnesis_links').select('*').eq('studio_id', studioId),
    supabase.from('mr_whatsapp_templates').select('*').eq('studio_id', studioId),
  ]);

  if (studioErr || !studio) {
    throw new Error(studioErr?.message ?? 'Estúdio não encontrado');
  }

  const rawMappings = (mappings ?? []) as LashMapping[];
  const pathsToSign = rawMappings.map((m) => m.drawing_path).filter((p): p is string => Boolean(p));
  const signedUrls = new Map<string, string>();
  if (pathsToSign.length > 0) {
    const { data: signedList } = await supabase.storage.from('mr-mappings').createSignedUrls(pathsToSign, 3600);
    for (const item of signedList ?? []) {
      if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
    }
  }
  const resolvedMappings = rawMappings.map((m) => ({
    ...m,
    drawing_data_url: m.drawing_data_url ?? (m.drawing_path ? signedUrls.get(m.drawing_path) ?? null : null),
  }));

  const templateMap = new Map((savedTemplates ?? []).map((t) => [t.template_type, t.message]));
  const templates = DEFAULT_WHATSAPP_TEMPLATES.map((d) => ({
    ...d,
    message: templateMap.get(d.type) ?? d.message,
  }));

  return {
    studio: studio as Studio,
    clients: (clients ?? []) as Client[],
    services: (services ?? []) as ServiceCategory[],
    subservices: (subservices ?? []) as Subservice[],
    workingHours: (workingHours ?? []) as WorkingHour[],
    blockedDates: (blocked ?? []).map((b) => String(b.blocked_date)),
    appointments: (appointments ?? []) as Appointment[],
    mappings: resolvedMappings,
    expenses: (expenses ?? []) as Expense[],
    inventory: (inventory ?? []) as InventoryItem[],
    collaborators: (collaborators ?? []) as Collaborator[],
    anamnesisRecords: (anamnesisRecords ?? []) as AnamnesisRecord[],
    anamnesisLinks: (anamnesisLinks ?? []) as AnamnesisLink[],
    templates,
  };
}

export async function createClient(
  ws: StudioWorkspace,
  input: { name: string; whatsapp: string; birth_date?: string | null; notes?: string | null }
): Promise<Client> {
  const plan = getPlan(ws.studio.plan_id);
  if (!canAddResource(ws.clients.length, plan.clientLimit)) {
    throw new Error(`Limite de ${plan.clientLimit} clientes atingido no plano ${plan.name}.`);
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('mr_clients')
      .insert({
        studio_id: ws.studio.id,
        name: input.name.trim(),
        whatsapp: input.whatsapp.replace(/\D/g, ''),
        birth_date: input.birth_date || null,
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Client;
  }

  const created: Client = {
    id: uid(),
    studio_id: ws.studio.id,
    name: input.name.trim(),
    whatsapp: input.whatsapp.replace(/\D/g, ''),
    birth_date: input.birth_date || null,
    notes: input.notes?.trim() || null,
    active: true,
    total_spent_cents: 0,
    last_visit_at: null,
    created_at: new Date().toISOString(),
  };
  writeLocalState({ ...ws, clients: [...ws.clients, created] });
  return created;
}

export async function createServiceCategory(ws: StudioWorkspace, name: string): Promise<ServiceCategory> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('mr_services')
      .insert({ studio_id: ws.studio.id, name: name.trim(), sort_order: ws.services.length })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as ServiceCategory;
  }
  const created: ServiceCategory = { id: uid(), studio_id: ws.studio.id, name: name.trim(), active: true };
  writeLocalState({ ...ws, services: [...ws.services, created] });
  return created;
}

export async function createSubservice(
  ws: StudioWorkspace,
  input: {
    service_id: string;
    name: string;
    price_cents: number;
    promo_price_cents?: number | null;
    duration_minutes: number;
    maintenance_days: number | null;
    details?: string | null;
  }
): Promise<Subservice> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('mr_subservices')
      .insert({ ...input, studio_id: ws.studio.id, name: input.name.trim(), sort_order: ws.subservices.length })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Subservice;
  }
  const created: Subservice = {
    id: uid(),
    studio_id: ws.studio.id,
    service_id: input.service_id,
    name: input.name.trim(),
    details: input.details ?? null,
    price_cents: input.price_cents,
    promo_price_cents: input.promo_price_cents ?? null,
    duration_minutes: input.duration_minutes,
    maintenance_days: input.maintenance_days,
    active: true,
  };
  writeLocalState({ ...ws, subservices: [...ws.subservices, created] });
  return created;
}

export async function deleteSubservice(ws: StudioWorkspace, subserviceId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('mr_subservices')
      .update({ active: false })
      .eq('studio_id', ws.studio.id)
      .eq('id', subserviceId);
    if (error) throw new Error(error.message);
    return;
  }
  writeLocalState({ ...ws, subservices: ws.subservices.filter((s) => s.id !== subserviceId) });
}

export async function updateSubservice(
  ws: StudioWorkspace,
  subserviceId: string,
  patch: {
    name: string;
    details?: string | null;
    price_cents: number;
    promo_price_cents: number | null;
    duration_minutes: number;
    maintenance_days: number | null;
  }
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('mr_subservices')
      .update({ ...patch, name: patch.name.trim() })
      .eq('studio_id', ws.studio.id)
      .eq('id', subserviceId);
    if (error) throw new Error(error.message);
    return;
  }
  writeLocalState({
    ...ws,
    subservices: ws.subservices.map((s) => (s.id === subserviceId ? { ...s, ...patch, name: patch.name.trim() } : s)),
  });
}

export async function createAppointment(
  ws: StudioWorkspace,
  input: {
    client_id: string | null;
    client_name: string;
    client_whatsapp: string;
    appointment_date: string;
    start_time: string;
    subservice: Subservice;
    collaborator_id?: string | null;
    notes?: string | null;
  }
): Promise<Appointment> {
  const endTime = toHHMM(toMinutes(input.start_time) + input.subservice.duration_minutes);
  if (
    hasTimeConflict(ws.appointments, {
      date: input.appointment_date,
      startTime: input.start_time,
      endTime,
      collaboratorId: input.collaborator_id,
    })
  ) {
    throw new Error('Conflito de horário na agenda selecionada.');
  }

  const price = input.subservice.promo_price_cents ?? input.subservice.price_cents;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('mr_appointments')
      .insert({
        studio_id: ws.studio.id,
        client_id: input.client_id,
        collaborator_id: input.collaborator_id ?? null,
        client_name: input.client_name.trim(),
        client_whatsapp: input.client_whatsapp.replace(/\D/g, ''),
        appointment_date: input.appointment_date,
        start_time: input.start_time,
        end_time: endTime,
        status: 'agendado',
        total_cents: price,
        payment_method: 'pix',
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from('mr_appointment_items').insert({
      appointment_id: data.id,
      subservice_id: input.subservice.id,
      subservice_name: input.subservice.name,
      price_cents: price,
    });
    return data as Appointment;
  }

  const created: Appointment = {
    id: uid(),
    studio_id: ws.studio.id,
    client_id: input.client_id,
    collaborator_id: input.collaborator_id ?? null,
    client_name: input.client_name.trim(),
    client_whatsapp: input.client_whatsapp.replace(/\D/g, ''),
    appointment_date: input.appointment_date,
    start_time: input.start_time,
    end_time: endTime,
    status: 'agendado',
    total_cents: price,
    deposit_paid_cents: 0,
    payment_method: 'pix',
    notes: input.notes?.trim() || null,
    items: [{ subservice_id: input.subservice.id, subservice_name: input.subservice.name, price_cents: price }],
  };
  writeLocalState({ ...ws, appointments: [created, ...ws.appointments] });
  return created;
}

export async function updateAppointmentStatus(
  ws: StudioWorkspace,
  appointmentId: string,
  status: AppointmentStatus
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('mr_appointments')
      .update({ status })
      .eq('id', appointmentId)
      .eq('studio_id', ws.studio.id);
    if (error) throw new Error(error.message);
    return;
  }
  const next = ws.appointments.map((a) => (a.id === appointmentId ? { ...a, status } : a));
  writeLocalState({ ...ws, appointments: next });
}

export async function createLashMapping(
  ws: StudioWorkspace,
  input: Omit<LashMapping, 'id' | 'studio_id' | 'created_at'>
): Promise<LashMapping> {
  const plan = getPlan(ws.studio.plan_id);
  if (!canAddResource(ws.mappings.length, plan.mappingLimit)) {
    throw new Error(`Limite de ${plan.mappingLimit} mappings atingido no plano ${plan.name}.`);
  }

  if (isSupabaseConfigured && supabase) {
    let drawingPath = input.drawing_path ?? null;
    let drawingDataUrl = input.drawing_data_url;

    if (drawingDataUrl?.startsWith('data:image/')) {
      const res = await fetch(drawingDataUrl);
      const blob = await res.blob();
      const ext = blob.type.includes('jpeg') ? 'jpg' : 'png';
      const path = `${ws.studio.id}/${uid()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('mr-mappings')
        .upload(path, blob, { contentType: blob.type || 'image/png', upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      drawingPath = path;
      drawingDataUrl = null;
    }

    const { data, error } = await supabase
      .from('mr_lash_mappings')
      .insert({ ...input, drawing_path: drawingPath, drawing_data_url: drawingDataUrl, studio_id: ws.studio.id })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const created = data as LashMapping;
    if (created.drawing_path && !created.drawing_data_url) {
      const { data: signed } = await supabase.storage.from('mr-mappings').createSignedUrl(created.drawing_path, 3600);
      if (signed?.signedUrl) created.drawing_data_url = signed.signedUrl;
    }
    return created;
  }

  const created: LashMapping = {
    ...input,
    id: uid(),
    studio_id: ws.studio.id,
    created_at: new Date().toISOString(),
  };
  writeLocalState({ ...ws, mappings: [created, ...ws.mappings] });
  return created;
}

export async function createExpense(
  ws: StudioWorkspace,
  input: Omit<Expense, 'id' | 'studio_id'>
): Promise<Expense> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('mr_expenses')
      .insert({ ...input, studio_id: ws.studio.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Expense;
  }

  const created: Expense = { ...input, id: uid(), studio_id: ws.studio.id };
  writeLocalState({ ...ws, expenses: [created, ...ws.expenses] });
  return created;
}

export async function createInventoryItem(
  ws: StudioWorkspace,
  input: Omit<InventoryItem, 'id' | 'studio_id'>
): Promise<InventoryItem> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('mr_inventory_items')
      .insert({ ...input, studio_id: ws.studio.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as InventoryItem;
  }
  const created: InventoryItem = { ...input, id: uid(), studio_id: ws.studio.id };
  writeLocalState({ ...ws, inventory: [...ws.inventory, created] });
  return created;
}

export async function registerInventoryMovement(
  ws: StudioWorkspace,
  item: InventoryItem,
  type: 'entrada' | 'saida',
  quantity: number,
  totalCostCents: number | null,
  launchExpense: boolean
): Promise<void> {
  const nextQty = Math.max(0, type === 'entrada' ? item.quantity + quantity : item.quantity - quantity);

  if (isSupabaseConfigured && supabase) {
    let expenseId: string | null = null;
    if (type === 'entrada' && launchExpense && totalCostCents && totalCostCents > 0) {
      const { data: exp } = await supabase
        .from('mr_expenses')
        .insert({
          studio_id: ws.studio.id,
          category: 'Material de Trabalho',
          description: `Compra estoque: ${item.name}`,
          amount_cents: totalCostCents,
          expense_date: todayISO(0),
          is_recurring: false,
        })
        .select('id')
        .single();
      expenseId = exp?.id ?? null;
    }
    await supabase.from('mr_inventory_movements').insert({
      studio_id: ws.studio.id,
      item_id: item.id,
      movement_type: type,
      quantity,
      total_cost_cents: totalCostCents,
      expense_id: expenseId,
    });
    await supabase.from('mr_inventory_items').update({ quantity: nextQty }).eq('id', item.id);
    return;
  }

  let nextExpenses = ws.expenses;
  if (type === 'entrada' && launchExpense && totalCostCents && totalCostCents > 0) {
    nextExpenses = [
      {
        id: uid(),
        studio_id: ws.studio.id,
        category: 'Material de Trabalho',
        description: `Compra estoque: ${item.name}`,
        amount_cents: totalCostCents,
        expense_date: todayISO(0),
        is_recurring: false,
      },
      ...ws.expenses,
    ];
  }
  const nextInventory = ws.inventory.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i));
  writeLocalState({ ...ws, expenses: nextExpenses, inventory: nextInventory });
}

export async function createAnamnesisLink(
  ws: StudioWorkspace,
  clientId: string,
  areas: string[]
): Promise<AnamnesisLink> {
  const token = uid().replace(/-/g, '').slice(0, 12);
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('mr_anamnesis_links')
      .insert({ studio_id: ws.studio.id, client_id: clientId, token, areas, expires_at: expiresAt })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as AnamnesisLink;
  }

  const created: AnamnesisLink = { token, client_id: clientId, areas, expires_at: expiresAt };
  writeLocalState({ ...ws, anamnesisLinks: [created, ...ws.anamnesisLinks] });
  return created;
}

export async function saveWhatsAppTemplate(
  ws: StudioWorkspace,
  type: string,
  message: string
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('mr_whatsapp_templates')
      .upsert({ studio_id: ws.studio.id, template_type: type, message }, { onConflict: 'studio_id,template_type' });
    if (error) throw new Error(error.message);
    return;
  }
  const next = ws.templates.map((t) => (t.type === type ? { ...t, message } : t));
  writeLocalState({ ...ws, templates: next });
}

export async function addCollaborator(
  ws: StudioWorkspace,
  input: { name: string; role_title: string; email: string; commission_percent: number; separate_agenda: boolean; permissions: Record<string, boolean> }
): Promise<Collaborator> {
  const plan = getPlan(ws.studio.plan_id);
  if (ws.collaborators.filter((c) => c.active).length >= plan.teamLimit) {
    throw new Error(`Seu plano ${plan.name} permite até ${plan.teamLimit} colaboradoras.`);
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('mr_collaborators')
      .insert({ ...input, studio_id: ws.studio.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Collaborator;
  }

  const created: Collaborator = { ...input, id: uid(), studio_id: ws.studio.id, active: true };
  writeLocalState({ ...ws, collaborators: [...ws.collaborators, created] });
  return created;
}

export async function updateStudioSettings(
  ws: StudioWorkspace,
  patch: Partial<Studio> & { plan_id?: PlanId }
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('mr_studios').update(patch).eq('id', ws.studio.id);
    if (error) throw new Error(error.message);
    return;
  }
  writeLocalState({ ...ws, studio: { ...ws.studio, ...patch } });
}

// ---------- Endpoints Públicos (/agendar/:codigo e /ficha/:token) ----------

export async function fetchPublicStudioProfile(codigo: string) {
  if (isSupabaseConfigured) {
    const res = await fetch(getPublicFunctionUrl('profile', { codigo }), {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Estúdio não encontrado');
    return (await res.json()) as {
      studio: Studio;
      services: ServiceCategory[];
      subservices: Subservice[];
      blockedDays: Array<{ blocked_date: string }>;
    };
  }

  const local = readLocalState();
  if (local.studio.booking_slug !== codigo.toLowerCase()) {
    throw new Error(`Estúdio "${codigo}" não encontrado (no modo local use "studio-demo")`);
  }
  return {
    studio: local.studio,
    services: local.services,
    subservices: local.subservices,
    blockedDays: local.blockedDates.map((blocked_date) => ({ blocked_date })),
  };
}

export async function fetchPublicAvailableSlots(codigo: string, date: string, durationMinutes: number) {
  if (isSupabaseConfigured) {
    const res = await fetch(
      getPublicFunctionUrl('slots', { codigo, date, duration: String(durationMinutes) }),
      { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }
    );
    const data = await res.json();
    return (data.slots ?? []) as Array<{ start: string; end: string }>;
  }

  const local = readLocalState();
  return computeAvailableSlots({
    date,
    durationMinutes,
    slotIntervalMinutes: local.studio.slot_interval_minutes,
    minAdvanceHours: local.studio.min_advance_hours,
    workingHours: local.workingHours,
    blockedDates: local.blockedDates,
    appointments: local.appointments,
  });
}

export async function submitPublicBooking(input: {
  codigo: string;
  clientName: string;
  clientWhatsapp: string;
  date: string;
  startTime: string;
  subserviceIds: string[];
  notes?: string;
}) {
  if (isSupabaseConfigured) {
    const res = await fetch(getPublicFunctionUrl('book'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Falha ao agendar');
    return data.appointment;
  }

  const local = readLocalState();
  const chosen = local.subservices.filter((s) => input.subserviceIds.includes(s.id));
  if (chosen.length === 0) throw new Error('Selecione ao menos um procedimento');
  const first = chosen[0];
  const combined: Subservice = {
    ...first,
    name: chosen.map((c) => c.name).join(' + '),
    duration_minutes: chosen.reduce((a, c) => a + c.duration_minutes, 0),
    price_cents: chosen.reduce((a, c) => a + (c.promo_price_cents ?? c.price_cents), 0),
    promo_price_cents: null,
  };
  return createAppointment(local, {
    client_id: null,
    client_name: input.clientName,
    client_whatsapp: input.clientWhatsapp,
    appointment_date: input.date,
    start_time: input.startTime,
    subservice: combined,
    notes: input.notes,
  });
}

export async function fetchPublicAnamnesis(token: string) {
  if (isSupabaseConfigured) {
    const res = await fetch(getPublicFunctionUrl('anamnesis', { token }), {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Link inválido');
    return data as { link: AnamnesisLink; clientName: string; studioName: string };
  }
  const local = readLocalState();
  const link = local.anamnesisLinks.find((l) => l.token === token);
  if (!link) throw new Error('Link de ficha não encontrado');
  const client = local.clients.find((c) => c.id === link.client_id);
  return { link, clientName: client?.name ?? 'Cliente', studioName: local.studio.business_name };
}

export async function submitPublicAnamnesis(token: string, areas: string[], answers: Record<string, string>) {
  if (isSupabaseConfigured) {
    const res = await fetch(getPublicFunctionUrl('anamnesis'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ token, areas, answers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar ficha');
    return;
  }
  const local = readLocalState();
  const link = local.anamnesisLinks.find((l) => l.token === token);
  if (!link) throw new Error('Link inválido');
  const rec: AnamnesisRecord = {
    client_id: link.client_id,
    areas,
    answers,
    updated_at: new Date().toISOString(),
  };
  const rest = local.anamnesisRecords.filter((r) => r.client_id !== link.client_id);
  writeLocalState({ ...local, anamnesisRecords: [rec, ...rest] });
}

// ---------- Assinaturas & Checkout (Stripe) ----------

async function callStripeBilling<T>(payload: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Checkout Stripe disponível apenas com Supabase conectado.');
  }
  const { data, error } = await supabase.functions.invoke('mr-stripe-billing', {
    body: { ...payload, returnOrigin: window.location.origin },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const parsed = (await ctx.json()) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      }
    } catch {
      // mantém mensagem original
    }
    throw new Error(msg);
  }
  return data as T;
}

export async function startStripeCheckout(
  planId: Exclude<PlanId, 'gratuito'>,
  interval: 'month' | 'year'
): Promise<string> {
  const res = await callStripeBilling<{ url?: string }>({ action: 'checkout', planId, interval });
  if (!res.url) throw new Error('Stripe não retornou URL de checkout.');
  return res.url;
}

export async function openStripeBillingPortal(): Promise<string> {
  const res = await callStripeBilling<{ url?: string }>({ action: 'portal' });
  if (!res.url) throw new Error('Stripe não retornou URL do portal.');
  return res.url;
}

export async function syncStripeCheckoutSession(sessionId: string): Promise<{ synced: boolean; status?: string }> {
  return callStripeBilling<{ synced: boolean; status?: string }>({ action: 'sync', sessionId });
}

// ---------- Clientes: Exclusão em Massa & Importação CSV/Excel ----------

export async function deleteClientsBulk(ws: StudioWorkspace, clientIds: string[]): Promise<void> {
  if (clientIds.length === 0) return;
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('mr_clients')
      .update({ active: false })
      .eq('studio_id', ws.studio.id)
      .in('id', clientIds);
    if (error) throw new Error(error.message);
    return;
  }
  const set = new Set(clientIds);
  writeLocalState({ ...ws, clients: ws.clients.filter((c) => !set.has(c.id)) });
}

export async function importClientsCsv(
  ws: StudioWorkspace,
  csvText: string
): Promise<{ imported: number; rejected: string[] }> {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { imported: 0, rejected: [] };

  const sep = lines[0].includes(';') ? ';' : ',';
  const splitRow = (line: string) =>
    line.split(sep).map((cell) => cell.trim().replace(/^["']|["']$/g, ''));

  const firstCells = splitRow(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = firstCells.some((c) =>
    ['nome', 'name', 'cliente', 'whatsapp', 'telefone', 'celular'].includes(c)
  );
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const plan = getPlan(ws.studio.plan_id);
  const existingPhones = new Set(ws.clients.map((c) => c.whatsapp.replace(/\D/g, '')));
  let currentCount = ws.clients.length;
  let imported = 0;
  const rejected: string[] = [];

  for (const rawLine of dataLines) {
    const cols = splitRow(rawLine);
    const name = (cols[0] ?? '').trim();
    const whatsapp = (cols[1] ?? '').replace(/\D/g, '');
    const rawBirth = (cols[2] ?? '').trim();
    const notes = (cols[3] ?? '').trim() || null;

    if (name.length < 2 || whatsapp.length < 10) {
      rejected.push(`${rawLine} (nome ou WhatsApp inválido)`);
      continue;
    }
    if (existingPhones.has(whatsapp)) {
      rejected.push(`${name} (${whatsapp} já cadastrada)`);
      continue;
    }
    if (!canAddResource(currentCount, plan.clientLimit)) {
      rejected.push(`${name} (limite de ${plan.clientLimit} clientes do plano ${plan.name} atingido)`);
      continue;
    }

    let birthDate: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawBirth)) {
      birthDate = rawBirth;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawBirth)) {
      const [d, m, y] = rawBirth.split('/');
      birthDate = `${y}-${m}-${d}`;
    }

    try {
      await createClient(
        { ...ws, clients: new Array(currentCount).fill(ws.clients[0]) as Client[] },
        { name, whatsapp, birth_date: birthDate, notes }
      );
      existingPhones.add(whatsapp);
      currentCount += 1;
      imported += 1;
    } catch (ex) {
      rejected.push(`${name} (${ex instanceof Error ? ex.message : 'erro'})`);
    }
  }

  return { imported, rejected };
}

// ---------- Expediente & Dias Bloqueados ----------

export async function toggleBlockedDate(ws: StudioWorkspace, dateStr: string): Promise<void> {
  const isBlocked = ws.blockedDates.includes(dateStr);
  if (isSupabaseConfigured && supabase) {
    if (isBlocked) {
      const { error } = await supabase
        .from('mr_blocked_days')
        .delete()
        .eq('studio_id', ws.studio.id)
        .eq('blocked_date', dateStr);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('mr_blocked_days')
        .insert({ studio_id: ws.studio.id, blocked_date: dateStr, reason: 'Folga / Bloqueio manual' });
      if (error) throw new Error(error.message);
    }
    return;
  }
  const next = isBlocked ? ws.blockedDates.filter((d) => d !== dateStr) : [...ws.blockedDates, dateStr];
  writeLocalState({ ...ws, blockedDates: next });
}

export async function saveWorkingHours(ws: StudioWorkspace, hours: WorkingHour[]): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const rows = hours.map((h) => ({
      studio_id: ws.studio.id,
      day_of_week: h.day_of_week,
      active: h.active,
      start_time: h.start_time,
      end_time: h.end_time,
      break_start: h.break_start,
      break_end: h.break_end,
    }));
    const { error } = await supabase
      .from('mr_working_hours')
      .upsert(rows, { onConflict: 'studio_id,day_of_week' });
    if (error) throw new Error(error.message);
    return;
  }
  writeLocalState({ ...ws, workingHours: hours });
}

// ---------- Servidor Local de WhatsApp (Baileys / Porta 8086) ----------

const WA_LOCAL_URL_KEY = 'myrose_wa_local_url';

export function getLocalWhatsAppUrl(): string {
  return (localStorage.getItem(WA_LOCAL_URL_KEY) || 'http://localhost:8086').replace(/\/+$/, '');
}

export function setLocalWhatsAppUrl(url: string): void {
  localStorage.setItem(WA_LOCAL_URL_KEY, url.trim().replace(/\/+$/, '') || 'http://localhost:8086');
}

export async function fetchLocalWhatsAppStatus(): Promise<{
  status: string;
  qrImage?: string | null;
  user?: { id?: string } | null;
  sentCount?: number;
  recentLogs?: Array<{ id: string; number: string; preview: string; sentAt: string }>;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const res = await fetch(`${getLocalWhatsAppUrl()}/qr-data`, { signal: controller.signal });
    if (!res.ok) return { status: 'offline' };
    return await res.json();
  } catch {
    return { status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendWhatsAppSmart(
  phone: string,
  text: string
): Promise<{ mode: 'local' | 'wa_me' }> {
  const digits = phone.replace(/\D/g, '');
  const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${getLocalWhatsAppUrl()}/message/sendText/myrose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: fullPhone, text }),
      signal: controller.signal,
    });
    if (res.ok) {
      return { mode: 'local' };
    }
  } catch {
    // fallback automático para wa.me
  } finally {
    clearTimeout(timer);
  }

  window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  return { mode: 'wa_me' };
}

// ---------- Autoatendimento da Cliente (/agendar/:codigo) ----------

export async function fetchPublicClientBookings(codigo: string, whatsapp: string): Promise<Appointment[]> {
  const clean = whatsapp.replace(/\D/g, '');
  if (isSupabaseConfigured) {
    const res = await fetch(getPublicFunctionUrl('my-bookings', { codigo, whatsapp: clean }), {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Erro ao buscar agendamentos');
    return (data.appointments ?? []) as Appointment[];
  }
  const local = readLocalState();
  return local.appointments.filter((a) => a.client_whatsapp.replace(/\D/g, '') === clean);
}

export async function cancelPublicClientBooking(
  codigo: string,
  whatsapp: string,
  appointmentId: string
): Promise<void> {
  const clean = whatsapp.replace(/\D/g, '');
  if (isSupabaseConfigured) {
    const res = await fetch(getPublicFunctionUrl('cancel-booking'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ codigo, whatsapp: clean, appointmentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Erro ao cancelar agendamento');
    return;
  }
  const local = readLocalState();
  await updateAppointmentStatus(local, appointmentId, 'cancelado');
}
