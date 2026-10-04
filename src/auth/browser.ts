'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let pending: Promise<SupabaseClient> | undefined;
export function authClient(): Promise<SupabaseClient> {
 if (!pending) pending = (async () => {
  const response = await fetch('/api/auth/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Sign-in is temporarily unavailable. Please try again later.');
  const { url, publishableKey } = await response.json() as {url:string;publishableKey:string};
  return createClient(url, publishableKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
 })().catch(error => { pending = undefined; throw error; });
 return pending;
}
