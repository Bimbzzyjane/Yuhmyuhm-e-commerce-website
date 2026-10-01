import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Prints `schema.sql` to stdout so it can be pasted into the Supabase SQL
 * editor without hunting for the file:
 *
 *   npm run db:print-schema
 *
 * `tsc` does not emit `.sql` files, so we look next to this module first
 * (working from `dist/`, where the build copies it) and fall back to the source
 * location (running from `src/` via tsx).
 */
const candidates = [
  join(__dirname, 'schema.sql'),
  join(__dirname, '..', '..', 'src', 'db', 'schema.sql'),
];

const schemaPath = candidates.find((candidate) => existsSync(candidate));

if (!schemaPath) {
  console.error(
    `Could not locate schema.sql. Looked in:\n${candidates.map((path) => `  - ${path}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(readFileSync(schemaPath, 'utf8'));
}
