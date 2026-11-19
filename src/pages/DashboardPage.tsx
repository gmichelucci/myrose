import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, DollarSign, Package, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { computeFinanceSummary, formatCurrencyBRL } from '../lib/domain';

export default function DashboardPage() {
  const { workspace } = useAuth();
  if (!workspace) return null;

  const today = new Date().toISOString().slice(0, 10);
  const summary = computeFinanceSummary(workspace.appointments, workspace.expenses);
  const todayAppointments = workspace.appointments
    .filter((a) => a.appointment_date === today && a.status !== 'cancelado')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const lowStock = workspace.inventory.filter((i) => i.quantity <= i.min_quantity);
  const maintenanceDue = workspace.clients.filter((c) => {
    if (!c.last_visit_at) return false;
    const diffDays = (Date.now() - new Date(c.last_visit_at).getTime()) / 86400000;
    return diffDays >= 15;
  });

  const kpis = [
    { label: 'Faturamento realizado', value: formatCurrencyBRL(summary.revenueCents), icon: DollarSign },
    { label: 'Lucro líquido', value: formatCurrencyBRL(summary.netProfitCents), icon: TrendingUp },
    { label: 'Atendimentos concluídos', value: String(summary.completedCount), icon: Calendar },
    { label: 'Ticket médio', value: formatCurrencyBRL(summary.averageTicketCents), icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950">Visão Geral</h1>
          <p className="text-sm text-zinc-500">Resumo operacional do seu estúdio no MyRose.</p>
        </div>
        <Link
          to="/agenda"
          className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          Abrir agenda
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-xs font-medium">{k.label}</span>
                <Icon className="h-4 w-4 text-red-700" />
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-950">{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="font-bold text-zinc-950">Agenda de hoje ({today.split('-').reverse().join('/')})</h2>
          {todayAppointments.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Nenhum atendimento marcado para hoje.</p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {todayAppointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-950">{a.start_time} · {a.client_name}</p>
                    <p className="text-xs text-zinc-500">{a.items?.map((i) => i.subservice_name).join(', ') || 'Procedimento'}</p>
                  </div>
                  <span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-800">
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-bold text-zinc-950">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Retornos de manutenção (15+ dias)
            </h2>
            {maintenanceDue.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Nenhuma cliente aguardando retorno.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {maintenanceDue.map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <span>{c.name}</span>
                    <Link to="/automacoes" className="text-xs font-semibold text-red-700 hover:underline">
                      Enviar lembrete
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-bold text-zinc-950">
              <Package className="h-4 w-4 text-red-700" /> Estoque abaixo do mínimo
            </h2>
            {lowStock.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Todos os insumos em dia.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm text-amber-700">
                {lowStock.map((item) => (
                  <li key={item.id}>
                    {item.name}: <strong>{item.quantity}</strong> {item.unit} (mín. {item.min_quantity})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
