
import { createClient } from '@supabase/supabase-js';

const win: any = typeof window !== 'undefined' ? window : {};

let supabaseUrl = '';
let supabaseAnonKey = '';
let urlSource = '';
let keySource = '';

if (win.VITE_SUPABASE_URL) {
  supabaseUrl = win.VITE_SUPABASE_URL;
  urlSource = 'window.VITE_SUPABASE_URL';
} else if (win.SUPABASE_URL) {
  supabaseUrl = win.SUPABASE_URL;
  urlSource = 'window.SUPABASE_URL';
} else if (import.meta.env.VITE_SUPABASE_URL) {
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  urlSource = 'env.VITE_SUPABASE_URL';
} else if (import.meta.env.SUPABASE_URL) {
  supabaseUrl = import.meta.env.SUPABASE_URL;
  urlSource = 'env.SUPABASE_URL';
}

if (win.VITE_SUPABASE_ANON_KEY) {
  supabaseAnonKey = win.VITE_SUPABASE_ANON_KEY;
  keySource = 'window.VITE_SUPABASE_ANON_KEY';
} else if (win.SUPABASE_ANON_KEY) {
  supabaseAnonKey = win.SUPABASE_ANON_KEY;
  keySource = 'window.SUPABASE_ANON_KEY';
} else if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  keySource = 'env.VITE_SUPABASE_ANON_KEY';
} else if (import.meta.env.SUPABASE_ANON_KEY) {
  supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;
  keySource = 'env.SUPABASE_ANON_KEY';
} else if (import.meta.env.SUPABASE_KEY) {
  supabaseAnonKey = import.meta.env.SUPABASE_KEY;
  keySource = 'env.SUPABASE_KEY';
}

console.log('Supabase Init:', {
  urlFound: !!supabaseUrl,
  keyFound: !!supabaseAnonKey,
  urlLength: supabaseUrl.length,
  urlSource,
  keySource,
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);
