import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { auth } from './firebase';

const getEnvVar = (name: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      return String(import.meta.env[name]).trim();
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return String(process.env[name]).trim();
    }
  } catch {}
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

let supabaseOfflineUntil = 0;

export const markSupabaseOffline = (durationMs = 60000) => {
  supabaseOfflineUntil = Date.now() + durationMs;
};

export const resetSupabaseOffline = () => {
  supabaseOfflineUntil = 0;
};

export const isSupabaseConfigured = (): boolean => {
  if (Date.now() < supabaseOfflineUntil) return false;
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('placeholder')
  );
};

// Create client with Firebase Auth ID Token provider for Supabase Third-Party Auth / Custom JWT
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      accessToken: async () => {
        try {
          const user = auth.currentUser;
          if (user) {
            return await user.getIdToken();
          }
        } catch (err) {
          console.warn('[Supabase] Could not fetch Firebase ID token:', err);
        }
        return null;
      },
    })
  : (createClient('https://placeholder.supabase.co', 'placeholder-key') as SupabaseClient);

/**
 * Helper to test Supabase connection status.
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Supabase URL and Anon Key are missing in environment variables.',
    };
  }

  try {
    const { error } = await supabase.from('campaigns').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: `Supabase Error: ${error.message}` };
    }
    return { success: true, message: 'Successfully connected to Supabase PostgreSQL database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Connection failed' };
  }
}
