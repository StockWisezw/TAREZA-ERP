import { createClient } from '@supabase/supabase-js';

let rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
if (rawSupabaseUrl.startsWith('https://https://')) {
  rawSupabaseUrl = rawSupabaseUrl.replace('https://https://', 'https://');
}

const isConfigured = !!rawSupabaseUrl && !rawSupabaseUrl.includes('your-project') && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = isConfigured ? rawSupabaseUrl : 'https://sxplkoukvuunxksfisbo.supabase.co';
const supabaseAnonKey = isConfigured ? (import.meta.env.VITE_SUPABASE_ANON_KEY || '') : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4cGxrb3VrdnV1bnhrc2Zpc2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODIzNDEsImV4cCI6MjA5Nzk1ODM0MX0.up70HURLG7NPYCv8E3V5hP4ijvZe_jjZrVOwXVOwH4w';

if (!isConfigured) {
  console.log('[Supabase] Running using default configured production database in supabase.ts.');
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
