import { useState, type FormEvent } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react';
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
      is_recurring: false,
    });
    setExpDesc('');
    setExpReais('');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-950">Financeiro & Estoque</h1>
        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-xs font-semibold shadow-2xs">
          <button
            type="button"
            onClick={() => setTab('financeiro')}
            className={`rounded-lg px-4 py-2 ${tab === 'financeiro' ? 'bg-red-700 text-white' : 'text-zinc-600'}`}
          >
            Faturamento & Despesas
          </button>
          <button
            type="button"
            onClick={() => setTab('estoque')}
            className={`rounded-lg px-4 py-2 ${tab === 'estoque' ? 'bg-red-700 text-white' : 'text-zinc-600'}`}
          >
            Estoque integrado
          </button>
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
          <form onSubmit={handleAddExpense} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-4">
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
            <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
              <Plus className="h-4 w-4" /> Lançar despesa
            </button>
          </form>

          <div className="space-y-2">
            {workspace.expenses.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-zinc-950">{ex.description}</p>
                  <p className="text-xs text-zinc-500">{ex.category} · {ex.expense_date.split('-').reverse().join('/')}</p>
                </div>
                <span className="font-bold text-red-700">-{formatCurrencyBRL(ex.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <form onSubmit={handleAddItem} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-5">
            <input
              required
              placeholder="Produto (ex: Fios Volume Russo)"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm md:col-span-2"
            />
            <select value={itemCat} onChange={(e) => setItemCat(e.target.value)} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} className="rounded-xl border border-zinc-200 px-2 py-2 text-sm">
                {INVENTORY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <input
                type="number"
                value={itemMin}
                onChange={(e) => setItemMin(e.target.value)}
                placeholder="Mín."
                className="w-20 rounded-xl border border-zinc-200 px-2 py-2 text-sm"
              />
            </div>
            <button type="submit" className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
              Cadastrar item
            </button>
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
