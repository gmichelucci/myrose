import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  MessageCircle,
  Plus,
  Sparkles,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  computeAvailableSlots,
  formatCurrencyBRL,
  interpolateTemplate,
  toHHMM,
  toMinutes,
} from '../lib/domain';
import {
  createAppointment,
  createClient,
  rescheduleAppointment,
  sendWhatsAppSmart,
  toggleBlockedDate,
  updateAppointmentStatus,
} from '../services/repository';
import type { Appointment, AppointmentStatus } from '../types/domain';

type CalendarView = 'dia' | 'semana' | 'mes';
type MetricsPeriod = 'hoje' | '7' | '30' | 'mes' | 'todo';

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function formatBR(iso: string): string {
  return iso.split('-').reverse().join('/');
}

function statusPillClasses(status: AppointmentStatus): string {
  switch (status) {
    case 'agendado':
      return 'bg-gradient-to-br from-blue-500 to-blue-600 border border-blue-400/50 text-white shadow-xs';
    case 'confirmado':
      return 'bg-gradient-to-br from-amber-500 to-amber-600 border border-amber-400/50 text-white shadow-xs';
    case 'realizado':
      return 'bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-400/50 text-white shadow-xs';
    case 'cancelado':
      return 'bg-gradient-to-br from-red-500 to-red-600 border border-red-400/50 text-white opacity-75';
    default:
      return 'bg-zinc-700 text-white';
  }
}

export default function AgendaPage() {
  const { workspace, refreshWorkspace } = useAuth();

  const [view, setView] = useState<CalendarView>('mes');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>('mes');
  const [filterColab, setFilterColab] = useState<string>('');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSlots, setCopiedSlots] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Modals
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [freeSlotsModalOpen, setFreeSlotsModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  // New Appointment Form State
  const [inlineNewClient, setInlineNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  const [clientId, setClientId] = useState('');
  const [subserviceId, setSubserviceId] = useState('');
  const [colabId, setColabId] = useState('');
  const [formDate, setFormDate] = useState(() => toISODate(new Date()));
  const [formStartTime, setFormStartTime] = useState('10:00');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit date/time inside selected appointment modal
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  // Block modal state
  const [blockDateInput, setBlockDateInput] = useState(() => toISODate(new Date()));

  if (!workspace) return null;

  const todayISO = toISODate(new Date());
  const selectedISO = toISODate(currentDate);
  const publicBookingUrl = `${window.location.origin}/agendar/${workspace.studio.booking_slug}`;

  const scopedAppointments = useMemo(() => {
    return workspace.appointments.filter((a) => {
      if (filterColab && (a.collaborator_id ?? '') !== filterColab) return false;
      return true;
    });
  }, [workspace.appointments, filterColab]);

  const metrics = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const inPeriod = scopedAppointments.filter((a) => {
      const d = parseISODate(a.appointment_date);
      d.setHours(0, 0, 0, 0);
      if (metricsPeriod === 'hoje') return a.appointment_date === todayISO;
      if (metricsPeriod === '7') {
        const diff = Math.abs(d.getTime() - now.getTime()) / 86400000;
        return diff <= 7;
      }
      if (metricsPeriod === '30') {
        const diff = Math.abs(d.getTime() - now.getTime()) / 86400000;
        return diff <= 30;
      }
      if (metricsPeriod === 'mes') {
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
      }
      return true;
    });

    return {
      agendados: inPeriod.filter((a) => a.status === 'agendado').length,
      confirmados: inPeriod.filter((a) => a.status === 'confirmado').length,
      realizados: inPeriod.filter((a) => a.status === 'realizado').length,
      cancelados: inPeriod.filter((a) => a.status === 'cancelado').length,
    };
  }, [scopedAppointments, metricsPeriod, todayISO, currentDate]);

  // Month grid days
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1, 12, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 12, 0, 0);
    const leadingEmpty = firstDay.getDay();
    const days: Date[] = [];
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d, 12, 0, 0));
    }
    const trailingEmpty = (7 - ((leadingEmpty + days.length) % 7)) % 7;
    return { leadingEmpty, days, trailingEmpty };
  }, [currentDate]);

  // Week grid days (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // Hourly slots for Day and Week views (08:00 to 20:00)
  const timeRows = useMemo(() => {
    const rows: string[] = [];
    for (let h = 8; h <= 20; h++) {
      rows.push(`${String(h).padStart(2, '0')}:00`);
      if (h < 20) rows.push(`${String(h).padStart(2, '0')}:30`);
    }
    return rows;
  }, []);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of scopedAppointments) {
      const list = map.get(a.appointment_date) ?? [];
      list.push(a);
      map.set(a.appointment_date, list);
    }
    for (const list of map.values()) {
      list.sort((x, y) => x.start_time.localeCompare(y.start_time));
    }
    return map;
  }, [scopedAppointments]);

  const openNewAppointmentModal = (dateISO?: string, startHHMM?: string) => {
    setErr(null);
    setFormDate(dateISO ?? selectedISO);
    setFormStartTime(startHHMM ?? '10:00');
    setColabId(filterColab || '');
    setFormNotes('');
    setInlineNewClient(workspace.clients.length === 0);
    setNewModalOpen(true);
  };

  const openAppointmentDetails = (appt: Appointment) => {
    setSelectedAppt(appt);
    setEditDate(appt.appointment_date);
    setEditTime(appt.start_time.slice(0, 5));
  };

  const handleNavigate = (dir: -1 | 1) => {
    const next = new Date(currentDate);
    if (view === 'dia') {
      next.setDate(next.getDate() + dir);
    } else if (view === 'semana') {
      next.setDate(next.getDate() + dir * 7);
    } else {
      next.setMonth(next.getMonth() + dir);
    }
    setCurrentDate(next);
  };

  const handleCreateAppointment = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const sub = workspace.subservices.find((s) => s.id === subserviceId) ?? workspace.subservices[0];
    if (!sub) {
      setErr('Cadastre ou selecione um procedimento no Catálogo primeiro.');
      return;
    }

    setSaving(true);
    try {
      let targetClient = workspace.clients.find((c) => c.id === clientId);
      if (inlineNewClient) {
        if (newClientName.trim().length < 2 || newClientWhatsapp.replace(/\D/g, '').length < 10) {
          throw new Error('Informe o nome e o WhatsApp com DDD da nova cliente.');
        }
        targetClient = await createClient(workspace, {
          name: newClientName.trim(),
          whatsapp: newClientWhatsapp.replace(/\D/g, ''),
        });
      }
      if (!targetClient) {
        throw new Error('Selecione uma cliente ou clique em "+ Nova Cliente".');
      }

      await createAppointment(workspace, {
        client_id: targetClient.id,
        client_name: targetClient.name,
        client_whatsapp: targetClient.whatsapp,
        appointment_date: formDate,
        start_time: formStartTime,
        subservice: sub,
        collaborator_id: colabId || null,
        notes: formNotes.trim() || null,
      });

      setNewModalOpen(false);
      setNewClientName('');
      setNewClientWhatsapp('');
      setFormNotes('');
      await refreshWorkspace();
      setNotice(`Agendamento de ${targetClient.name} criado em ${formatBR(formDate)} às ${formStartTime}!`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro ao criar agendamento');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (appt: Appointment, status: AppointmentStatus) => {
    await updateAppointmentStatus(workspace, appt.id, status);
    await refreshWorkspace();
    setSelectedAppt(null);
    setNotice(
      status === 'realizado'
        ? `Atendimento de ${appt.client_name} concluído e contabilizado no faturamento!`
        : status === 'cancelado'
          ? `Agendamento de ${appt.client_name} marcado como cancelado.`
          : `Status atualizado para ${status}.`
    );
  };

  const handleReschedule = async () => {
    if (!selectedAppt || !editDate || !editTime) return;
    await rescheduleAppointment(workspace, selectedAppt.id, editDate, editTime);
    await refreshWorkspace();
    setSelectedAppt(null);
    setNotice(`Agendamento remarcado para ${formatBR(editDate)} às ${editTime}.`);
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, apptId: string) => {
    setDraggingId(apptId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnDate = async (e: DragEvent<HTMLDivElement>, targetDateISO: string) => {
    e.preventDefault();
    if (!draggingId) return;
    const appt = workspace.appointments.find((a) => a.id === draggingId);
    setDraggingId(null);
    if (!appt || appt.appointment_date === targetDateISO) return;
    await rescheduleAppointment(workspace, appt.id, targetDateISO);
    await refreshWorkspace();
    setNotice(`Agendamento de ${appt.client_name} movido para ${formatBR(targetDateISO)}!`);
  };

  const handleToggleBlock = async (d: string) => {
    if (!d) return;
    await toggleBlockedDate(workspace, d);
    await refreshWorkspace();
  };

  const reminderTpl = workspace.templates.find((t) => t.type === 'agendamento')?.message ?? '';

  const handleSendWhatsApp = async (a: Appointment) => {
    const msg = interpolateTemplate(reminderTpl, {
      cliente: a.client_name.split(' ')[0],
      profissional: workspace.studio.owner_name,
      data: formatBR(a.appointment_date),
      horario: a.start_time.slice(0, 5),
      procedimentos: a.items?.map((i) => i.subservice_name).join(', ') || 'Procedimento',
      endereco: workspace.studio.address || 'Nosso estúdio',
    });
    const res = await sendWhatsAppSmart(a.client_whatsapp, msg);
    setNotice(
      res.mode === 'local'
        ? `Confirmação enviada pelo Servidor Local para ${a.client_name}!`
        : `Conversa aberta no WhatsApp para ${a.client_name}.`
    );
  };

  const freeSlotsForSelectedDay = useMemo(() => {
    return computeAvailableSlots({
      date: selectedISO,
      durationMinutes: 60,
      slotIntervalMinutes: workspace.studio.slot_interval_minutes || 30,
      minAdvanceHours: 0,
      workingHours: workspace.workingHours,
      blockedDates: workspace.blockedDates,
      appointments: scopedAppointments,
    });
  }, [selectedISO, workspace.studio, workspace.workingHours, workspace.blockedDates, scopedAppointments]);

  const freeSlotsShareText = useMemo(() => {
    const list = freeSlotsForSelectedDay.map((s) => `• ${s.start}`).join('\n');
    return (
      `✨ *Horários disponíveis — ${workspace.studio.business_name}*\n` +
      `📅 Data: ${formatBR(selectedISO)} (${WEEKDAYS_FULL[currentDate.getDay()]})\n\n` +
      (list || 'Sem horários livres nesta data.') +
      `\n\n📲 Agende online 24h: ${publicBookingUrl}`
    );
  }, [freeSlotsForSelectedDay, workspace.studio.business_name, selectedISO, currentDate, publicBookingUrl]);

  const selectedSub = workspace.subservices.find((s) => s.id === subserviceId) ?? workspace.subservices[0];
  const calculatedEndTime = selectedSub
    ? toHHMM(toMinutes(formStartTime) + selectedSub.duration_minutes)
    : toHHMM(toMinutes(formStartTime) + 60);

  return (
    <div className="space-y-5">
      {/* Cabeçalho estilo v1: Título + Novo Agendamento + Bloquear Agenda */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950">Agenda</h1>
          <p className="text-xs text-zinc-500">
            Clique em qualquer dia ou horário do calendário para agendar, ou arraste um atendimento para remarcar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openNewAppointmentModal()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-700 to-red-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> Novo Agendamento
          </button>
          <button
            type="button"
            onClick={() => setBlockModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50"
          >
            <CalendarOff className="h-4 w-4 text-red-700" /> Bloquear Agenda
          </button>
        </div>
      </div>

      {/* Card duplo superior: Link de Agendamento Online + Horários Livres */}
      <div className="grid overflow-hidden rounded-2xl border border-red-200/70 bg-gradient-to-br from-red-50/70 via-white to-red-50/30 shadow-2xs md:grid-cols-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 p-4 md:border-b-0 md:border-r">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <Link2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-950">Link de Agendamento Online</p>
              <p className="truncate font-mono text-xs text-zinc-500">{publicBookingUrl}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(publicBookingUrl);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50"
          >
            <Copy className="h-3.5 w-3.5 text-red-700" /> {copiedLink ? 'Link copiado!' : 'Copiar'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-950">Horários Livres p/ WhatsApp & Stories</p>
              <p className="truncate text-xs text-zinc-500">
                Gere a lista de horários vagos do dia para enviar às clientes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFreeSlotsModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50"
          >
            <Clock className="h-3.5 w-3.5 text-red-700" /> Ver Horários Livres
          </button>
        </div>
      </div>

      {/* Card de Métricas da Agenda por Status */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-red-700" />
            <span className="text-xs font-bold text-zinc-900">Período das métricas</span>
          </div>
          <div className="inline-flex flex-wrap rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
            {([
              ['hoje', 'Hoje'],
              ['7', 'Últimos 7 dias'],
              ['30', 'Últimos 30 dias'],
              ['mes', 'Este mês'],
              ['todo', 'Todo período'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMetricsPeriod(key)}
                className={`rounded-lg px-2.5 py-1 ${
                  metricsPeriod === key ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <div className="rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 p-3">
            <p className="text-xl font-extrabold text-zinc-950">{metrics.agendados}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Agendados</p>
          </div>
          <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 p-3">
            <p className="text-xl font-extrabold text-zinc-950">{metrics.realizados}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Realizados</p>
          </div>
          <div className="rounded-xl border border-red-200/60 bg-gradient-to-br from-red-50/70 via-white to-red-50/30 p-3">
            <p className="text-xl font-extrabold text-zinc-950">{metrics.cancelados}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Cancelados</p>
          </div>
          <div className="rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-3">
            <p className="text-xl font-extrabold text-zinc-950">{metrics.confirmados}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Confirmados</p>
          </div>
        </div>
      </div>

      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          {notice}
        </p>
      )}

      {/* Calendário Principal: Barra de Navegação + Dia / Semana / Mês */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleNavigate(-1)}
              className="rounded-xl border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-100"
              title="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(1)}
              className="rounded-xl border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-100"
              title="Próximo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <h2 className="ml-1 text-base font-bold text-zinc-950">
              {view === 'mes' && `${MONTHS_PT[currentDate.getMonth()]} de ${currentDate.getFullYear()}`}
              {view === 'semana' &&
                `Semana de ${formatBR(toISODate(weekDays[0]))} a ${formatBR(toISODate(weekDays[6]))}`}
              {view === 'dia' &&
                `${WEEKDAYS_FULL[currentDate.getDay()]}, ${currentDate.getDate()} de ${MONTHS_PT[currentDate.getMonth()]}`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workspace.collaborators.length > 0 && (
              <select
                value={filterColab}
                onChange={(e) => setFilterColab(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-800"
              >
                <option value="">Todas as profissionais</option>
                {workspace.collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    Agenda: {c.name}
                  </option>
                ))}
              </select>
            )}

            <input
              type="date"
              value={selectedISO}
              onChange={(e) => {
                if (e.target.value) setCurrentDate(parseISODate(e.target.value));
              }}
              className="rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs"
            />

            <div className="inline-flex rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
              {([
                ['dia', 'Dia'],
                ['semana', 'Semana'],
                ['mes', 'Mês'],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1.5 ${
                    view === v ? 'bg-red-700 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* VISUALIZAÇÃO 1: MÊS (Grade de Calendário 7 colunas igual à versão antiga) */}
        {view === 'mes' && (
          <div className="p-4">
            <div className="mb-2 hidden grid-cols-7 gap-1.5 sm:grid">
              {WEEKDAYS_SHORT.map((wd) => (
                <div key={wd} className="py-1.5 text-center text-xs font-bold uppercase tracking-wide text-zinc-400">
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-7 sm:gap-1.5">
              {Array.from({ length: monthGrid.leadingEmpty }).map((_, idx) => (
                <div
                  key={`lead-${idx}`}
                  className="hidden min-h-28 rounded-xl border border-zinc-100 bg-zinc-50/40 p-2 sm:block"
                />
              ))}

              {monthGrid.days.map((d) => {
                const iso = toISODate(d);
                const isToday = iso === todayISO;
                const isBlocked = workspace.blockedDates.includes(iso);
                const dayAppts = appointmentsByDate.get(iso) ?? [];
                const isExpanded = Boolean(expandedDays[iso]);
                const maxVisible = 3;
                const visibleAppts = isExpanded ? dayAppts : dayAppts.slice(0, maxVisible);

                return (
                  <div
                    key={iso}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => void handleDropOnDate(e, iso)}
                    onClick={() => openNewAppointmentModal(iso, '10:00')}
                    className={`flex min-h-28 cursor-pointer flex-col rounded-xl border p-2 transition hover:shadow-md ${
                      isToday
                        ? 'border-red-400 bg-red-50/30 ring-1 ring-red-500/20'
                        : isBlocked
                          ? 'border-dashed border-zinc-300 bg-zinc-50/80'
                          : 'border-zinc-200/80 bg-white hover:border-red-300'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          isToday ? 'bg-red-700 text-white' : 'text-zinc-800'
                        }`}
                      >
                        {d.getDate()}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-400 sm:hidden">
                        {WEEKDAYS_SHORT[d.getDay()]}
                      </span>
                      {dayAppts.length > 0 && (
                        <span className="text-[10px] font-semibold text-zinc-400">
                          {dayAppts.length} atend.
                        </span>
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      {isBlocked && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setBlockDateInput(iso);
                            setBlockModalOpen(true);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-100 px-1.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-200"
                        >
                          <CalendarOff className="h-3 w-3 shrink-0 text-red-700" />
                          <span className="truncate">Dia bloqueado</span>
                        </div>
                      )}

                      {visibleAppts.map((a) => {
                        const procName = a.items?.[0]?.subservice_name ?? 'Atendimento';
                        const extraCount = (a.items?.length ?? 1) - 1;
                        return (
                          <div
                            key={a.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, a.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              openAppointmentDetails(a);
                            }}
                            className={`rounded-lg p-1.5 text-[11px] transition hover:brightness-105 ${statusPillClasses(
                              a.status
                            )}`}
                          >
                            <div className="opacity-90">
                              {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}
                            </div>
                            <div className="truncate font-bold">{a.client_name}</div>
                            <div className="truncate text-[10px] opacity-90">
                              {procName}
                              {extraCount > 0 ? ` +${extraCount}` : ''}
                            </div>
                          </div>
                        );
                      })}

                      {dayAppts.length > maxVisible && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDays((prev) => ({ ...prev, [iso]: !isExpanded }));
                          }}
                          className="w-full pt-0.5 text-left text-[11px] font-semibold text-red-700 hover:underline"
                        >
                          {isExpanded ? 'Mostrar menos' : `+${dayAppts.length - maxVisible} mais`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {Array.from({ length: monthGrid.trailingEmpty }).map((_, idx) => (
                <div
                  key={`trail-${idx}`}
                  className="hidden min-h-28 rounded-xl border border-zinc-100 bg-zinc-50/40 p-2 sm:block"
                />
              ))}
            </div>
          </div>
        )}

        {/* VISUALIZAÇÃO 2: SEMANA (Grade de 7 dias com colunas por dia e horários) */}
        {view === 'semana' && (
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[780px] grid-cols-7 gap-2">
              {weekDays.map((d) => {
                const iso = toISODate(d);
                const isToday = iso === todayISO;
                const isBlocked = workspace.blockedDates.includes(iso);
                const dayAppts = appointmentsByDate.get(iso) ?? [];

                return (
                  <div
                    key={iso}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => void handleDropOnDate(e, iso)}
                    className={`flex min-h-[420px] flex-col rounded-xl border p-2.5 ${
                      isToday ? 'border-red-400 bg-red-50/20' : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentDate(d);
                        setView('dia');
                      }}
                      className="mb-2 border-b border-zinc-100 pb-2 text-center hover:text-red-700"
                    >
                      <p className="text-xs font-bold uppercase text-zinc-400">{WEEKDAYS_SHORT[d.getDay()]}</p>
                      <p className={`text-base font-extrabold ${isToday ? 'text-red-700' : 'text-zinc-950'}`}>
                        {formatBR(iso).slice(0, 5)}
                      </p>
                    </button>

                    <div className="flex-1 space-y-1.5">
                      {isBlocked && (
                        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-100 p-2 text-center text-xs font-semibold text-zinc-600">
                          Dia bloqueado
                        </div>
                      )}
                      {dayAppts.map((a) => (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, a.id)}
                          onClick={() => openAppointmentDetails(a)}
                          className={`cursor-pointer rounded-xl p-2 text-xs ${statusPillClasses(a.status)}`}
                        >
                          <div className="font-semibold opacity-90">
                            {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}
                          </div>
                          <div className="font-bold">{a.client_name}</div>
                          <div className="truncate text-[11px] opacity-90">
                            {a.items?.map((i) => i.subservice_name).join(', ')}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => openNewAppointmentModal(iso, '10:00')}
                        className="mt-2 w-full rounded-lg border border-dashed border-zinc-200 py-1.5 text-[11px] font-semibold text-zinc-400 hover:border-red-300 hover:text-red-700"
                      >
                        + Agendar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VISUALIZAÇÃO 3: DIA (Grade vertical de horários 08:00 às 20:00 igual à versão antiga) */}
        {view === 'dia' && (
          <div className="mx-auto max-w-2xl p-4">
            {workspace.blockedDates.includes(selectedISO) && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-dashed border-red-300 bg-red-50/50 p-3 text-xs font-semibold text-red-800">
                <span>Este dia está marcado como bloqueado (folga/feriado).</span>
                <button
                  type="button"
                  onClick={() => void handleToggleBlock(selectedISO)}
                  className="rounded-lg bg-white px-2.5 py-1 text-zinc-800 shadow-2xs"
                >
                  Desbloquear dia
                </button>
              </div>
            )}

            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
              {timeRows.map((hhmm) => {
                const slotAppts = (appointmentsByDate.get(selectedISO) ?? []).filter(
                  (a) => a.start_time.slice(0, 5) === hhmm
                );
                return (
                  <div
                    key={hhmm}
                    onClick={() => {
                      if (slotAppts.length === 0) openNewAppointmentModal(selectedISO, hhmm);
                    }}
                    className="flex min-h-12 cursor-pointer items-start gap-3 px-3.5 py-2 transition hover:bg-zinc-50"
                  >
                    <span className="w-14 shrink-0 pt-1 font-mono text-xs font-semibold text-zinc-400">
                      {hhmm}
                    </span>
                    <div className="flex-1 space-y-1.5">
                      {slotAppts.length === 0 ? (
                        <span className="inline-block pt-1 text-xs text-zinc-300 hover:text-red-700">
                          + Horário livre (clique para agendar)
                        </span>
                      ) : (
                        slotAppts.map((a) => (
                          <div
                            key={a.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openAppointmentDetails(a);
                            }}
                            className={`rounded-xl p-3 text-xs ${statusPillClasses(a.status)}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">
                                {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)} · {a.client_name}
                              </span>
                              <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase">
                                {a.status}
                              </span>
                            </div>
                            <p className="mt-0.5 opacity-90">
                              {a.items?.map((i) => i.subservice_name).join(', ')} · {formatCurrencyBRL(a.total_cents)}
                              {a.notes ? ` · ${a.notes}` : ''}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: DETALHES DO AGENDAMENTO (Ao clicar em um agendamento no calendário) */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-zinc-700">
                  {selectedAppt.status}
                </span>
                <h3 className="mt-1.5 text-lg font-bold text-zinc-950">{selectedAppt.client_name}</h3>
                <p className="text-xs text-zinc-500">
                  {formatBR(selectedAppt.appointment_date)} · {selectedAppt.start_time.slice(0, 5)} às{' '}
                  {selectedAppt.end_time.slice(0, 5)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppt(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs space-y-1">
              <p>
                <strong>Procedimento(s):</strong>{' '}
                {selectedAppt.items?.map((i) => i.subservice_name).join(', ') || 'Atendimento'}
              </p>
              <p>
                <strong>Valor Total:</strong>{' '}
                <span className="font-bold text-red-700">{formatCurrencyBRL(selectedAppt.total_cents)}</span>
              </p>
              {selectedAppt.client_whatsapp && (
                <p>
                  <strong>WhatsApp:</strong> {selectedAppt.client_whatsapp}
                </p>
              )}
              {selectedAppt.notes && (
                <p>
                  <strong>Observações / Sinal:</strong> {selectedAppt.notes}
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-zinc-200 pt-3">
              <p className="text-xs font-bold text-zinc-700">Remarcar data ou horário:</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs"
                />
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void handleReschedule()}
                  className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Salvar
                </button>
              </div>
            </div>

            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              {selectedAppt.client_whatsapp && (
                <button
                  type="button"
                  onClick={() => void handleSendWhatsApp(selectedAppt)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 sm:col-span-2"
                >
                  <MessageCircle className="h-4 w-4" /> Falar com cliente / Enviar confirmação
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleChangeStatus(selectedAppt, 'realizado')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <CheckCircle2 className="h-4 w-4" /> Atendimento concluído
              </button>
              <button
                type="button"
                onClick={() => void handleChangeStatus(selectedAppt, 'confirmado')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                <Clock className="h-4 w-4" /> Marcar Confirmado
              </button>
              <button
                type="button"
                onClick={() => void handleChangeStatus(selectedAppt, 'cancelado')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 sm:col-span-2"
              >
                <XCircle className="h-4 w-4" /> Cancelar agendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NOVO AGENDAMENTO (Igual ao modal da versão antiga, com opção + Nova Cliente embutida) */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateAppointment}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-950">Novo Agendamento</h3>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700">Cliente</label>
                <button
                  type="button"
                  onClick={() => setInlineNewClient((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {inlineNewClient ? 'Selecionar cliente existente' : '+ Nova Cliente'}
                </button>
              </div>

              {inlineNewClient ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    required
                    placeholder="Nome da nova cliente"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="WhatsApp com DDD"
                    value={newClientWhatsapp}
                    onChange={(e) => setNewClientWhatsapp(e.target.value)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                >
                  <option value="">Selecione uma cliente...</option>
                  {workspace.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.whatsapp})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">Procedimento</label>
                <select
                  required
                  value={subserviceId || workspace.subservices[0]?.id || ''}
                  onChange={(e) => setSubserviceId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                >
                  {workspace.subservices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes}min · {formatCurrencyBRL(s.promo_price_cents ?? s.price_cents)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">Profissional</label>
                <select
                  value={colabId}
                  onChange={(e) => setColabId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                >
                  <option value="">{workspace.studio.owner_name} (Principal)</option>
                  {workspace.collaborators.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">Data</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">Horário Início</label>
                <input
                  type="time"
                  required
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">Horário Fim (automático)</label>
                <input
                  type="time"
                  disabled
                  value={calculatedEndTime}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-600"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Observações (opcional)</label>
              <input
                placeholder="Ex: Sinal pago via Pix, preferência por curvatura D..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>

            {err && <p className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700">{err}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-700 px-5 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Confirmar Agendamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: BLOQUEAR AGENDA (Folgas e Feriados) */}
      {blockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-zinc-950">
                <CalendarOff className="h-5 w-5 text-red-700" /> Bloquear Agenda
              </h3>
              <button
                type="button"
                onClick={() => setBlockModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600">
              Dias bloqueados não aparecem como disponíveis no link de agendamento online das clientes.
            </p>

            <div className="flex gap-2">
              <input
                type="date"
                value={blockDateInput}
                onChange={(e) => setBlockDateInput(e.target.value)}
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleToggleBlock(blockDateInput)}
                className="rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                {workspace.blockedDates.includes(blockDateInput) ? 'Desbloquear' : 'Bloquear dia'}
              </button>
            </div>

            {workspace.blockedDates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-zinc-700">Dias bloqueados atualmente:</p>
                <div className="flex flex-wrap gap-1.5">
                  {workspace.blockedDates.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => void handleToggleBlock(d)}
                      className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                    >
                      {formatBR(d)} ×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: HORÁRIOS LIVRES PARA COMPARTILHAR */}
      {freeSlotsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-950">Horários Livres ({formatBR(selectedISO)})</h3>
              <button
                type="button"
                onClick={() => setFreeSlotsModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 font-sans text-xs text-zinc-800">
              {freeSlotsShareText}
            </pre>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(freeSlotsShareText);
                  setCopiedSlots(true);
                  setTimeout(() => setCopiedSlots(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                <Copy className="h-3.5 w-3.5" /> {copiedSlots ? 'Copiado!' : 'Copiar para WhatsApp / Stories'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
