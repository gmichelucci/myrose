import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, Check, Eye, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PLANS } from '../types/domain';
import { formatCurrencyBRL } from '../lib/domain';

export default function LandingPage() {
  const { workspace } = useAuth();
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5 font-bold">
            <img src="/logo.png" alt="MyRose" className="h-9 w-9 rounded-full object-cover ring-1 ring-zinc-900/15" />
            <span className="text-xl tracking-tight text-zinc-950">
              My<span className="text-red-700">Rose</span>
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 md:flex">
            <a href="#recursos" className="hover:text-red-700">Recursos</a>
            <a href="#depoimentos" className="hover:text-red-700">Depoimentos</a>
            <a href="#precos" className="hover:text-red-700">Planos</a>
            <a href="#faq" className="hover:text-red-700">FAQ</a>
            <Link to="/agendar/studio-demo" className="hover:text-red-700">Ver Agendamento Online</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="rounded-xl bg-gradient-to-r from-red-700 to-red-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-black shadow-lg ring-2 ring-zinc-900/10 sm:h-28 sm:w-28">
          <img src="/logo.png" alt="Logo MyRose" className="h-full w-full object-cover" />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1 text-xs font-semibold text-red-800">
          <Sparkles className="h-3.5 w-3.5" /> Plataforma v2 para Lash & Estética
        </span>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-6xl">
          Sua agenda, mapping e financeiro em{' '}
          <span className="bg-gradient-to-r from-red-700 to-red-900 bg-clip-text text-transparent">
            um só lugar
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-600">
          MyRose organiza seu estúdio do primeiro agendamento online ao retorno de manutenção — leve,
          rápido no celular e com ficha de anamnese, Lash Mapping visual e automações integradas.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-700 to-red-900 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:opacity-95"
          >
            Criar conta gratuita <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/agendar/studio-demo"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Testar link da cliente
          </Link>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4 border-t border-zinc-200 pt-8">
          <div>
            <p className="text-2xl font-extrabold text-zinc-950 sm:text-3xl">+ de 12 mil</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Profissionais de Estética</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-red-700 sm:text-3xl">4.9/5 ★</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Avaliação das Usuárias</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-zinc-950 sm:text-3xl">+ de 360 mil</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Clientes Agendadas</p>
          </div>
        </div>
      </section>

      <section id="recursos" className="mx-auto grid max-w-6xl gap-5 px-4 py-12 md:grid-cols-4">
        {[
          {
            icon: CalendarCheck2,
            title: 'Agendamento 24h',
            desc: 'Link próprio com cálculo inteligente de horários livres, pausa de almoço e sinal Pix.',
          },
          {
            icon: Eye,
            title: 'Mapping + IA integrados',
            desc: 'Desenhe o mapping da cliente em canvas vetorial leve com presets de 6mm a 15mm.',
          },
          {
            icon: ShieldCheck,
            title: 'Anamnese Digital',
            desc: 'Questionário dinâmico por área enviado por link único antes do atendimento.',
          },
          {
            icon: MessageCircle,
            title: 'Central WhatsApp & B-IA',
            desc: 'Modelos prontos de confirmação, manutenção e resgate unificados em uma única tela.',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-zinc-950">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{card.desc}</p>
            </div>
          );
        })}
      </section>

      <section id="precos" className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-zinc-950">Planos transparentes</h2>
          <p className="mt-2 text-zinc-600">Mesma regra de preços e limites no site, no app e no servidor.</p>
          <div className="mt-6 inline-flex rounded-full bg-zinc-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 ${!annual ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600'}`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-5 py-2 ${annual ? 'bg-red-700 text-white shadow-xs' : 'text-zinc-600'}`}
            >
              Anual (até 25% off)
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const shownCents = annual && plan.annualPriceCents > 0
              ? Math.round(plan.annualPriceCents / 12)
              : plan.monthlyPriceCents;
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-6 ${
                  plan.highlight
                    ? 'border-zinc-900 bg-gradient-to-br from-zinc-950 via-red-950 to-red-800 text-white shadow-xl'
                    : 'border-zinc-200 bg-white text-zinc-950'
                }`}
              >
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className={`mt-1 text-xs ${plan.highlight ? 'text-red-100' : 'text-zinc-500'}`}>
                  {plan.tagline}
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">{formatCurrencyBRL(shownCents)}</span>
                  <span className={`text-xs ${plan.highlight ? 'text-red-100' : 'text-zinc-500'}`}>/mês</span>
                </div>
                {annual && plan.annualPriceCents > 0 && (
                  <p className={`mt-1 text-xs ${plan.highlight ? 'text-red-100' : 'text-red-700'}`}>
                    Cobrança anual: {formatCurrencyBRL(plan.annualPriceCents)}
                  </p>
                )}

                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    {plan.clientLimit === null ? 'Clientes ilimitadas' : `Até ${plan.clientLimit} clientes`}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    {plan.mappingLimit === null ? 'Mappings ilimitados' : `Até ${plan.mappingLimit} mappings`}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    {plan.beautyAiMonthlyLimit >= 999999
                      ? 'IA da Beleza ilimitada'
                      : `${plan.beautyAiMonthlyLimit} análises IA/mês`}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    {plan.biaMonthlyLimit > 0 ? `${plan.biaMonthlyLimit} msgs B-IA/mês` : 'Sem B-IA WhatsApp'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    {plan.teamLimit > 0 ? `Até ${plan.teamLimit} colaboradoras` : 'Uso individual'}
                  </li>
                </ul>

                <Link
                  to={
                    plan.monthlyPriceCents === 0
                      ? workspace
                        ? '/dashboard'
                        : '/cadastro'
                      : workspace
                        ? `/configuracoes?upgrade=${plan.id}&interval=${annual ? 'year' : 'month'}`
                        : `/cadastro?plano=${plan.id}&interval=${annual ? 'year' : 'month'}`
                  }
                  className={`mt-6 rounded-xl px-4 py-2.5 text-center text-sm font-semibold ${
                    plan.highlight
                      ? 'bg-white text-zinc-950 hover:bg-zinc-100'
                      : 'bg-red-700 text-white hover:bg-red-800'
                  }`}
                >
                  {plan.monthlyPriceCents === 0 ? 'Criar conta grátis' : 'Escolher plano'}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section id="depoimentos" className="mx-auto max-w-6xl px-4 py-14">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-zinc-950">Quem usa no estúdio recomenda</h2>
          <p className="mt-2 text-sm text-zinc-600">Profissionais de extensão de cílios, sobrancelhas e estética que automatizaram a rotina.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              name: 'Larissa Mendes',
              role: 'Lash Designer · São Paulo/SP',
              quote: 'Antes eu perdia 2 horas por noite respondendo horários no WhatsApp. Agora mando meu link do MyRose e a agenda enche sozinha com sinal Pix.',
            },
            {
              name: 'Bianca Ferreira',
              role: 'Studio Lash & Brow · Belo Horizonte/MG',
              quote: 'O Lash Mapping com a foto da cliente no canvas e a carteira de manutenção de 15+ dias dobraram a taxa de retorno das minhas clientes.',
            },
            {
              name: 'Fernanda Costa',
              role: 'Estética & Micropigmentação · Curitiba/PR',
              quote: 'Controlo a comissão das 3 colaboradoras, o estoque de fios e colas e a ficha de anamnese digital em um único painel pelo celular.',
            },
          ].map((t) => (
            <div key={t.name} className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6">
              <p className="text-xs font-bold text-red-700">★★★★★</p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-700">“{t.quote}”</p>
              <div className="mt-4 border-t border-zinc-200 pt-3">
                <p className="text-sm font-bold text-zinc-950">{t.name}</p>
                <p className="text-xs text-zinc-500">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-4xl px-4 py-14">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-zinc-950">Perguntas Frequentes</h2>
          <p className="mt-2 text-sm text-zinc-600">Tire suas dúvidas antes de criar seu estúdio gratuito.</p>
        </div>
        <div className="mt-8 space-y-3">
          {[
            {
              q: 'Preciso cadastrar cartão de crédito para começar?',
              a: 'Não! O plano Gratuito (R$ 0/mês para até 5 clientes e 5 mappings) não pede cartão e não expira.',
            },
            {
              q: 'Como funciona o link de agendamento 24h para minhas clientes?',
              a: 'Você escolhe o código do seu estúdio (ex: /agendar/seu-estudio), cadastra seus procedimentos e horários, e suas clientes agendam pelo celular sem precisar baixar aplicativo.',
            },
            {
              q: 'Posso cobrar sinal Pix na reserva e controlar equipe?',
              a: 'Sim! Você configura sua chave Pix e a porcentagem de sinal em Configurações, e nos planos Premium (até 3 colaboradoras) e Profissional (até 8 colaboradoras) gerencia agendas e comissões separadas.',
            },
            {
              q: 'Funciona no celular Android, iPhone e computador?',
              a: 'Sim! O MyRose roda direto no navegador, possui aplicativo instalável para Android (.apk), perfil WebClip/PWA em tela cheia para iPhone (iOS) e executável para Windows Desktop.',
            },
          ].map((item) => (
            <details key={item.q} className="group rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer list-none font-bold text-zinc-950">{item.q}</summary>
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-zinc-950 py-10 text-xs text-zinc-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2.5 font-bold text-white">
            <img src="/logo.png" alt="MyRose" className="h-7 w-7 rounded-full object-cover" />
            <span>My<span className="text-red-500">Rose</span> · Plataforma v2.0</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href="#recursos" className="hover:text-white">Recursos</a>
            <a href="#precos" className="hover:text-white">Planos</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
            <Link to="/login" className="hover:text-white">Entrar</Link>
            <Link to="/cadastro" className="hover:text-white">Criar conta</Link>
          </div>
          <p>© {new Date().getFullYear()} MyRose · Conexão segura SSL & LGPD.</p>
        </div>
      </footer>
    </div>
  );
}
