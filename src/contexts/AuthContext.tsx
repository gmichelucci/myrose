import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { loadStudioWorkspace, type StudioWorkspace } from '../services/repository';

interface AuthContextValue {
  loading: boolean;
  studioId: string | null;
  workspace: StudioWorkspace | null;
  isDemoMode: boolean;
  error: string | null;
  refreshWorkspace: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUpStudio: (input: {
    ownerName: string;
    businessName: string;
    email: string;
    password: string;
    whatsapp?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_AUTH_KEY = 'myrose_demo_signed_in';

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'meu-estudio';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<StudioWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolveCurrentSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const signed = localStorage.getItem(DEMO_AUTH_KEY) === '1';
        if (signed) {
          const ws = await loadStudioWorkspace('studio-myrose-demo');
          setStudioId(ws.studio.id);
          setWorkspace(ws);
        } else {
          setStudioId(null);
          setWorkspace(null);
        }
        return;
      }

      const { data: sessData } = await supabase.auth.getSession();
      const user = sessData.session?.user;
      if (!user) {
        setStudioId(null);
        setWorkspace(null);
        return;
      }

      // Portão de aplicativo: evita que usuário do projeto irmão (auth.users compartilhado) entre sem perfil MyRose
      const { data: studioRow, error: studioErr } = await supabase
        .from('mr_studios')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (studioErr) throw new Error(studioErr.message);

      let resolvedId = studioRow?.id ?? null;
      if (!resolvedId) {
        const { data: colabRow, error: colabErr } = await supabase
          .from('mr_collaborators')
          .select('studio_id')
          .eq('auth_user_id', user.id)
          .eq('active', true)
          .maybeSingle();
        if (colabErr) throw new Error(colabErr.message);
        resolvedId = colabRow?.studio_id ?? null;
      }

      if (!resolvedId) {
        const meta = user.user_metadata as Record<string, string | undefined> | undefined;
        if (meta?.app === 'myrose' && meta?.business_name && meta?.owner_name && user.email) {
          const slug = `${slugify(meta.business_name)}-${user.id.slice(0, 6)}`;
          const { data: bootstrapped, error: bootErr } = await supabase.rpc('mr_bootstrap_studio', {
            p_owner_name: meta.owner_name,
            p_business_name: meta.business_name,
            p_email: user.email,
            p_slug: slug,
            p_whatsapp: meta.whatsapp ?? null,
          });
          if (bootErr) throw new Error(bootErr.message);
          if (bootstrapped?.id) {
            resolvedId = bootstrapped.id as string;
          }
        }
      }

      if (!resolvedId) {
        await supabase.auth.signOut();
        setStudioId(null);
        setWorkspace(null);
        setError('Conta encontrada no servidor, mas ainda não possui estúdio cadastrado no MyRose.');
        return;
      }

      const ws = await loadStudioWorkspace(resolvedId);
      setStudioId(resolvedId);
      setWorkspace(ws);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar estúdio';
      setError(
        msg.includes('Invalid schema')
          ? 'Schema "myrose" ainda não foi adicionado em Exposed schemas no painel Data API do Supabase.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void resolveCurrentSession();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      void resolveCurrentSession();
    });
    return () => data.subscription.unsubscribe();
  }, [resolveCurrentSession]);

  const refreshWorkspace = useCallback(async () => {
    if (!studioId) return;
    const ws = await loadStudioWorkspace(studioId);
    setWorkspace(ws);
  }, [studioId]);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      localStorage.setItem(DEMO_AUTH_KEY, '1');
      await resolveCurrentSession();
      return;
    }
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) throw new Error(authErr.message);
    await resolveCurrentSession();
  };

  const signUpStudio = async (input: {
    ownerName: string;
    businessName: string;
    email: string;
    password: string;
    whatsapp?: string;
  }) => {
    if (!isSupabaseConfigured || !supabase) {
      localStorage.setItem(DEMO_AUTH_KEY, '1');
      await resolveCurrentSession();
      return;
    }

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          app: 'myrose',
          owner_name: input.ownerName,
          business_name: input.businessName,
          whatsapp: input.whatsapp ?? '',
        },
      },
    });
    if (signUpErr) throw new Error(signUpErr.message);

    if (data.session) {
      const slug = `${slugify(input.businessName)}-${Math.random().toString(36).slice(2, 6)}`;
      const { error: rpcErr } = await supabase.rpc('mr_bootstrap_studio', {
        p_owner_name: input.ownerName,
        p_business_name: input.businessName,
        p_email: input.email,
        p_slug: slug,
        p_whatsapp: input.whatsapp ?? null,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      await resolveCurrentSession();
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured || !supabase) {
      localStorage.removeItem(DEMO_AUTH_KEY);
      setStudioId(null);
      setWorkspace(null);
      return;
    }
    await supabase.auth.signOut();
    setStudioId(null);
    setWorkspace(null);
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        studioId,
        workspace,
        isDemoMode: !isSupabaseConfigured,
        error,
        refreshWorkspace,
        signIn,
        signUpStudio,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
