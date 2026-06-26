import { createClient } from '@supabase/supabase-js';

let rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
if (rawSupabaseUrl.startsWith('https://https://')) {
  rawSupabaseUrl = rawSupabaseUrl.replace('https://https://', 'https://');
}

const isConfigured = !!rawSupabaseUrl && !rawSupabaseUrl.includes('your-project') && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = isConfigured ? rawSupabaseUrl : 'https://placeholder-project.supabase.co';
const supabaseAnonKey = isConfigured ? (import.meta.env.VITE_SUPABASE_ANON_KEY || '') : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MTYxNjE2MTYsImV4cCI6MTkxNjE2MTYxNn0.placeholder';

if (!isConfigured) {
  console.warn('[Supabase] Running in sandbox mode with placeholder credentials in supabase.ts.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

export default supabase;
