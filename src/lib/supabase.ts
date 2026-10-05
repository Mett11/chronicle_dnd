import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabaseUrl = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
      return String(import.meta.env.VITE_SUPABASE_URL).trim();
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) {
      return String(process.env.VITE_SUPABASE_URL).trim();
    }
  } catch {}
  return '';
};

const getSupabaseAnonKey = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      return String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim();
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) {
      return String(process.env.VITE_SUPABASE_ANON_KEY).trim();
    }
  } catch {}
  return '';
};

/**
 * Sanitizes header strings to contain exclusively printable ASCII characters (code points 0x20 to 0x7E)
 * Prevents "TypeError: Failed to execute 'set' on 'Headers': String contains non ISO-8859-1 code point"
 */

export const sanitizeHeaderString = (str: string): string => {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E]/g, '').trim();
};

const rawUrl = getSupabaseUrl();
const rawKey = getSupabaseAnonKey();

const supabaseUrl = sanitizeHeaderString(rawUrl);
const supabaseAnonKey = sanitizeHeaderString(rawKey);

let supabaseOfflineUntil = 0;

export const markSupabaseOffline = (durationMs = 60000) => {
  // No-op to prevent disabling Supabase OAuth
};

export const resetSupabaseOffline = () => {
  supabaseOfflineUntil = 0;
};

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('your-project')
  );
};

const activeAnonKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_please_update';

// Create Supabase client with native session persistence, URL OAuth detection, and header sanitization
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, activeAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: (url, options) => {
          if (options && options.headers) {
            const cleanHeaders = new Headers();
            try {
              if (options.headers instanceof Headers) {
                options.headers.forEach((value, key) => {
                  const k = sanitizeHeaderString(key);
                  const v = sanitizeHeaderString(value);
                  if (k && v) cleanHeaders.set(k, v);
                });
              } else if (Array.isArray(options.headers)) {
                options.headers.forEach(([key, value]) => {
                  const k = sanitizeHeaderString(key);
                  const v = sanitizeHeaderString(value);
                  if (k && v) cleanHeaders.set(k, v);
                });
              } else if (typeof options.headers === 'object') {
                Object.entries(options.headers).forEach(([key, value]) => {
                  const k = sanitizeHeaderString(key);
                  const v = sanitizeHeaderString(String(value));
                  if (k && v) cleanHeaders.set(k, v);
                });
              }
            } catch (e) {
              console.warn('[Supabase] Header sanitization notice:', e);
            }
            options = { ...options, headers: cleanHeaders };
          }
          return fetch(url, options);
        },
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
