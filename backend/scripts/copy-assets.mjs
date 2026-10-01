// Copies the non-TypeScript assets that `tsc` does not emit into `dist/`.
//
// Right now that is one file — the SQL schema — but keeping it in a script
// rather than an inline shell command makes it work identically on Windows
// (cmd.exe), macOS and Linux, and gives the next such asset an obvious home.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ASSETS = [['src/db/schema.sql', 'dist/db/schema.sql']];

for (const [from, to] of ASSETS) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`copied ${from} -> ${to}`);
}
