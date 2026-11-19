import { useState } from 'react';
import { Bot, Check, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPlan, interpolateTemplate } from '../lib/domain';
import { saveWhatsAppTemplate } from '../services/repository';

export default function AutomationsPage() {
  const { workspace, refreshWorkspace } = useAuth();
  const [selectedType, setSelectedType] = useState('agendamento');
  const [draft, setDraft] = useState('');
  const [savedFlag, setSavedFlag] = useState(false);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-950">Central WhatsApp, Lembretes & B-IA</h1>
        <p className="text-sm text-zinc-500">
          Modelos de disparo automático e assistente unificados no mesmo painel.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-red-50/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-950">Assistente B-IA & Automações</h2>
              <p className="text-xs text-zinc-600">
                Cota do plano {plan.name}: {plan.biaMonthlyLimit} mensagens B-IA/mês ·{' '}
                {plan.whatsappEnabled ? 'Disparo automático liberado' : 'Disparo manual via link wa.me (upgrade p/ automático)'}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-800">
            Zero custo de infra até configurar gateway
          </span>
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
