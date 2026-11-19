import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
        await signUpStudio({ ownerName, businessName, email, password, whatsapp });
        if (isDemoMode) {
          navigate(afterAuthPath);
        } else {
          setNotice('Cadastro criado! Se o projeto exigir confirmação, verifique seu e-mail.');
        }
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-red-50/30 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
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
          {isDemoMode && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              Modo Preview Local ativo — clique em entrar para explorar o MyRose sem conectar o `.env`.
            </p>
          )}
        </div>

        {mode === 'login' && (
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
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          {mode === 'signup' && (
            <>
              <div>
                <label className="text-xs font-medium text-zinc-700">Seu nome</label>
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
            <input
              type="password"
              required={!isDemoMode}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-700"
            />
          </div>

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
