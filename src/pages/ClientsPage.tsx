import { useState, type FormEvent } from 'react';
import { ClipboardCheck, Copy, Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrencyBRL, getPlan } from '../lib/domain';
import { createAnamnesisLink, createClient } from '../services/repository';
import { ANAMNESIS_AREAS } from '../types/domain';

export default function ClientsPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['lash_designer']);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!workspace) return null;
  const plan = getPlan(workspace.studio.plan_id);
  const filtered = workspace.clients.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.whatsapp.includes(query.replace(/\D/g, ''))
  );

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await createClient(workspace, { name, whatsapp, birth_date: birthDate || null });
      setName('');
      setWhatsapp('');
      setBirthDate('');
      await refreshWorkspace();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro ao cadastrar');
    }
  };

  const handleCreateAnamnesis = async (clientId: string) => {
    const link = await createAnamnesisLink(workspace, clientId, selectedAreas);
    const full = `${window.location.origin}/ficha/${link.token}`;
    setGeneratedLink(full);
    await refreshWorkspace();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950">Clientes & Anamnese</h1>
          <p className="text-xs text-zinc-500">
            Uso do plano {plan.name}: <strong>{workspace.clients.length}</strong> /{' '}
            {plan.clientLimit === null ? 'Ilimitado' : plan.clientLimit} clientes
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-4">
        <input
          required
          placeholder="Nome da cliente"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="WhatsApp (DDD + número)"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          <Plus className="h-4 w-4" /> Adicionar cliente
        </button>
        {err && <p className="text-xs text-red-600 md:col-span-4">{err}</p>}
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-xs font-semibold text-zinc-600">Áreas incluídas ao gerar link de Anamnese:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ANAMNESIS_AREAS.map((area) => {
            const on = selectedAreas.includes(area.id);
            return (
              <button
                key={area.id}
                type="button"
                onClick={() =>
                  setSelectedAreas((p) => (on ? p.filter((x) => x !== area.id) : [...p, area.id]))
                }
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  on ? 'bg-red-700 text-white' : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {area.label}
              </button>
            );
          })}
        </div>
        {generatedLink && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            <span className="truncate font-mono">{generatedLink}</span>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(generatedLink)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold"
            >
              <Copy className="h-3 w-3" /> Copiar
            </button>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <input
          placeholder="Buscar por nome ou WhatsApp..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm"
        />
      </div>

      <div className="space-y-2.5">
        {filtered.map((c) => {
          const filled = workspace.anamnesisRecords.some((r) => r.client_id === c.id);
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
              <div>
                <p className="font-bold text-zinc-950">{c.name}</p>
                <p className="text-xs text-zinc-500">
                  {c.whatsapp} · Gasto acumulado: {formatCurrencyBRL(c.total_spent_cents)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {filled && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Ficha preenchida
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleCreateAnamnesis(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" /> Gerar ficha
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
