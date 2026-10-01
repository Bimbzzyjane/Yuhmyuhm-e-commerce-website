import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // Tests must never depend on a real .env file or network access.
    env: {
      NODE_ENV: 'test',
      BACKEND_DATA_BACKEND: 'memory',
      MAIL_TRANSPORT: 'console',
      LOG_LEVEL: 'silent',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/server.ts', 'src/db/seed.ts', 'src/db/print-schema.ts'],
    },
  },
});
