import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { formatCurrencyBRL } from '../lib/domain';
import {
  fetchPublicAvailableSlots,
  fetchPublicStudioProfile,
  submitPublicBooking,
} from '../services/repository';
import type { ServiceCategory, Studio, Subservice } from '../types/domain';

export default function PublicBookingPage() {
  const { codigo = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [services, setServices] = useState<ServiceCategory[]>([]);
  const [subservices, setSubservices] = useState<Subservice[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ date: string; start: string; totalCents: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPublicStudioProfile(codigo)
      .then((res) => {
        setStudio(res.studio);
        setServices(res.services);
        setSubservices(res.subservices);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Estúdio não encontrado'))
      .finally(() => setLoading(false));
  }, [codigo]);

  const chosen = subservices.filter((s) => selectedIds.includes(s.id));
  const totalDuration = chosen.reduce((acc, s) => acc + s.duration_minutes, 0);
  const totalCents = chosen.reduce((acc, s) => acc + (s.promo_price_cents ?? s.price_cents), 0);

  useEffect(() => {
    if (!studio || totalDuration <= 0) {
      setSlots([]);
      setSelectedSlot('');
      return;
    }
    fetchPublicAvailableSlots(codigo, date, totalDuration)
      .then((s) => {
        setSlots(s);
        setSelectedSlot('');
      })
      .catch(() => setSlots([]));
  }, [codigo, studio, date, totalDuration]);

  const toggleService = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBook = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || chosen.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicBooking({
        codigo,
        clientName,
        clientWhatsapp,
        date,
        startTime: selectedSlot,
        subserviceIds: selectedIds,
        notes,
      });
      setConfirmed({ date, start: selectedSlot, totalCents });
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Falha ao confirmar agendamento');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-zinc-600">Carregando estúdio...</div>;
  if (error && !studio) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <img src="/logo.png" alt="MyRose" className="mx-auto mb-3 h-11 w-11 rounded-full object-cover ring-1 ring-zinc-900/15" />
        <p className="font-semibold text-zinc-950">{error}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-red-700 hover:underline">Voltar ao MyRose</Link>
      </div>
    );
  }
  if (!studio) return null;

  if (confirmed) {
    const deposit = studio.deposit_percent > 0 ? Math.round((confirmed.totalCents * studio.deposit_percent) / 100) : 0;
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-xl font-bold text-zinc-950">Agendamento solicitado!</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {studio.business_name} · {confirmed.date.split('-').reverse().join('/')} às {confirmed.start}
        </p>
        <p className="mt-2 text-base font-bold text-red-700">Total: {formatCurrencyBRL(confirmed.totalCents)}</p>
        {deposit > 0 && studio.pix_key && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700">
            <p className="font-semibold text-red-800">Sinal de {studio.deposit_percent}%: {formatCurrencyBRL(deposit)}</p>
            <p className="mt-1">Chave Pix: <span className="font-mono font-semibold">{studio.pix_key}</span></p>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setConfirmed(null);
            setSelectedIds([]);
          }}
          className="mt-6 w-full rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
        >
          Fazer novo agendamento
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/70 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-950">{studio.business_name}</h1>
              <p className="text-sm text-zinc-500">{studio.owner_name} · {studio.specialty}</p>
              {studio.address && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                  <MapPin className="h-3.5 w-3.5 text-red-700" /> {studio.address}
                </p>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-800">
              <img src="/logo.png" alt="MyRose" className="h-4 w-4 rounded-full object-cover" /> MyRose
            </span>
          </div>
        </div>

        <form onSubmit={handleBook} className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-base font-bold text-zinc-950">1. Escolha os procedimentos</h2>
            <div className="mt-4 space-y-4">
              {services.map((cat) => {
                const items = subservices.filter((s) => s.service_id === cat.id);
                if (items.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{cat.name}</p>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const active = selectedIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleService(item.id)}
                            className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition ${
                              active ? 'border-red-700 bg-red-50/70' : 'border-zinc-200 hover:border-red-300'
                            }`}
                          >
                            <div>
                              <p className="font-semibold text-zinc-950">{item.name}</p>
                              <p className="flex items-center gap-1 text-xs text-zinc-500">
                                <Clock className="h-3 w-3" /> {item.duration_minutes} min
                              </p>
                            </div>
                            <span className="font-bold text-red-700">
                              {formatCurrencyBRL(item.promo_price_cents ?? item.price_cents)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {chosen.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-zinc-950">
                <Calendar className="h-4 w-4 text-red-700" /> 2. Data e horário ({totalDuration} min)
              </h2>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="mt-3 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {slots.length === 0 ? (
                  <p className="text-xs text-zinc-500">Nenhum horário livre nesta data.</p>
                ) : (
                  slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-semibold ${
                        selectedSlot === slot.start
                          ? 'border-red-700 bg-red-700 text-white'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-red-300'
                      }`}
                    >
                      {slot.start}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {selectedSlot && (
            <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-bold text-zinc-950">3. Seus dados</h2>
              <input
                required
                placeholder="Seu nome completo"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
              />
              <input
                required
                placeholder="WhatsApp com DDD (ex: 11999990000)"
                value={clientWhatsapp}
                onChange={(e) => setClientWhatsapp(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
              />
              <textarea
                placeholder="Observações (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm"
              />
              {error && <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-900 py-3 text-sm font-semibold text-white hover:opacity-95"
              >
                {submitting
                  ? 'Confirmando...'
                  : `Confirmar horário (${formatCurrencyBRL(totalCents)})`}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
