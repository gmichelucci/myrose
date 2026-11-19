import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Calendar,
  ExternalLink,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPlan } from '../lib/domain';

const NAV = [
  { to: '/dashboard', label: 'Geral', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/clientes', label: 'Clientes & Ficha', icon: Users },
  { to: '/catalogo', label: 'Catálogo', icon: Sparkles },
  { to: '/lash-mapping', label: 'Mapping & IA', icon: Eye },
  { to: '/financeiro', label: 'Financeiro & Estoque', icon: Wallet },
  { to: '/automacoes', label: 'WhatsApp & B-IA', icon: MessageSquare },
  { to: '/configuracoes', label: 'Equipe & Config.', icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { workspace, isDemoMode, signOut } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (!workspace) return null;
  const plan = getPlan(workspace.studio.plan_id);

  return (
    <div className="flex min-h-screen bg-zinc-50/70 text-zinc-950">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-5">
          <Link to="/dashboard" className="flex items-center gap-2.5 font-bold text-zinc-950">
            <img src="/logo.png" alt="MyRose" className="h-9 w-9 rounded-full object-cover ring-1 ring-zinc-900/15" />
            <span className="text-lg tracking-tight">
              My<span className="text-red-700">Rose</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-zinc-500 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-red-700'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-zinc-200 p-4">
          <Link
            to={`/agendar/${workspace.studio.booking_slug}`}
            target="_blank"
            className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-red-800 hover:border-red-200 hover:bg-red-50/70"
          >
            <span className="truncate">Link de agendamento</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </Link>

          <div className="flex items-center justify-between text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-900">{workspace.studio.business_name}</p>
              <p className="text-zinc-500">Plano {plan.name}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              title="Sair"
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-zinc-500">
            Olá, <strong className="text-zinc-900">{workspace.studio.owner_name}</strong>
          </span>
          {isDemoMode ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Modo Preview Local (conecte .env p/ Supabase)
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Supabase conectado
            </span>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
