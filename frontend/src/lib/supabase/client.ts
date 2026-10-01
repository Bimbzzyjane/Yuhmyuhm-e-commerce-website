import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client — used ONLY for identity (Google sign-in).
 *
 * The storefront never reads or writes a table directly; every piece of
 * commerce data goes through the Express API. Nothing here can leak more than
 * the anon key, which is public by design and fenced off by deny-by-default RLS.
 *
 * Returns `null` when Supabase is not configured, which is the normal state for
 * a fresh clone running on the in-memory backend. Callers must handle that
 * instead of crashing, so the guest journey always works.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  browserClient ??= createBrowserClient(url as string, anonKey as string);
  return browserClient;
}

/** Where Supabase should send the browser back to after Google sign-in. */
export function authRedirectTo(next = '/'): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}
