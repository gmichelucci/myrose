import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrencyBRL } from '../lib/domain';
import { createServiceCategory, createSubservice } from '../services/repository';

export default function CatalogPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [catName, setCatName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [procName, setProcName] = useState('');
  const [priceReais, setPriceReais] = useState('150');
  const [duration, setDuration] = useState('90');
  const [maintDays, setMaintDays] = useState('20');

  if (!workspace) return null;

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await createServiceCategory(workspace, catName);
    setCatName('');
    await refreshWorkspace();
  };

  const addProcedure = async (e: FormEvent) => {
    e.preventDefault();
    const targetCat = serviceId || workspace.services[0]?.id;
    if (!targetCat || !procName.trim()) return;
    await createSubservice(workspace, {
      service_id: targetCat,
      name: procName,
      price_cents: Math.round(parseFloat(priceReais.replace(',', '.')) * 100) || 0,
      duration_minutes: parseInt(duration, 10) || 60,
      maintenance_days: maintDays ? parseInt(maintDays, 10) : null,
    });
    setProcName('');
    await refreshWorkspace();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-950">Catálogo de Serviços</h1>

      <form onSubmit={addCategory} className="flex flex-wrap gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <input
          placeholder="Nova área (ex: Extensão de Cílios, Sobrancelhas)"
          value={catName}
          onChange={(e) => setCatName(e.target.value)}
          className="min-w-60 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
          <Plus className="h-4 w-4" /> Nova área
        </button>
      </form>

      <form onSubmit={addProcedure} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-6">
        <select
          value={serviceId || workspace.services[0]?.id || ''}
          onChange={(e) => setServiceId(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        >
          {workspace.services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          required
          placeholder="Procedimento (ex: Volume Egípcio)"
          value={procName}
          onChange={(e) => setProcName(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm md:col-span-2"
        />
        <input
          placeholder="Valor (R$)"
          value={priceReais}
          onChange={(e) => setPriceReais(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Minutos"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
          Adicionar
        </button>
        <input
          type="number"
          placeholder="Prazo manutenção (dias, ex: 20)"
          value={maintDays}
          onChange={(e) => setMaintDays(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm md:col-span-2"
        />
      </form>

      <div className="space-y-4">
        {workspace.services.map((cat) => (
          <div key={cat.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="font-bold text-zinc-950">{cat.name}</h2>
            <div className="mt-3 grid gap-2.5 md:grid-cols-2">
              {workspace.subservices
                .filter((sub) => sub.service_id === cat.id)
                .map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-zinc-950">{sub.name}</p>
                      <p className="text-xs text-zinc-500">
                        {sub.duration_minutes} min{sub.maintenance_days ? ` · Manutenção ${sub.maintenance_days}d` : ''}
                      </p>
                    </div>
                    <span className="font-bold text-red-700">{formatCurrencyBRL(sub.price_cents)}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
