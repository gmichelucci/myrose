import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUpStudio, isDemoMode, error: authError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planoParam = searchParams.get('plano');
  const intervalParam = searchParams.get('interval') === 'year' ? 'year' : 'month';
  const afterAuthPath =
    planoParam && ['starter', 'premium', 'profissional'].includes(planoParam)
      ? `/configuracoes?upgrade=${planoParam}&interval=${intervalParam}`
      : '/dashboard';
  const querySuffix = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const [roleTab, setRoleTab] = useState<'profissional' | 'colaboradora'>('profissional');
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate(afterAuthPath);
      } else {
        if (ownerName.trim().length < 2 || businessName.trim().length < 2) {
          throw new Error('Informe seu nome e o nome do seu estúdio.');
        }
        if (!acceptedTerms) {
          throw new Error('Confirme que concorda com os termos de uso e política de privacidade.');
        }
        await signUpStudio({ ownerName, businessName, email, password, whatsapp });
        navigate(afterAuthPath);
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLogin = async () => {
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      await signIn('demo@myrose.app', 'MyRoseDemo2026!');
      navigate('/dashboard');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Falha ao entrar na conta demo.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setErr(null);
    setNotice(null);
    if (!email.trim() || !email.includes('@')) {
      setErr('Digite seu e-mail acima antes de clicar em Esqueci minha senha.');
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      setErr(error.message);
    } else {
      setNotice('Link de recuperação de senha enviado para o seu e-mail!');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-red-50/30 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-red-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o site
        </Link>

        <div className="text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-2 font-bold">
            <img src="/logo.png" alt="MyRose" className="h-14 w-14 rounded-full object-cover shadow-sm ring-1 ring-zinc-900/15" />
            <span className="text-2xl tracking-tight text-zinc-950">
              My<span className="text-red-700">Rose</span>
            </span>
          </Link>
          <h1 className="mt-3 text-xl font-bold text-zinc-950">
            {mode === 'login' ? 'Entrar no seu estúdio' : 'Criar conta gratuita'}
          </h1>
          {mode === 'signup' && (
            <p className="mt-1 text-xs font-medium text-red-700">
              Até 5 clientes grátis • Sem cartão de crédito
            </p>
          )}
          {isDemoMode && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              Modo Preview Local ativo — clique em entrar para explorar o MyRose sem conectar o `.env`.
            </p>
          )}
        </div>

        {mode === 'login' && (
          <>
            <div className="mt-5 grid grid-cols-2 rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setRoleTab('profissional')}
                className={`rounded-lg py-2 ${roleTab === 'profissional' ? 'bg-white text-red-800 shadow-xs' : 'text-zinc-600'}`}
              >
                Profissional
              </button>
              <button
                type="button"
                onClick={() => setRoleTab('colaboradora')}
                className={`rounded-lg py-2 ${roleTab === 'colaboradora' ? 'bg-white text-red-800 shadow-xs' : 'text-zinc-600'}`}
              >
                Colaboradora
              </button>
            </div>
            {roleTab === 'colaboradora' && (
              <p className="mt-2.5 rounded-xl bg-zinc-50 p-2.5 text-center text-xs text-zinc-600">
                Acesse como colaboradora da sua profissional — use o e-mail e a senha fornecidos pela responsável do estúdio.
              </p>
            )}
          </>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          {mode === 'signup' && (
            <>
              <div>
                <label className="text-xs font-medium text-zinc-700">Seu nome completo</label>
                <input
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ex: Camila Rosa"
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Nome do estúdio</label>
                <input
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ex: Studio MyRose"
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">WhatsApp (com DDD)</label>
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="11999990000"
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-700"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-zinc-700">E-mail</label>
            <input
              type="email"
              required={!isDemoMode}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={roleTab === 'colaboradora' ? 'equipe@estudio.com' : 'voce@estudio.com'}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-700"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">Senha</label>
            <div className="relative mt-1">
              <input
                type={showPass ? 'text' : 'password'}
                required={!isDemoMode}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl border border-zinc-200 py-2.5 pl-3.5 pr-10 text-sm outline-none focus:border-red-700"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700"
                aria-label="Mostrar ou ocultar senha"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === 'login' ? (
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-zinc-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-red-700"
                />
                Lembrar de mim
              </label>
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                className="font-medium text-zinc-500 hover:text-red-700 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          ) : (
            <label className="flex items-start gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-red-700"
              />
              <span>Concordo com os Termos de Uso e Política de Privacidade do MyRose.</span>
            </label>
          )}

          {(err || authError) && (
            <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{err ?? authError}</p>
          )}
          {notice && <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-900 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          >
            {busy ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar meu estúdio'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDemoLogin()}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60"
          >
            Testar Estúdio Demo (1 clique)
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-600">
          {mode === 'login' ? (
            <>
              Não tem conta?{' '}
              <Link to={`/cadastro${querySuffix}`} className="font-semibold text-red-700 hover:underline">
                Cadastre-se grátis
              </Link>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <Link to={`/login${querySuffix}`} className="font-semibold text-red-700 hover:underline">
                Fazer login
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
