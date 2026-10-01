import type { AppConfig } from '../config/env';
import { createSupabaseClient } from '../db/supabase-client';
import { createMemoryRepositories } from './memory/memory-repositories';
import { createSupabaseRepositories } from './supabase/supabase-repositories';
import type { Repositories } from './types';

export * from './types';
export { createMemoryRepositories } from './memory/memory-repositories';
export { createSupabaseRepositories } from './supabase/supabase-repositories';

/**
 * Picks the storage implementation from configuration.
 *
 * `memory` is the default so a fresh clone (and every automated test) works
 * with no external services. `supabase` is what runs in production.
 */
export async function createRepositories(config: AppConfig): Promise<Repositories> {
  if (config.dataBackend === 'supabase') {
    if (!config.supabase) {
      // loadConfig() already enforces this, so reaching here means the config
      // object was hand-built incorrectly.
      throw new Error(
        'BACKEND_DATA_BACKEND=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    return createSupabaseRepositories(createSupabaseClient(config.supabase));
  }

  return createMemoryRepositories({ seed: true });
}
