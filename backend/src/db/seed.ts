import '../config/bootstrap-env';
import { getConfig } from '../config/env';
import { createSupabaseRepositories } from '../repositories/supabase/supabase-repositories';
import { createSupabaseClient } from './supabase-client';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './seed-data';

/**
 * Writes the shared seed data into Supabase.
 *
 * Idempotent: categories and products are upserted by `slug`, so running this
 * twice updates in place rather than duplicating the catalogue.
 *
 *   npm run seed
 */
async function main(): Promise<void> {
  const config = getConfig();

  if (!config.supabase) {
    console.error(
      [
        'Nothing to seed: no Supabase project is configured.',
        '',
        'Set these in backend/.env:',
        '  SUPABASE_URL=https://<project-ref>.supabase.co',
        '  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>',
        '',
        'and re-run `npm run seed`.',
        '',
        'You do not need seeding for local development: the API ships with the',
        'same catalogue in memory when BACKEND_DATA_BACKEND=memory.',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const repositories = createSupabaseRepositories(createSupabaseClient(config.supabase));

  // Categories must exist first: products reference them by slug.
  const categoryCount = await repositories.categories.upsertMany(SEED_CATEGORIES);
  const productCount = await repositories.products.upsertMany(SEED_PRODUCTS);

  console.log(
    `Seeded ${categoryCount} categories and ${productCount} products into ${config.supabase.url}.`,
  );
}

main().catch((error: unknown) => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
