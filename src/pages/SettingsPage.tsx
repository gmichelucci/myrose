import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Copy, CreditCard, ExternalLink, Gift, Plus, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrencyBRL, getPlan } from '../lib/domain';
import {
  addCollaborator,
  openStripeBillingPortal,
  saveWorkingHours,
  startStripeCheckout,
  syncStripeCheckoutSession,
  updateStudioSettings,
} from '../services/repository';
import { COLLABORATOR_PERMISSIONS, PLANS, type PlanId, type WorkingHour } from '../types/domain';

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function SettingsPage() {
  const { workspace, refreshWorkspace, isDemoMode } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>(
    searchParams.get('interval') === 'year' ? 'year' : 'month'
  );
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [billingErr, setBillingErr] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState(workspace?.studio.business_name ?? '');
  const [slug, setSlug] = useState(workspace?.studio.booking_slug ?? '');
  const [pixKey, setPixKey] = useState(workspace?.studio.pix_key ?? '');
  const [depositPct, setDepositPct] = useState(String(workspace?.studio.deposit_percent ?? 0));
  const [address, setAddress] = useState(workspace?.studio.address ?? '');

  const [hours, setHours] = useState<WorkingHour[]>(() =>
    [0, 1, 2, 3, 4, 5, 6].map(
      (d) =>
        workspace?.workingHours.find((h) => h.day_of_week === d) ?? {
          day_of_week: d,
          active: d >= 1 && d <= 6,
          start_time: '09:00',
          end_time: d === 6 ? '16:00' : '18:00',
          break_start: '12:00',
          break_end: '13:00',
        }
    )
  );
  const [hoursSaved, setHoursSaved] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  const [colabName, setColabName] = useState('');
  const [colabEmail, setColabEmail] = useState('');
  const [colabCommission, setColabCommission] = useState('40');
  const [perms, setPerms] = useState<Record<string, boolean>>({ clientes_ver: true, mappings_editar: true });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const checkoutState = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    if (checkoutState === 'success' && sessionId && !isDemoMode) {
      setBillingBusy('sync');
      syncStripeCheckoutSession(sessionId)
        .then(async (res) => {
          await refreshWorkspace();
          setBillingNotice(
            res.synced
              ? 'Assinatura confirmada! Seu novo plano já está ativo.'
              : 'Pagamento recebido — atualizando assinatura...'
          );
          setSearchParams({}, { replace: true });
        })
        .catch((ex) => setBillingErr(ex instanceof Error ? ex.message : 'Erro ao validar checkout'))
        .finally(() => setBillingBusy(null));
    } else if (checkoutState === 'canceled') {
      setBillingNotice('Checkout cancelado. Nenhuma cobrança foi realizada.');
      setSearchParams({}, { replace: true });
    }
  }, [isDemoMode, refreshWorkspace, searchParams, setSearchParams]);

  if (!workspace) return null;
  const plan = getPlan(workspace.studio.plan_id);
  const highlightUpgrade = searchParams.get('upgrade');
  const referralUrl = `${window.location.origin}/cadastro?ref=${workspace.studio.booking_slug}`;

  const saveStudio = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    await updateStudioSettings(workspace, {
      business_name: businessName,
      booking_slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      pix_key: pixKey,
      deposit_percent: Number(depositPct) || 0,
      address,
    });
    await refreshWorkspace();
    setMsg('Configurações salvas!');
  };

  const handleSaveHours = async () => {
    await saveWorkingHours(workspace, hours);
    await refreshWorkspace();
    setHoursSaved(true);
    setTimeout(() => setHoursSaved(false), 2000);
  };

  const handleAddColab = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await addCollaborator(workspace, {
        name: colabName,
        role_title: 'Lash Designer',
        email: colabEmail,
        commission_percent: Number(colabCommission) || 0,
        separate_agenda: true,
        permissions: perms,
      });
      setColabName('');
      setColabEmail('');
      await refreshWorkspace();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Erro ao adicionar colaboradora');
    }
  };

  const switchDemoPlan = async (planId: PlanId) => {
    if (!isDemoMode) return;
    await updateStudioSettings(workspace, { plan_id: planId });
    await refreshWorkspace();
  };

  const handleStripeCheckout = async (planId: Exclude<PlanId, 'gratuito'>) => {
    setBillingErr(null);
    setBillingNotice(null);
    setBillingBusy(planId);
    try {
      const url = await startStripeCheckout(planId, billingInterval);
      window.location.assign(url);
    } catch (ex) {
      setBillingErr(ex instanceof Error ? ex.message : 'Erro ao iniciar checkout Stripe');
      setBillingBusy(null);
    }
  };

  const handlePortal = async () => {
    setBillingErr(null);
    setBillingBusy('portal');
    try {
      const url = await openStripeBillingPortal();
      window.location.assign(url);
    } catch (ex) {
      setBillingErr(ex instanceof Error ? ex.message : 'Erro ao abrir portal de assinatura');
      setBillingBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-950">Equipe, Expediente, Plano & Indicações</h1>

      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-red-700">Plano atual</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-zinc-950">
                {plan.name} · {formatCurrencyBRL(plan.monthlyPriceCents)}/mês
              </h2>
              {workspace.studio.subscription_status && workspace.studio.subscription_status !== 'free' && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Stripe: {workspace.studio.subscription_status}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workspace.studio.stripe_customer_id && !isDemoMode && (
              <button
                type="button"
                disabled={billingBusy !== null}
                onClick={() => void handlePortal()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {billingBusy === 'portal' ? 'Abrindo...' : 'Gerenciar assinatura (Stripe)'}
              </button>
            )}
            <div className="inline-flex rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBillingInterval('month')}
                className={`rounded-lg px-3 py-1.5 ${billingInterval === 'month' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600'}`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval('year')}
                className={`rounded-lg px-3 py-1.5 ${billingInterval === 'year' ? 'bg-red-700 text-white shadow-2xs' : 'text-zinc-600'}`}
              >
                Anual (até 25% off)
              </button>
            </div>
          </div>
        </div>

        {billingNotice && (
          <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{billingNotice}</p>
        )}
        {billingErr && (
          <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{billingErr}</p>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          {PLANS.filter((p): p is typeof p & { id: Exclude<PlanId, 'gratuito'> } => p.id !== 'gratuito').map((p) => {
            const isCurrent = workspace.studio.plan_id === p.id;
            const isTarget = highlightUpgrade === p.id;
            const monthlyShown = billingInterval === 'year' ? Math.round(p.annualPriceCents / 12) : p.monthlyPriceCents;
            return (
              <div
                key={p.id}
                className={`flex flex-col justify-between rounded-xl border p-4 ${
                  isTarget ? 'border-red-700 bg-red-50/40' : 'border-zinc-200 bg-zinc-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-950">{p.name}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-lg font-extrabold text-zinc-950">
                    {formatCurrencyBRL(monthlyShown)}
                    <span className="text-xs font-normal text-zinc-500">/mês</span>
                  </p>
                  {billingInterval === 'year' && (
                    <p className="text-[11px] text-red-700">Total anual: {formatCurrencyBRL(p.annualPriceCents)}</p>
                  )}
                  <p className="mt-1.5 text-xs text-zinc-600">{p.tagline}</p>
                </div>

                {isDemoMode ? (
                  <button
                    type="button"
                    onClick={() => void switchDemoPlan(p.id)}
                    className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                      isCurrent ? 'bg-red-700 text-white' : 'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100'
                    }`}
                  >
                    {isCurrent ? 'Ativo no preview' : `Simular ${p.name}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isCurrent || billingBusy !== null}
                    onClick={() => void handleStripeCheckout(p.id)}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:bg-zinc-300 disabled:text-zinc-600"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {isCurrent
                      ? 'Plano atual'
                      : billingBusy === p.id
                        ? 'Abrindo Stripe...'
                        : `Assinar ${p.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={saveStudio} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-2">
        <h2 className="text-base font-bold text-zinc-950 md:col-span-2">Dados do Estúdio & Sinal Pix</h2>
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Nome do estúdio" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Código do link (/agendar/codigo)" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
        <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Chave Pix para sinal" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
        <input type="number" min={0} max={100} value={depositPct} onChange={(e) => setDepositPct(e.target.value)} placeholder="% Sinal" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço completo" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm md:col-span-2" />
        {msg && <p className="text-xs font-medium text-emerald-700 md:col-span-2">{msg}</p>}
        <button type="submit" className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 md:w-fit">
          Salvar configurações
        </button>
      </form>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-950">
            <Clock className="h-4 w-4 text-red-700" /> Expediente & Intervalo de Almoço
          </h2>
          <button
            type="button"
            onClick={() => void handleSaveHours()}
            className="rounded-xl bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
          >
            {hoursSaved ? 'Expediente salvo!' : 'Salvar expediente'}
          </button>
        </div>
        <div className="space-y-2">
          {hours.map((h, idx) => (
            <div
              key={h.day_of_week}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs"
            >
              <label className="flex w-28 items-center gap-2 font-semibold text-zinc-800">
                <input
                  type="checkbox"
                  checked={h.active}
                  onChange={(e) =>
                    setHours((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, active: e.target.checked } : row))
                    )
                  }
                  className="accent-red-700"
                />
                {DAY_NAMES[h.day_of_week]}
              </label>
              {h.active ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>Início:</span>
                  <input
                    type="time"
                    value={h.start_time.slice(0, 5)}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, start_time: e.target.value } : row))
                      )
                    }
                    className="rounded-lg border border-zinc-200 px-2 py-1"
                  />
                  <span>Fim:</span>
                  <input
                    type="time"
                    value={h.end_time.slice(0, 5)}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, end_time: e.target.value } : row))
                      )
                    }
                    className="rounded-lg border border-zinc-200 px-2 py-1"
                  />
                  <span className="text-zinc-500">Almoço:</span>
                  <input
                    type="time"
                    value={(h.break_start ?? '12:00').slice(0, 5)}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, break_start: e.target.value } : row))
                      )
                    }
                    className="rounded-lg border border-zinc-200 px-2 py-1"
                  />
                  <span>às</span>
                  <input
                    type="time"
                    value={(h.break_end ?? '13:00').slice(0, 5)}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, break_end: e.target.value } : row))
                      )
                    }
                    className="rounded-lg border border-zinc-200 px-2 py-1"
                  />
                </div>
              ) : (
                <span className="text-zinc-400">Fechado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-950">
            <Shield className="h-4 w-4 text-red-700" /> Equipe ({workspace.collaborators.length}/{plan.teamLimit})
          </h2>
        </div>

        <form onSubmit={handleAddColab} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input required placeholder="Nome" value={colabName} onChange={(e) => setColabName(e.target.value)} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            <input required type="email" placeholder="E-mail de acesso" value={colabEmail} onChange={(e) => setColabEmail(e.target.value)} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
            <input type="number" placeholder="Comissão %" value={colabCommission} onChange={(e) => setColabCommission(e.target.value)} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            {COLLABORATOR_PERMISSIONS.map((perm) => (
              <label key={perm.key} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={!!perms[perm.key]}
                  onChange={(e) => setPerms((p) => ({ ...p, [perm.key]: e.target.checked }))}
                />
                {perm.label}
              </label>
            ))}
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            <Plus className="h-4 w-4" /> Adicionar colaboradora
          </button>
        </form>

        {workspace.collaborators.length > 0 && (
          <div className="space-y-2 border-t border-zinc-200 pt-3">
            <p className="text-xs font-bold uppercase text-zinc-500">Desempenho & Comissões da Equipe</p>
            {workspace.collaborators.map((col) => {
              const realized = workspace.appointments.filter(
                (a) => a.collaborator_id === col.id && a.status === 'realizado'
              );
              const totalGenerated = realized.reduce((acc, a) => acc + a.total_cents, 0);
              const commissionCents = Math.round((totalGenerated * col.commission_percent) / 100);
              return (
                <div
                  key={col.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-bold text-zinc-950">{col.name}</span> · {col.email} · Comissão:{' '}
                    <strong>{col.commission_percent}%</strong>
                  </div>
                  <div className="text-zinc-700">
                    Atendimentos: <strong>{realized.length}</strong> · Produzido:{' '}
                    <strong>{formatCurrencyBRL(totalGenerated)}</strong> · Comissão a pagar:{' '}
                    <strong className="text-red-700">{formatCurrencyBRL(commissionCents)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50/60 to-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-950">
              <Gift className="h-4 w-4 text-red-700" /> Indique e Ganhe — Programa de Afiliadas MyRose
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Compartilhe seu link exclusivo com outras profissionais de estética e acumule bônus na assinatura.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-800">
              {referralUrl}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(referralUrl);
                setCopiedRef(true);
                setTimeout(() => setCopiedRef(false), 2000);
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
            >
              <Copy className="h-3.5 w-3.5" /> {copiedRef ? 'Copiado!' : 'Copiar link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
