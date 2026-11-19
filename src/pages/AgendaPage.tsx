import { useState, type FormEvent } from 'react';
import { MessageCircle, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrencyBRL, interpolateTemplate } from '../lib/domain';
import { createAppointment, updateAppointmentStatus } from '../services/repository';
import type { AppointmentStatus } from '../types/domain';

export default function AgendaPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [filterDate, setFilterDate] = useState('');
  const [clientId, setClientId] = useState('');
  const [subserviceId, setSubserviceId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!workspace) return null;

  const list = filterDate
    ? workspace.appointments.filter((a) => a.appointment_date === filterDate)
    : workspace.appointments;

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

  const reminderTpl = workspace.templates.find((t) => t.type === 'agendamento')?.message ?? '';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-950">Agenda</h1>

      <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-5">
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
        {err && <p className="text-xs text-red-600 md:col-span-5">{err}</p>}
      </form>

      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-zinc-600">Filtrar dia:</label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs"
        />
        {filterDate && (
          <button type="button" onClick={() => setFilterDate('')} className="text-xs text-red-700 hover:underline">
            Limpar
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
          const waUrl = `https://wa.me/${waPhone.startsWith('55') ? waPhone : `55${waPhone}`}?text=${encodeURIComponent(msg)}`;

          return (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
              <div>
                <p className="font-bold text-zinc-950">
                  {a.appointment_date.split('-').reverse().join('/')} · {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)} · {a.client_name}
                </p>
                <p className="text-xs text-zinc-500">
                  {a.items?.map((i) => i.subservice_name).join(', ')} · {formatCurrencyBRL(a.total_cents)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {waPhone && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Avisar
                  </a>
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
