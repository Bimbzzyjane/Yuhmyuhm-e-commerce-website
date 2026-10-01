import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from '../config/env';

/**
 * Service-role Supabase client — SERVER ONLY.
 *
 * The service-role key bypasses Row Level Security, which is exactly what the
 * API needs and exactly why this module must never be imported by frontend
 * code. Sessions are disabled because we are not acting as a browser: the API
 * verifies caller tokens explicitly (see auth/auth-verifier.ts).
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'X-Client-Info': 'yuhmyuhm-commerce-api' },
    },
  });
}

export type { SupabaseClient };

/** Postgres error code for a unique-constraint violation. */
export const PG_UNIQUE_VIOLATION = '23505';
