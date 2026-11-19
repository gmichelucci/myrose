import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
export const DB_SCHEMA = import.meta.env.VITE_DB_SCHEMA?.trim() || 'public';
export const PUBLIC_BOOKING_FN = import.meta.env.VITE_PUBLIC_BOOKING_FN?.trim() || 'mr-booking-public';

export const isSupabaseConfigured = Boolean(url && anonKey);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any, any, any> | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      db: { schema: DB_SCHEMA },
      auth: {
        storageKey: 'myrose-auth-session',
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function getPublicFunctionUrl(action: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams({ action, ...params }).toString();
  return `${url}/functions/v1/${PUBLIC_BOOKING_FN}?${query}`;
}
