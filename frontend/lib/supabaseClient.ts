
import { createClient } from '@supabase/supabase-js';

// 1. Try injected window variables (Runtime)
// 2. Try build-time env variables (Vite)
// 3. Fallback to empty string
const supabaseUrl = (window as any).VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (window as any).VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (import.meta.env.DEV) {
  console.log("Supabase URL Source:", (window as any).VITE_SUPABASE_URL ? "window" : "env");
}

console.log("Supabase Init:", {
  urlFound: !!supabaseUrl,
  keyFound: !!supabaseAnonKey,
  urlLength: supabaseUrl.length
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);
