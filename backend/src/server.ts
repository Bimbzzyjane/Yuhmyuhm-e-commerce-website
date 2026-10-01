import './config/bootstrap-env';
import { createServer } from 'node:http';
import { createApp } from './app';
import { createSupabaseAuthVerifier, DisabledAuthVerifier } from './auth/auth-verifier';
import { getConfig } from './config/env';
import { createSupabaseClient } from './db/supabase-client';
import { createMailer } from './email';
import { createRepositories } from './repositories';

/**
 * Process entry point. `app.ts` builds the Express app; this file owns the
 * socket, the startup logging and the graceful shutdown.
 */
async function main(): Promise<void> {
  const config = getConfig();

  const repositories = await createRepositories(config);
  const mailer = createMailer(config);

  // Auth needs a Supabase project even when the data backend is in-memory, so
  // the verifier is chosen independently of `dataBackend`. Without credentials
  // the API still serves the whole guest journey; only sign-in is disabled.
  const authVerifier = config.supabase
    ? createSupabaseAuthVerifier(createSupabaseClient(config.supabase))
    : new DisabledAuthVerifier();

  const app = createApp({ config, repositories, mailer, authVerifier });
  const server = createServer(app);

  server.listen(config.port, () => {
    const lines = [
      '',
      '  Yuhmyuhm Catering Services — commerce API',
      `  Listening      http://localhost:${config.port}`,
      `  Health         http://localhost:${config.port}/api/health`,
      `  Environment    ${config.env}`,
      `  Data backend   ${config.dataBackend}`,
      `  Email          ${config.mail.transport}`,
      `  CORS origins   ${config.corsOrigins.join(', ') || '(none configured)'}`,
    ];

    if (config.dataBackend === 'memory') {
      lines.push('  NOTE           running on seeded in-memory data; changes are lost on restart.');
    }
    if (!config.supabase) {
      lines.push('  NOTE           Supabase is not configured; Google sign-in is disabled.');
    }
    if (config.mail.transport === 'console') {
      lines.push('  NOTE           emails are printed here, not sent.');
    }
    lines.push('');

    console.log(lines.join('\n'));
  });

  /** Finish in-flight requests, then exit — important on rolling deploys. */
  const shutdown = (signal: string): void => {
    console.log(`\n${signal} received — closing server.`);
    server.close((error) => {
      if (error) {
        console.error('Error while closing the server:', error);
        process.exit(1);
      }
      process.exit(0);
    });
    // Do not hang forever on a stuck keep-alive connection.
    setTimeout(() => process.exit(0), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${config.port} is already in use. Stop the other process or set PORT to something else.`,
      );
    } else {
      console.error('Server error:', error);
    }
    process.exit(1);
  });
}

main().catch((error: unknown) => {
  console.error('Failed to start the API:', error);
  process.exit(1);
});
