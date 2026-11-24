export type PlanId = 'gratuito' | 'starter' | 'premium' | 'profissional';

export interface PlanSpec {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  clientLimit: number | null;
  mappingLimit: number | null;
  beautyAiMonthlyLimit: number;
  biaMonthlyLimit: number;
  teamLimit: number;
  inventoryEnabled: boolean;
  remindersEnabled: boolean;
  whatsappEnabled: boolean;
  highlight?: boolean;
}

export const PLANS: PlanSpec[] = [
  {
    id: 'gratuito',
    name: 'Gratuito',
    tagline: 'Para organizar os primeiros atendimentos',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    clientLimit: 5,
    mappingLimit: 5,
    beautyAiMonthlyLimit: 0,
    biaMonthlyLimit: 0,
    teamLimit: 0,
    inventoryEnabled: false,
    remindersEnabled: false,
    whatsappEnabled: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Ideal para quem está crescendo a carteira',
    monthlyPriceCents: 2990,
    annualPriceCents: 28680,
    clientLimit: 30,
    mappingLimit: 30,
    beautyAiMonthlyLimit: 30,
    biaMonthlyLimit: 150,
    teamLimit: 0,
    inventoryEnabled: true,
    remindersEnabled: true,
    whatsappEnabled: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'O melhor custo-benefício com WhatsApp e equipe',
    monthlyPriceCents: 3990,
    annualPriceCents: 38280,
    clientLimit: 100,
    mappingLimit: 100,
    beautyAiMonthlyLimit: 100,
    biaMonthlyLimit: 450,
    teamLimit: 3,
    inventoryEnabled: true,
    remindersEnabled: true,
    whatsappEnabled: true,
    highlight: true,
  },
  {
    id: 'profissional',
    name: 'Profissional',
    tagline: 'Operação ilimitada para estúdios consolidados',
    monthlyPriceCents: 7990,
    annualPriceCents: 71880,
    clientLimit: null,
    mappingLimit: null,
    beautyAiMonthlyLimit: 999999,
    biaMonthlyLimit: 650,
    teamLimit: 8,
    inventoryEnabled: true,
    remindersEnabled: true,
    whatsappEnabled: true,
  },
];

export type AppointmentStatus = 'agendado' | 'confirmado' | 'realizado' | 'cancelado';
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito';
export type RecurringFrequency = 'semanal' | 'mensal' | 'trimestral' | 'anual';

export interface Studio {
  id: string;
  auth_user_id: string;
  booking_slug: string;
  owner_name: string;
  business_name: string;
  specialty: string;
  whatsapp: string;
  email: string;
  plan_id: PlanId;
  slot_interval_minutes: number;
  min_advance_hours: number;
  pix_key: string;
  deposit_percent: number;
  address: string;
  google_review_url: string;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  plan_interval?: string | null;
  plan_current_period_end?: string | null;
}

export interface Client {
  id: string;
  studio_id: string;
  name: string;
  whatsapp: string;
  birth_date: string | null;
  notes: string | null;
  active: boolean;
  total_spent_cents: number;
  last_visit_at: string | null;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  studio_id: string;
  name: string;
  active: boolean;
}

export interface Subservice {
  id: string;
  studio_id: string;
  service_id: string;
  name: string;
  details: string | null;
  price_cents: number;
  promo_price_cents: number | null;
  duration_minutes: number;
  maintenance_days: number | null;
  active: boolean;
}

export interface WorkingHour {
  day_of_week: number; // 0 = Domingo .. 6 = Sábado
  active: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface Appointment {
  id: string;
  studio_id: string;
  client_id: string | null;
  collaborator_id: string | null;
  client_name: string;
  client_whatsapp: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  total_cents: number;
  deposit_paid_cents: number;
  payment_method: PaymentMethod;
  notes: string | null;
  items?: Array<{ subservice_id: string; subservice_name: string; price_cents: number }>;
}

export interface LashMapping {
  id: string;
  studio_id: string;
  client_id: string | null;
  client_name: string;
  technique: string;
  style: string;
  curl: string;
  thickness: string;
  sizes: string[];
  adhesive: string;
  notes: string | null;
  drawing_path?: string | null;
  drawing_data_url: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  studio_id: string;
  category: string;
  description: string;
  amount_cents: number;
  expense_date: string;
  is_recurring: boolean;
  recurring_frequency?: RecurringFrequency;
}

export interface InventoryItem {
  id: string;
  studio_id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  unit_cost_cents: number | null;
  expires_at: string | null;
}

export interface Collaborator {
  id: string;
  studio_id: string;
  name: string;
  role_title: string;
  email: string;
  commission_percent: number;
  separate_agenda: boolean;
  active: boolean;
  permissions: Record<string, boolean>;
}

export interface AnamnesisLink {
  token: string;
  client_id: string;
  areas: string[];
  expires_at: string;
}

export interface AnamnesisRecord {
  client_id: string;
  areas: string[];
  answers: Record<string, string>;
  updated_at: string;
}

export const LASH_TECHNIQUES = [
  'Brasileiro',
  'Efeito Rimel',
  'Fox Eyes',
  'Fio a Fio',
  'Híbrido',
  'Mega Volume',
  'Sirena',
  'Volume Egípcio',
  'Volume Russo',
  'Personalizado',
] as const;

export const LASH_STYLES = ['Boneca', 'Esquilo', 'Gatinho', 'Gatão', 'Personalizado'] as const;
export const LASH_CURLS = ['J', 'B', 'C', 'CC', 'D', 'DD', 'L', 'M'] as const;
export const LASH_THICKNESSES = ['0.03', '0.05', '0.07', '0.10', '0.15', '0.20'] as const;
export const LASH_LENGTHS = [
  '5mm', '6mm', '7mm', '8mm', '9mm', '10mm', '11mm', '12mm',
  '13mm', '14mm', '15mm', '16mm', '17mm', '18mm', '19mm', '20mm',
] as const;

export const ANAMNESIS_AREAS = [
  { id: 'lash_designer', label: 'Extensão de Cílios' },
  { id: 'lash_lifting', label: 'Lash Lifting' },
  { id: 'designer_sobrancelhas', label: 'Designer de Sobrancelhas' },
  { id: 'brow_lamination', label: 'Brow Lamination' },
  { id: 'micropigmentacao', label: 'Micropigmentação' },
  { id: 'nail_designer', label: 'Nail Designer' },
  { id: 'manicure_pedicure', label: 'Manicure/Pedicure' },
  { id: 'limpeza_pele', label: 'Limpeza de Pele' },
  { id: 'depilacao', label: 'Depilação' },
] as const;

export interface AnamnesisQuestion {
  id: string;
  question: string;
  type: 'radio' | 'text';
  area?: string;
}

export const ANAMNESIS_QUESTIONS: AnamnesisQuestion[] = [
  { id: 'gestante', question: 'É gestante ou lactante?', type: 'radio' },
  { id: 'alergia_geral', question: 'Possui alguma alergia conhecida? Quais?', type: 'text' },
  { id: 'medicacao_continua', question: 'Faz uso de medicação contínua?', type: 'text' },
  { id: 'alergia_cola', question: 'Já teve alergia a cola de cílios ou cosméticos?', type: 'radio', area: 'lash_designer' },
  { id: 'lentes_contato', question: 'Usa lentes de contato?', type: 'radio', area: 'lash_designer' },
  { id: 'blefarite_olho_seco', question: 'Possui blefarite ou olho seco?', type: 'radio', area: 'lash_designer' },
  { id: 'queloides', question: 'Tendência a queloides ou alergia a pigmentos?', type: 'radio', area: 'micropigmentacao' },
  { id: 'alergia_unhas', question: 'Alergia a esmalte, gel, acrílico ou acetona?', type: 'radio', area: 'nail_designer' },
];

export const EXPENSE_CATEGORIES = [
  'Material de Trabalho',
  'Custos Fixos',
  'Marketing e Divulgação',
  'Cursos e Educação',
  'Funcionários',
  'Impostos e Taxas',
  'Outros',
] as const;

export const INVENTORY_CATEGORIES = [
  'Cílios/Fios',
  'Colas e Removedores',
  'Descartáveis',
  'Higiene',
  'Sobrancelha',
  'Unhas',
  'Outros',
] as const;

export const INVENTORY_UNITS = ['un', 'ml', 'g', 'par', 'caixa', 'kit'] as const;

export interface WhatsAppTemplate {
  type: string;
  label: string;
  placeholders: string[];
  message: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    type: 'agendamento',
    label: 'Lembrete de Agendamento',
    placeholders: ['{cliente}', '{profissional}', '{data}', '{horario}', '{procedimentos}', '{endereco}'],
    message:
      'Oii, *{cliente}*! Passando para lembrar do seu horário com *{profissional}*:\n📅 {data} às {horario}\n✨ {procedimentos}\n📍 {endereco}',
  },
  {
    type: 'manutencao',
    label: 'Lembrete de Manutenção',
    placeholders: ['{cliente}', '{procedimento}', '{profissional}', '{link}'],
    message:
      'Oii, *{cliente}* 😊 Já está chegando a hora da manutenção do seu *{procedimento}* com *{profissional}*! Garanta seu horário: {link}',
  },
  {
    type: 'confirmacao_online',
    label: 'Confirmação de Agendamento Online',
    placeholders: ['{cliente}', '{data}', '{horario}', '{procedimentos}'],
    message: 'Agendamento confirmado ✅ Olá *{cliente}*, nos vemos em {data} às {horario} ({procedimentos}).',
  },
  {
    type: 'inativa_45',
    label: 'Resgate de Cliente (45 dias)',
    placeholders: ['{cliente}', '{link}'],
    message: 'Oii, *{cliente}* 💖 Faz 45 dias do seu último atendimento no MyRose. Que tal reservar seu horário esta semana? {link}',
  },
  {
    type: 'avaliacao',
    label: 'Pós-atendimento & Avaliação',
    placeholders: ['{cliente}', '{procedimento}', '{link_avaliacao}'],
    message: 'Oii, *{cliente}*! Como está amando seu *{procedimento}*? Sua avaliação é muito importante: {link_avaliacao}',
  },
];

export const COLLABORATOR_PERMISSIONS = [
  { key: 'clientes_ver', label: 'Ver clientes' },
  { key: 'clientes_editar', label: 'Cadastrar/editar clientes' },
  { key: 'agenda_colegas_ver', label: 'Ver agenda da equipe' },
  { key: 'agenda_colegas_editar', label: 'Editar agenda da equipe' },
  { key: 'faturamento_ver', label: 'Ver financeiro' },
  { key: 'despesas_editar', label: 'Lançar despesas' },
  { key: 'estoque_ver', label: 'Ver estoque' },
  { key: 'estoque_editar', label: 'Movimentar estoque' },
  { key: 'mappings_editar', label: 'Criar/editar Lash Mapping' },
  { key: 'lembretes', label: 'Gerenciar lembretes' },
] as const;
