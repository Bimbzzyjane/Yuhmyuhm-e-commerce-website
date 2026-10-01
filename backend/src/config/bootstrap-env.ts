import { config as loadDotenv } from 'dotenv';

/**
 * Loads `backend/.env` into process.env.
 *
 * Imported for its side effect, first, by the entry points only (`server.ts`,
 * `seed.ts`). Tests deliberately do NOT import this — the suite must pass with
 * no environment file present at all.
 */
loadDotenv({ quiet: true });
