import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage'));
const PublicAnamnesisPage = lazy(() => import('./pages/PublicAnamnesisPage'));
const AppShell = lazy(() => import('./components/AppShell'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AgendaPage = lazy(() => import('./pages/AgendaPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const LashMappingPage = lazy(() => import('./pages/LashMappingPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const AutomationsPage = lazy(() => import('./pages/AutomationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function Loader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white text-sm text-zinc-700">
      <img src="/logo.png" alt="MyRose" className="h-10 w-10 rounded-full object-cover ring-1 ring-zinc-900/15" />
      <span>Carregando MyRose...</span>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { loading, workspace } = useAuth();
  if (loading) return <Loader />;
  if (!workspace) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/cadastro" element={<AuthPage mode="signup" />} />
            <Route path="/agendar/:codigo" element={<PublicBookingPage />} />
            <Route path="/ficha/:token" element={<PublicAnamnesisPage />} />

            <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
            <Route path="/agenda" element={<Protected><AgendaPage /></Protected>} />
            <Route path="/clientes" element={<Protected><ClientsPage /></Protected>} />
            <Route path="/catalogo" element={<Protected><CatalogPage /></Protected>} />
            <Route path="/lash-mapping" element={<Protected><LashMappingPage /></Protected>} />
            <Route path="/financeiro" element={<Protected><FinancePage /></Protected>} />
            <Route path="/automacoes" element={<Protected><AutomationsPage /></Protected>} />
            <Route path="/configuracoes" element={<Protected><SettingsPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
