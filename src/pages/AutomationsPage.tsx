import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, MessageSquare, QrCode, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPlan, interpolateTemplate } from '../lib/domain';
import {
  fetchLocalWhatsAppStatus,
  getLocalWhatsAppUrl,
  saveWhatsAppTemplate,
  sendWhatsAppSmart,
  setLocalWhatsAppUrl,
} from '../services/repository';

export default function AutomationsPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [selectedType, setSelectedType] = useState('agendamento');
  const [draft, setDraft] = useState('');
  const [savedFlag, setSavedFlag] = useState(false);

  const [waUrl, setWaUrl] = useState(() => getLocalWhatsAppUrl());
  const [waState, setWaState] = useState<{
    status: string;
    qrImage?: string | null;
    user?: { id?: string } | null;
    sentCount?: number;
  }>({ status: 'checking' });
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);

  const checkGateway = useCallback(async () => {
    const st = await fetchLocalWhatsAppStatus();
    setWaState(st);
  }, []);

  useEffect(() => {
    void checkGateway();
    const timer = setInterval(() => void checkGateway(), 6000);
    return () => clearInterval(timer);
  }, [checkGateway]);

  if (!workspace) return null;
  const plan = getPlan(workspace.studio.plan_id);
  const current = workspace.templates.find((t) => t.type === selectedType) ?? workspace.templates[0];
  const textValue = draft || current.message;

  const preview = interpolateTemplate(textValue, {
    cliente: 'Maria',
    profissional: workspace.studio.owner_name,
    data: '25/11',
    horario: '14:00',
    procedimento: 'Volume Brasileiro',
    procedimentos: 'Volume Brasileiro',
    endereco: workspace.studio.address || 'Rua das Rosas, 120',
    link: `${window.location.origin}/agendar/${workspace.studio.booking_slug}`,
    link_avaliacao: workspace.studio.google_review_url || 'https://g.page/r/...',
  });

  const handleSave = async () => {
    await saveWhatsAppTemplate(workspace, current.type, textValue);
    await refreshWorkspace();
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2000);
  };

  const maintenanceTpl =
    workspace.templates.find((t) => t.type === 'manutencao')?.message ??
    'Oi {cliente}! Já está na janela da sua manutenção no {profissional}. Agende seu retorno: {link}';

  const maintenanceClients = workspace.clients.filter((c) => {
    if (!c.last_visit_at) return false;
    const days = Math.floor((Date.now() - new Date(c.last_visit_at).getTime()) / 86400000);
    return days >= 15;
  });

  const handleSendMaintenance = async (clientName: string, clientWhatsapp: string) => {
    const msg = interpolateTemplate(maintenanceTpl, {
      cliente: clientName.split(' ')[0],
      profissional: workspace.studio.business_name,
      procedimento: 'Extensão de Cílios',
      link: `${window.location.origin}/agendar/${workspace.studio.booking_slug}`,
    });
    const res = await sendWhatsAppSmart(clientWhatsapp, msg);
    setDispatchNotice(
      res.mode === 'local'
        ? `Mensagem enviada automaticamente pelo Servidor Local para ${clientName}!`
        : `Servidor local desligado — conversa aberta no WhatsApp Web/App para ${clientName}.`
    );
    void checkGateway();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950">Central WhatsApp, Lembretes & B-IA</h1>
        <p className="text-sm text-zinc-500">
          Servidor local de WhatsApp (QR Code), carteira de manutenção e modelos unificados.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-950">Servidor Local WhatsApp & Assistente B-IA</h2>
              <p className="text-xs text-zinc-600">
                Status:{' '}
                {waState.status === 'connected' ? (
                  <strong className="text-emerald-700">
                    Conectado ({waState.user?.id ?? 'Ativo'}) · {waState.sentCount ?? 0} disparos na sessão
                  </strong>
                ) : waState.status === 'qr_ready' ? (
                  <strong className="text-amber-700">Aguardando leitura do QR Code abaixo</strong>
                ) : (
                  <strong className="text-zinc-700">
                    Offline (usando disparo 1-clique wa.me · rode Iniciar-WhatsApp-MyRose.cmd para automático)
                  </strong>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={waUrl}
              onChange={(e) => {
                setWaUrl(e.target.value);
                setLocalWhatsAppUrl(e.target.value);
              }}
              placeholder="http://localhost:8086"
              className="w-48 rounded-xl border border-zinc-200 px-3 py-1.5 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => void checkGateway()}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Verificar
            </button>
            <a
              href={`${waUrl}/qrcode`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
            >
              <QrCode className="h-3.5 w-3.5" /> Abrir Painel QR Code
            </a>
          </div>
        </div>

        {waState.status === 'qr_ready' && waState.qrImage && (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-red-200 bg-red-50/40 p-4">
            <img src={waState.qrImage} alt="QR Code WhatsApp" className="h-44 w-44 rounded-xl border bg-white p-2" />
            <div className="text-xs text-zinc-700">
              <p className="font-bold text-zinc-950">Escaneie para ativar os envios automáticos:</p>
              <p className="mt-1">1. Abra o WhatsApp no celular → Aparelhos Conectados → Conectar Aparelho.</p>
              <p className="mt-1">2. Aponte a câmera para este QR Code.</p>
              <p className="mt-2 text-zinc-500">
                Comandos da B-IA no WhatsApp conectado: <code className="font-mono">!ajuda</code>,{' '}
                <code className="font-mono">!painel</code>, <code className="font-mono">!agendar</code>,{' '}
                <code className="font-mono">!status</code>.
              </p>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-zinc-500">
          Cota B-IA do plano {plan.name}: <strong>{plan.biaMonthlyLimit}</strong> mensagens/mês · Comandos B-IA ativos no WhatsApp:{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">!ajuda</code>{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">!painel</code>{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">!agendar</code>{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">!status</code>
        </p>
      </div>

      {dispatchNotice && (
        <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{dispatchNotice}</p>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-bold text-zinc-950">
          Carteira de Retorno / Manutenção ({maintenanceClients.length} clientes com +15 dias)
        </h2>
        <div className="mt-3 space-y-2">
          {maintenanceClients.length === 0 ? (
            <p className="text-xs text-zinc-500">Nenhuma cliente pendente de manutenção no momento.</p>
          ) : (
            maintenanceClients.map((c) => {
              const days = c.last_visit_at
                ? Math.floor((Date.now() - new Date(c.last_visit_at).getTime()) / 86400000)
                : 0;
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-zinc-950">{c.name}</span> · {c.whatsapp} ·{' '}
                    <span className="font-semibold text-red-700">Última visita há {days} dias</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSendMaintenance(c.name, c.whatsapp)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
                  >
                    <Send className="h-3 w-3" /> Avisar retorno
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap gap-2">
            {workspace.templates.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => {
                  setSelectedType(t.type);
                  setDraft(t.message);
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  selectedType === t.type ? 'bg-red-700 text-white' : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={textValue}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-zinc-200 p-3 text-sm"
          />

          <div className="flex flex-wrap gap-1.5">
            {current.placeholders.map((ph) => (
              <button
                key={ph}
                type="button"
                onClick={() => setDraft(`${textValue} ${ph}`)}
                className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-mono text-zinc-700 hover:bg-zinc-200"
              >
                +{ph}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            {savedFlag ? <Check className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            {savedFlag ? 'Modelo salvo!' : 'Salvar modelo'}
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-emerald-50/30 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Prévia na conversa</p>
          <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-emerald-100 bg-white p-4 text-sm text-zinc-800 shadow-2xs">
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
