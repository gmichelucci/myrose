import { useState, type FormEvent } from 'react';
import { CalendarOff, MessageCircle, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrencyBRL, interpolateTemplate } from '../lib/domain';
import {
  createAppointment,
  sendWhatsAppSmart,
  toggleBlockedDate,
  updateAppointmentStatus,
} from '../services/repository';
import type { AppointmentStatus } from '../types/domain';

export default function AgendaPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [filterDate, setFilterDate] = useState('');
  const [filterColab, setFilterColab] = useState('');
  const [clientId, setClientId] = useState('');
  const [subserviceId, setSubserviceId] = useState('');
  const [colabId, setColabId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00');
  const [blockDateInput, setBlockDateInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!workspace) return null;

  const list = workspace.appointments.filter((a) => {
    if (filterDate && a.appointment_date !== filterDate) return false;
    if (filterColab && (a.collaborator_id ?? '') !== filterColab) return false;
    return true;
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const client = workspace.clients.find((c) => c.id === clientId);
    const sub = workspace.subservices.find((s) => s.id === subserviceId);
    if (!client || !sub) {
      setErr('Selecione cliente e procedimento.');
      return;
    }
    setSaving(true);
    try {
      await createAppointment(workspace, {
        client_id: client.id,
        client_name: client.name,
        client_whatsapp: client.whatsapp,
        appointment_date: date,
        start_time: startTime,
        subservice: sub,
        collaborator_id: colabId || null,
      });
      await refreshWorkspace();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro ao agendar');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: AppointmentStatus) => {
    await updateAppointmentStatus(workspace, id, status);
    await refreshWorkspace();
  };

  const handleToggleBlock = async (d: string) => {
    if (!d) return;
    await toggleBlockedDate(workspace, d);
    setBlockDateInput('');
    await refreshWorkspace();
  };

  const reminderTpl = workspace.templates.find((t) => t.type === 'agendamento')?.message ?? '';

  const handleSendWhatsApp = async (clientName: string, waPhone: string, msg: string) => {
    const res = await sendWhatsAppSmart(waPhone, msg);
    setNotice(
      res.mode === 'local'
        ? `Confirmação enviada pelo Servidor Local para ${clientName}!`
        : `Conversa aberta no WhatsApp para ${clientName}.`
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-950">Agenda & Bloqueio de Dias</h1>

      <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-6">
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Cliente...</option>
          {workspace.clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          required
          value={subserviceId}
          onChange={(e) => setSubserviceId(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Procedimento...</option>
          {workspace.subservices.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}m)</option>
          ))}
        </select>
        <select
          value={colabId}
          onChange={(e) => setColabId(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Profissional principal</option>
          {workspace.collaborators.map((col) => (
            <option key={col.id} value={col.id}>{col.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          <Plus className="h-4 w-4" /> Agendar
        </button>
        {err && <p className="text-xs text-red-600 md:col-span-6">{err}</p>}
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
            <CalendarOff className="h-4 w-4 text-red-700" /> Bloquear dia de folga / feriado:
            <input
              type="date"
              value={blockDateInput}
              onChange={(e) => setBlockDateInput(e.target.value)}
              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => void handleToggleBlock(blockDateInput)}
              className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Bloquear / Desbloquear
            </button>
          </div>
          {workspace.blockedDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-zinc-500">Bloqueados:</span>
              {workspace.blockedDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => void handleToggleBlock(d)}
                  className="rounded-full bg-red-50 px-2.5 py-0.5 font-medium text-red-800 hover:bg-red-100"
                  title="Clique para desbloquear"
                >
                  {d.split('-').reverse().join('/')} ×
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{notice}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-zinc-600">Filtrar dia:</label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs"
        />
        {workspace.collaborators.length > 0 && (
          <select
            value={filterColab}
            onChange={(e) => setFilterColab(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs"
          >
            <option value="">Todas as agendas</option>
            {workspace.collaborators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {(filterDate || filterColab) && (
          <button
            type="button"
            onClick={() => {
              setFilterDate('');
              setFilterColab('');
            }}
            className="text-xs text-red-700 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {list.map((a) => {
          const msg = interpolateTemplate(reminderTpl, {
            cliente: a.client_name.split(' ')[0],
            profissional: workspace.studio.owner_name,
            data: a.appointment_date.split('-').reverse().join('/'),
            horario: a.start_time.slice(0, 5),
            procedimentos: a.items?.map((i) => i.subservice_name).join(', ') || 'Procedimento',
            endereco: workspace.studio.address || 'Nosso estúdio',
          });
          const waPhone = a.client_whatsapp.replace(/\D/g, '');

          return (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
              <div>
                <p className="font-bold text-zinc-950">
                  {a.appointment_date.split('-').reverse().join('/')} · {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)} · {a.client_name}
                </p>
                <p className="text-xs text-zinc-500">
                  {a.items?.map((i) => i.subservice_name).join(', ')} · {formatCurrencyBRL(a.total_cents)}
                  {a.notes ? ` · Obs/Sinal: ${a.notes}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {waPhone && (
                  <button
                    type="button"
                    onClick={() => void handleSendWhatsApp(a.client_name, waPhone, msg)}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Avisar
                  </button>
                )}
                <select
                  value={a.status}
                  onChange={(e) => void changeStatus(a.id, e.target.value as AppointmentStatus)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold"
                >
                  <option value="agendado">Agendado</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="realizado">Realizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
