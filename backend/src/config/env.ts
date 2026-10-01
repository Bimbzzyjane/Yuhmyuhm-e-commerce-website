import { z } from 'zod';
import { DEFAULT_CURRENCY, toMinor } from '../utils/money';

/**
 * Environment parsing and validation.
 *
 * Everything the process needs is parsed exactly once, here, into a frozen
 * typed object. Nothing else in the codebase reads `process.env` directly —
 * that keeps config drift impossible and makes every value easy to fake in
 * tests by passing an explicit source object to `loadConfig`.
 */

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    /** Comma separated list of browser origins allowed by CORS. */
    CORS_ORIGINS: z.string().default('http://localhost:3000'),

    BACKEND_DATA_BACKEND: z.enum(['memory', 'supabase']).default('memory'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

    MAIL_TRANSPORT: z.enum(['console', 'mailgun']).default('console'),
    MAILGUN_API_KEY: z.string().min(1).optional(),
    MAILGUN_DOMAIN: z.string().min(1).optional(),
    MAILGUN_API_BASE: z.string().url().default('https://api.mailgun.net'),

    /**
     * Sender identity.
     *
     * `MAILGUN_FROM_*` are the documented names. The `EMAIL_FROM_*` pair is
     * still accepted so an existing `.env` keeps working after the rename.
     * Blank values never reach this schema: `loadConfig` drops empty strings
     * before validating, which is what lets every key sit blank in
     * `.env.example` and still boot.
     */
    MAILGUN_FROM_EMAIL: z.email().optional(),
    MAILGUN_FROM_NAME: z.string().min(1).optional(),
    EMAIL_FROM_ADDRESS: z.email().optional(),
    EMAIL_FROM_NAME: z.string().min(1).optional(),

    EMAIL_ORDER_NOTIFICATION_TO: z.email().optional(),

    /** Major currency units, converted to minor units below. */
    DEFAULT_DELIVERY_FEE: z.coerce.number().min(0).default(5000),
    FREE_DELIVERY_THRESHOLD: z.coerce.number().min(0).default(150000),
    CURRENCY: z.string().length(3).default(DEFAULT_CURRENCY),

    MAX_ITEM_QUANTITY: z.coerce.number().int().min(1).max(999).default(20),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(120),

    LOG_LEVEL: z.enum(['silent', 'info', 'debug']).default('info'),
  })
  // Fail fast with an actionable message rather than at the first request that
  // happens to need the missing credential.
  .superRefine((value, ctx) => {
    if (value.BACKEND_DATA_BACKEND === 'supabase') {
      if (!value.SUPABASE_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_URL'],
          message: 'is required when BACKEND_DATA_BACKEND=supabase',
        });
      }
      if (!value.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message: 'is required when BACKEND_DATA_BACKEND=supabase',
        });
      }
    }
    if (value.MAIL_TRANSPORT === 'mailgun') {
      if (!value.MAILGUN_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['MAILGUN_API_KEY'],
          message: 'is required when MAIL_TRANSPORT=mailgun',
        });
      }
      if (!value.MAILGUN_DOMAIN) {
        ctx.addIssue({
          code: 'custom',
          path: ['MAILGUN_DOMAIN'],
          message: 'is required when MAIL_TRANSPORT=mailgun',
        });
      }
    }
  });

export type RawEnv = z.infer<typeof EnvSchema>;

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface MailConfig {
  transport: 'console' | 'mailgun';
  apiKey: string | null;
  domain: string | null;
  apiBase: string;
  fromName: string;
  fromAddress: string;
  orderNotificationTo: string | null;
}

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  isTest: boolean;
  port: number;
  corsOrigins: string[];
  logLevel: 'silent' | 'info' | 'debug';
  dataBackend: 'memory' | 'supabase';
  supabase: SupabaseConfig | null;
  mail: MailConfig;
  currency: string;
  /** Integer minor units (kobo). */
  deliveryFee: number;
  /** Integer minor units (kobo). Orders at or above this subtotal ship free. */
  freeDeliveryThreshold: number;
  maxItemQuantity: number;
  rateLimit: { windowMs: number; max: number };
}

/** Parses a raw environment into the typed config, or throws a helpful error. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  // Treat blank strings as "unset" so a copied .env.example with empty values
  // still boots instead of failing validation.
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && value.trim() !== '') cleaned[key] = value.trim();
  }

  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  return Object.freeze({
    env: env.NODE_ENV,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    logLevel: env.LOG_LEVEL,
    dataBackend: env.BACKEND_DATA_BACKEND,
    // Credentials are exposed whenever BOTH are present, independently of which
    // data backend is active. That lets a developer run the in-memory backend
    // for storage while still testing real Google sign-in against Supabase Auth.
    supabase:
      env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
        ? {
            url: env.SUPABASE_URL,
            serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
          }
        : null,
    mail: {
      transport: env.MAIL_TRANSPORT,
      apiKey: env.MAILGUN_API_KEY ?? null,
      domain: env.MAILGUN_DOMAIN ?? null,
      apiBase: env.MAILGUN_API_BASE.replace(/\/+$/, ''),
      // Blank in .env falls through to the brand default rather than sending
      // mail with an empty From header.
      fromName: env.MAILGUN_FROM_NAME ?? env.EMAIL_FROM_NAME ?? 'Yuhmyuhm Catering Services',
      fromAddress: env.MAILGUN_FROM_EMAIL ?? env.EMAIL_FROM_ADDRESS ?? 'orders@yuhmyuhm.com',
      orderNotificationTo: env.EMAIL_ORDER_NOTIFICATION_TO ?? null,
    },
    currency: env.CURRENCY.toUpperCase(),
    deliveryFee: toMinor(env.DEFAULT_DELIVERY_FEE),
    freeDeliveryThreshold: toMinor(env.FREE_DELIVERY_THRESHOLD),
    maxItemQuantity: env.MAX_ITEM_QUANTITY,
    rateLimit: { windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX_REQUESTS },
  }) satisfies AppConfig;
}

let cached: AppConfig | undefined;

/** Process-wide memoised config. */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

/** Test helper: forget the memoised config. */
export function resetConfigCache(): void {
  cached = undefined;
}
