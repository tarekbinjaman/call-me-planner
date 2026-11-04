/**
 * Public config read from .env (EXPO_PUBLIC_* only). Values are empty until Phase 2 adds Supabase.
 * Expo inlines EXPO_PUBLIC_* at build time, so each one must be read with its full literal name.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const hasSupabaseConfig = env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
