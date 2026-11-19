import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrencyBRL } from '../lib/domain';
import {
  createServiceCategory,
  createSubservice,
  deleteSubservice,
  updateSubservice,
} from '../services/repository';
import type { Subservice } from '../types/domain';

export default function CatalogPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [catName, setCatName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [procName, setProcName] = useState('');
  const [procDetails, setProcDetails] = useState('');
  const [priceReais, setPriceReais] = useState('');
  const [promoReais, setPromoReais] = useState('');
  const [duration, setDuration] = useState('90');
  const [maintDays, setMaintDays] = useState('20');
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!workspace) return null;

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await createServiceCategory(workspace, catName);
    setCatName('');
    await refreshWorkspace();
  };

  const resetForm = () => {
    setEditingId(null);
    setProcName('');
    setProcDetails('');
    setPriceReais('');
    setPromoReais('');
    setDuration('90');
    setMaintDays('20');
  };

  const startEdit = (sub: Subservice) => {
    setEditingId(sub.id);
    setServiceId(sub.service_id);
    setProcName(sub.name);
    setProcDetails(sub.details ?? '');
    setPriceReais((sub.price_cents / 100).toFixed(2).replace('.', ','));
    setPromoReais(
      sub.promo_price_cents ? (sub.promo_price_cents / 100).toFixed(2).replace('.', ',') : ''
    );
    setDuration(String(sub.duration_minutes));
    setMaintDays(sub.maintenance_days ? String(sub.maintenance_days) : '');
  };

  const saveProcedure = async (e: FormEvent) => {
    e.preventDefault();
    const targetCat = serviceId || workspace.services[0]?.id;
    if (!targetCat || !procName.trim()) return;
    const priceCents = Math.round(parseFloat(priceReais.replace(',', '.')) * 100) || 0;
    const promoCents = promoReais.trim()
      ? Math.round(parseFloat(promoReais.replace(',', '.')) * 100) || null
      : null;
    const durationMin = parseInt(duration, 10) || 60;
    const maintenanceDays = maintDays.trim() ? parseInt(maintDays, 10) : null;

    if (editingId) {
      await updateSubservice(workspace, editingId, {
        name: procName,
        details: procDetails.trim() || null,
        price_cents: priceCents,
        promo_price_cents: promoCents,
        duration_minutes: durationMin,
        maintenance_days: maintenanceDays,
      });
    } else {
      await createSubservice(workspace, {
        service_id: targetCat,
        name: procName,
        details: procDetails.trim() || null,
        price_cents: priceCents,
        promo_price_cents: promoCents,
        duration_minutes: durationMin,
        maintenance_days: maintenanceDays,
      });
    }

    resetForm();
    await refreshWorkspace();
  };

  const handleRemoveSubservice = async (id: string) => {
    await deleteSubservice(workspace, id);
    if (editingId === id) resetForm();
    await refreshWorkspace();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950">Catálogo de Serviços</h1>
        <p className="text-sm text-zinc-500">
          Cadastre primeiro as áreas (ex.: Cílios, Sobrancelhas) e depois os procedimentos com valor, tempo e prazo de retorno.
        </p>
      </div>

      <form onSubmit={addCategory} className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-zinc-700">
          1. Criar Área / Categoria de Atendimento
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Ex: Extensão de Cílios, Design de Sobrancelhas, Lash Lifting..."
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            className="min-w-60 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" /> Adicionar área
          </button>
        </div>
      </form>

      <form onSubmit={saveProcedure} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-800">
            {editingId ? 'Editando Procedimento' : '2. Cadastrar Novo Procedimento'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
            >
              <X className="h-3.5 w-3.5" /> Cancelar edição
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">Área / Categoria</label>
            <select
              value={serviceId || workspace.services[0]?.id || ''}
              onChange={(e) => setServiceId(e.target.value)}
              disabled={Boolean(editingId)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100"
            >
              {workspace.services.length === 0 && <option value="">Crie uma área acima primeiro...</option>}
              {workspace.services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-zinc-700">Nome do procedimento</label>
            <input
              required
              placeholder="Ex: Volume Brasileiro, Manutenção até 20 dias, Brow Lamination..."
              value={procName}
              onChange={(e) => setProcName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              Descrição / Detalhes exibidos para a cliente (opcional)
            </label>
            <input
              placeholder="Ex: Aplicação completa com higienização e mapeamento personalizado para o formato do olho"
              value={procDetails}
              onChange={(e) => setProcDetails(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">Valor normal (R$)</label>
            <input
              required
              placeholder="Ex: 150,00"
              value={priceReais}
              onChange={(e) => setPriceReais(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <span className="mt-0.5 block text-[11px] text-zinc-500">Preço padrão do serviço.</span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              Valor promocional (R$ · opcional)
            </label>
            <input
              placeholder="Ex: 135,00 (deixe vazio se não houver)"
              value={promoReais}
              onChange={(e) => setPromoReais(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              Se preenchido, aparece com desconto no link da cliente.
            </span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              Tempo de duração (em minutos)
            </label>
            <input
              required
              type="number"
              min={10}
              step={5}
              placeholder="Ex: 90"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              Reserva esse tempo na sua agenda (ex: 90 = 1h30).
            </span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              Prazo para manutenção / retorno (em dias)
            </label>
            <input
              type="number"
              min={0}
              placeholder="Ex: 20"
              value={maintDays}
              onChange={(e) => setMaintDays(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              Após esses dias, a cliente entra na lista de lembrete de retorno.
            </span>
          </div>

          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 md:w-auto"
            >
              {editingId ? 'Salvar alterações do procedimento' : 'Salvar procedimento no catálogo'}
            </button>
          </div>
        </div>
      </form>

      <div className="space-y-4">
        {workspace.services.map((cat) => (
          <div key={cat.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="font-bold text-zinc-950">{cat.name}</h2>
            <div className="mt-3 grid gap-2.5 md:grid-cols-2">
              {workspace.subservices
                .filter((sub) => sub.service_id === cat.id)
                .map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-zinc-950">{sub.name}</p>
                      {sub.details && <p className="text-xs text-zinc-600">{sub.details}</p>}
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Duração: <strong>{sub.duration_minutes} min</strong>
                        {sub.maintenance_days ? ` · Retorno de manutenção: ${sub.maintenance_days} dias` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="mr-1 text-right">
                        {sub.promo_price_cents ? (
                          <>
                            <span className="mr-1.5 text-xs text-zinc-400 line-through">
                              {formatCurrencyBRL(sub.price_cents)}
                            </span>
                            <span className="font-bold text-red-700">{formatCurrencyBRL(sub.promo_price_cents)}</span>
                          </>
                        ) : (
                          <span className="font-bold text-red-700">{formatCurrencyBRL(sub.price_cents)}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(sub)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                        title="Editar procedimento"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemoveSubservice(sub.id)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-700"
                        title="Remover procedimento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
