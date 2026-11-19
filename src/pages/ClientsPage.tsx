import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ClipboardCheck, Copy, Download, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrencyBRL, getPlan } from '../lib/domain';
import {
  createAnamnesisLink,
  createClient,
  deleteClientsBulk,
  importClientsCsv,
  sendWhatsAppSmart,
} from '../services/repository';
import { ANAMNESIS_AREAS, ANAMNESIS_QUESTIONS } from '../types/domain';

export default function ClientsPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['lash_designer']);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openRecordClientId, setOpenRecordClientId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
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

  const handleDownloadTemplate = () => {
    const csv = '\uFEFFnome;whatsapp;data_nascimento;observacoes\nCamila Exemplo;11999998888;1996-04-15;Prefere curvatura C\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-clientes-myrose.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportClients = () => {
    const rows = [
      'nome;whatsapp;data_nascimento;gasto_reais;observacoes',
      ...workspace.clients.map(
        (c) =>
          `"${c.name.replace(/"/g, '""')}";"${c.whatsapp}";"${c.birth_date ?? ''}";"${(c.total_spent_cents / 100).toFixed(2).replace('.', ',')}";"${(c.notes ?? '').replace(/"/g, '""')}"`
      ),
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientes-myrose.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setImportNotice(null);
    try {
      const text = await file.text();
      const res = await importClientsCsv(workspace, text);
      await refreshWorkspace();
      setImportNotice(
        `Importação concluída: ${res.imported} cliente(s) adicionada(s)` +
          (res.rejected.length > 0 ? ` · ${res.rejected.length} linha(s) ignorada(s).` : '.')
      );
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Falha ao importar planilha.');
    } finally {
      e.target.value = '';
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    await deleteClientsBulk(workspace, selectedIds);
    setSelectedIds([]);
    await refreshWorkspace();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.tsv"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5" /> Modelo Excel (.csv)
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <Upload className="h-3.5 w-3.5 text-red-700" /> Importar Planilha
          </button>
          <button
            type="button"
            onClick={handleExportClients}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5" /> Exportar (.csv)
          </button>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              className="inline-flex items-center gap-1 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir selecionadas ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {importNotice && (
        <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{importNotice}</p>
      )}

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
          const record = workspace.anamnesisRecords.find((r) => r.client_id === c.id);
          const filled = Boolean(record);
          const checked = selectedIds.includes(c.id);
          const isOpen = openRecordClientId === c.id;
          return (
            <div key={c.id} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(c.id)}
                    className="h-4 w-4 accent-red-700"
                  />
                  <div>
                    <p className="font-bold text-zinc-950">{c.name}</p>
                    <p className="text-xs text-zinc-500">
                      {c.whatsapp} · Gasto acumulado: {formatCurrencyBRL(c.total_spent_cents)}
                      {c.birth_date ? ` · Nasc: ${c.birth_date.split('-').reverse().join('/')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {filled && (
                    <button
                      type="button"
                      onClick={() => setOpenRecordClientId(isOpen ? null : c.id)}
                      className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {isOpen ? 'Ocultar respostas' : 'Ver ficha preenchida'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCreateAnamnesis(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" /> Gerar ficha
                  </button>
                  {generatedLink && (
                    <button
                      type="button"
                      onClick={() =>
                        void sendWhatsAppSmart(
                          c.whatsapp,
                          `Oi ${c.name.split(' ')[0]}! Preencha sua ficha de anamnese do ${workspace.studio.business_name} antes do atendimento: ${generatedLink}`
                        )
                      }
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Enviar no WhatsApp
                    </button>
                  )}
                </div>
              </div>

              {isOpen && record && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs">
                  <p className="font-bold text-zinc-900">Respostas da Ficha de Anamnese:</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(record.answers).map(([qId, ans]) => {
                      const qLabel = ANAMNESIS_QUESTIONS.find((q) => q.id === qId)?.question ?? qId;
                      return (
                        <div key={qId} className="rounded-lg bg-white p-2 border border-zinc-200/70">
                          <p className="text-zinc-500">{qLabel}</p>
                          <p className="font-semibold text-zinc-950">{String(ans) || '—'}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
