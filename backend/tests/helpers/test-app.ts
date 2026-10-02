import type { Express } from 'express';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { type AuthVerifier } from '../../src/auth/auth-verifier';
import { type AppConfig, loadConfig } from '../../src/config/env';
import type { AuthenticatedIdentity } from '../../src/domain/types';
import type { EmailMessage, EmailReceipt, Mailer } from '../../src/email';
import { createMemoryRepositories } from '../../src/repositories/memory/memory-repositories';
import type { Repositories } from '../../src/repositories/types';
import { UnauthorizedError } from '../../src/utils/errors';

/**
 * Test harness.
 *
 * Wires the REAL Express app to the in-memory repositories, a capturing mailer
 * and a stub auth verifier. Nothing touches the network, no environment file is
 * needed, and each call gets its own isolated database.
 */

/** Records every email instead of sending it. */
export class CapturingMailer implements Mailer {
  readonly transport = 'console' as const;
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailReceipt> {
    this.sent.push(message);
    return { id: `test-${this.sent.length}` };
  }

  last(): EmailMessage | undefined {
    return this.sent.at(-1);
  }

  receivedBy(address: string): EmailMessage[] {
    return this.sent.filter((message) => message.to.address === address);
  }
}

/** A deterministic, valid UUID for a fake account. */
export function testAuthUserId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

/** Builds the opaque token the stub verifier understands. */
export function testToken(authUserId: string, email: string, name?: string): string {
  return ['test', authUserId, email, name ?? 'Test Shopper'].join('|');
}

/**
 * Stands in for Supabase Auth. Accepts `test|<authUserId>|<email>|<name>` and
 * rejects everything else, so tests can exercise the 401 path too.
 */
export function createStubAuthVerifier(): AuthVerifier {
  return {
    async verify(accessToken: string): Promise<AuthenticatedIdentity> {
      const [prefix, authUserId, email, name] = accessToken.split('|');
      if (prefix !== 'test' || !authUserId || !email) {
        throw new UnauthorizedError('Invalid test token.');
      }
      return { authUserId, email, fullName: name ?? null, avatarUrl: null };
    },
  };
}

export interface TestContext {
  app: Express;
  repositories: Repositories;
  mailer: CapturingMailer;
  config: AppConfig;
  /** `request(ctx.api)` — supertest bound to the app. */
  api: ReturnType<typeof supertest>;
}

/**
 * `mailerOverride` swaps in a different transport while `ctx.mailer` keeps
 * pointing at the capturing one, so a test can prove that a *failing* mailer
 * neither breaks checkout nor hides the captured messages.
 */
export async function createTestContext(
  overrides: NodeJS.ProcessEnv = {},
  mailerOverride?: Mailer,
): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    BACKEND_DATA_BACKEND: 'memory',
    MAIL_TRANSPORT: 'console',
    // The rate limiters are NOT disabled under test — a limiter that skips
    // itself is a limiter nobody tests. Instead the harness lifts both budgets
    // far above what any suite consumes: `orders.test.ts` alone issues a dozen
    // checkouts from one address, which a production-sized budget of 5/min
    // would (correctly) reject. `tests/rate-limit.test.ts` sets these back down
    // to a deliberately tiny value so it can assert a real 429.
    RATE_LIMIT_MAX_REQUESTS: '100000',
    CHECKOUT_RATE_LIMIT_MAX_REQUESTS: '100000',
    ...overrides,
  });

  const repositories = await createMemoryRepositories({ seed: true });
  const mailer = new CapturingMailer();

  const app = createApp({
    config,
    repositories,
    mailer: mailerOverride ?? mailer,
    authVerifier: createStubAuthVerifier(),
  });

  return { app, repositories, mailer, config, api: supertest(app) };
}

/** Convenience: look up a seeded product by slug. */
export async function findProductBySlug(
  repositories: Repositories,
  slug: string,
): Promise<{ id: string; name: string; price: number; stockQuantity: number }> {
  const product = await repositories.products.findByIdOrSlug(slug);
  if (!product) throw new Error(`Seeded product "${slug}" is missing.`);
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    stockQuantity: product.stockQuantity,
  };
}
