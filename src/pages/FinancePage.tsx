import { useState, type FormEvent } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Download, FileText, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { computeFinanceSummary, formatCurrencyBRL } from '../lib/domain';
import { createExpense, createInventoryItem, registerInventoryMovement } from '../services/repository';
import { EXPENSE_CATEGORIES, INVENTORY_CATEGORIES, INVENTORY_UNITS, type InventoryItem } from '../types/domain';

export default function FinancePage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [tab, setTab] = useState<'financeiro' | 'estoque'>('financeiro');

  const [expDesc, setExpDesc] = useState('');
  const [expCat, setExpCat] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expReais, setExpReais] = useState('');
  const [expFreq, setExpFreq] = useState<string>('');

  const [itemName, setItemName] = useState('');
  const [itemCat, setItemCat] = useState<string>(INVENTORY_CATEGORIES[0]);
  const [itemUnit, setItemUnit] = useState<string>(INVENTORY_UNITS[0]);
  const [itemMin, setItemMin] = useState('2');

  if (!workspace) return null;
  const summary = computeFinanceSummary(workspace.appointments, workspace.expenses);

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(expReais.replace(',', '.')) * 100);
    if (!amountCents || amountCents <= 0) return;
    await createExpense(workspace, {
      category: expCat,
      description: expDesc,
      amount_cents: amountCents,
      expense_date: new Date().toISOString().slice(0, 10),
      is_recurring: Boolean(expFreq),
      recurring_frequency: (expFreq || undefined) as 'semanal' | 'mensal' | 'trimestral' | 'anual' | undefined,
    });
    setExpDesc('');
    setExpReais('');
    setExpFreq('');
    await refreshWorkspace();
  };

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    await createInventoryItem(workspace, {
      name: itemName,
      category: itemCat,
      unit: itemUnit,
      quantity: 0,
      min_quantity: Number(itemMin) || 0,
      unit_cost_cents: null,
      expires_at: null,
    });
    setItemName('');
    await refreshWorkspace();
  };

  const handleMove = async (item: InventoryItem, type: 'entrada' | 'saida') => {
    const costCents = type === 'entrada' ? item.unit_cost_cents ?? 4500 : null;
    await registerInventoryMovement(workspace, item, type, 1, costCents, type === 'entrada');
    await refreshWorkspace();
  };

  const handleExportCsv = () => {
    const realized = workspace.appointments.filter((a) => a.status === 'realizado');
    const lines = [
      'tipo;data;categoria_ou_cliente;descricao;valor_reais',
      ...realized.map(
        (a) =>
          `RECEITA;${a.appointment_date};"${a.client_name}";"${(a.items?.map((i) => i.subservice_name).join(', ') || 'Atendimento').replace(/"/g, '""')}";${(a.total_cents / 100).toFixed(2).replace('.', ',')}`
      ),
      ...workspace.expenses.map(
        (ex) =>
          `DESPESA;${ex.expense_date};"${ex.category}";"${ex.description.replace(/"/g, '""')}";-${(ex.amount_cents / 100).toFixed(2).replace('.', ',')}`
      ),
      `RESUMO;${new Date().toISOString().slice(0, 10)};"Saldo Líquido";"Receita - Despesas";${(summary.netProfitCents / 100).toFixed(2).replace('.', ',')}`,
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${workspace.studio.booking_slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const win = window.open('', '_blank', 'width=840,height=700');
    if (!win) return;
    const esc = (s: string) =>
      s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
    const realized = workspace.appointments.filter((a) => a.status === 'realizado');
    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Financeiro — ${esc(workspace.studio.business_name)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #09090b; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    p.sub { color: #71717a; font-size: 13px; margin-bottom: 20px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { border: 1px solid #e4e4e7; border-radius: 12px; padding: 14px; }
    .kpi span { font-size: 12px; color: #71717a; }
    .kpi strong { display: block; font-size: 18px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 24px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e4e4e7; padding: 8px; text-align: left; }
    th { background: #fafafa; font-weight: 600; }
  </style>
</head>
<body>
  <h1>${esc(workspace.studio.business_name)} — Relatório Financeiro MyRose</h1>
  <p class="sub">Emitido em ${new Date().toLocaleDateString('pt-BR')}</p>
  <div class="kpis">
    <div class="kpi"><span>Receita Realizada</span><strong style="color:#059669">${formatCurrencyBRL(summary.revenueCents)}</strong></div>
    <div class="kpi"><span>Despesas Lançadas</span><strong style="color:#b91c1c">${formatCurrencyBRL(summary.expenseCents)}</strong></div>
    <div class="kpi"><span>Saldo Líquido</span><strong>${formatCurrencyBRL(summary.netProfitCents)}</strong></div>
  </div>
  <h3>Atendimentos Realizados (${realized.length})</h3>
  <table>
    <thead><tr><th>Data</th><th>Cliente</th><th>Procedimento</th><th>Valor</th></tr></thead>
    <tbody>
      ${realized.map((a) => `<tr><td>${esc(a.appointment_date.split('-').reverse().join('/'))}</td><td>${esc(a.client_name)}</td><td>${esc(a.items?.map((i) => i.subservice_name).join(', ') || 'Atendimento')}</td><td>${formatCurrencyBRL(a.total_cents)}</td></tr>`).join('')}
    </tbody>
  </table>
  <h3>Despesas (${workspace.expenses.length})</h3>
  <table>
    <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead>
    <tbody>
      ${workspace.expenses.map((ex) => `<tr><td>${esc(ex.expense_date.split('-').reverse().join('/'))}</td><td>${esc(ex.category)}</td><td>${esc(ex.description)}</td><td>-${formatCurrencyBRL(ex.amount_cents)}</td></tr>`).join('')}
    </tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-950">Financeiro & Estoque</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5 text-red-700" /> Exportar Excel (.csv)
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <FileText className="h-3.5 w-3.5 text-red-700" /> Exportar PDF
          </button>
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-xs font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setTab('financeiro')}
              className={`rounded-lg px-4 py-1.5 ${tab === 'financeiro' ? 'bg-red-700 text-white' : 'text-zinc-600'}`}
            >
              Faturamento & Despesas
            </button>
            <button
              type="button"
              onClick={() => setTab('estoque')}
              className={`rounded-lg px-4 py-1.5 ${tab === 'estoque' ? 'bg-red-700 text-white' : 'text-zinc-600'}`}
            >
              Estoque integrado
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <span className="text-xs text-zinc-500">Receita realizada</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrencyBRL(summary.revenueCents)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <span className="text-xs text-zinc-500">Despesas lançadas</span>
          <p className="mt-1 text-2xl font-bold text-red-700">{formatCurrencyBRL(summary.expenseCents)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <span className="text-xs text-zinc-500">Saldo líquido</span>
          <p className="mt-1 text-2xl font-bold text-zinc-950">{formatCurrencyBRL(summary.netProfitCents)}</p>
        </div>
      </div>

      {tab === 'financeiro' ? (
        <div className="space-y-5">
          <form onSubmit={handleAddExpense} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-5">
            <select value={expCat} onChange={(e) => setExpCat(e.target.value)} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              required
              placeholder="Descrição (ex: Aluguel, Cola, Tráfego)"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Valor R$ (ex: 85,50)"
              value={expReais}
              onChange={(e) => setExpReais(e.target.value)}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <select value={expFreq} onChange={(e) => setExpFreq(e.target.value)} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              <option value="">Despesa única</option>
              <option value="semanal">Recorrente: Semanal</option>
              <option value="mensal">Recorrente: Mensal</option>
              <option value="trimestral">Recorrente: Trimestral</option>
              <option value="anual">Recorrente: Anual</option>
            </select>
            <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
              <Plus className="h-4 w-4" /> Lançar despesa
            </button>
          </form>

          <div className="space-y-2">
            {workspace.expenses.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-zinc-950">{ex.description}</p>
                  <p className="text-xs text-zinc-500">
                    {ex.category} · {ex.expense_date.split('-').reverse().join('/')}
                    {ex.is_recurring && ex.recurring_frequency ? ` · Recorrente (${ex.recurring_frequency})` : ''}
                  </p>
                </div>
                <span className="font-bold text-red-700">-{formatCurrencyBRL(ex.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <form onSubmit={handleAddItem} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Nome do produto / insumo</label>
              <input
                required
                placeholder="Ex: Caixa Fios Volume Russo 0.07"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Categoria</label>
              <select value={itemCat} onChange={(e) => setItemCat(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">Unidade</label>
                <select value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-2 py-2 text-sm">
                  {INVENTORY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">Alerta mín.</label>
                <input
                  type="number"
                  min={0}
                  value={itemMin}
                  onChange={(e) => setItemMin(e.target.value)}
                  placeholder="Ex: 2"
                  className="w-full rounded-xl border border-zinc-200 px-2 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                Cadastrar item
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            {workspace.inventory.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
                <div>
                  <p className="font-bold text-zinc-950">{item.name}</p>
                  <p className="text-xs text-zinc-500">
                    {item.category} · Em estoque: <strong>{item.quantity} {item.unit}</strong> (mín. {item.min_quantity})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleMove(item, 'entrada')}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5" /> +1 Compra (lança despesa)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMove(item, 'saida')}
                    className="inline-flex items-center gap-1 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700"
                  >
                    <ArrowDownCircle className="h-3.5 w-3.5" /> -1 Baixa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
