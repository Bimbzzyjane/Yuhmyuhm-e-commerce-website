/**
 * Mobile environment.
 *
 * Every value is read as a full literal `process.env.EXPO_PUBLIC_*` expression
 * because Expo inlines these statically at build time — a computed lookup such
 * as `process.env[name]` would NOT be substituted into the bundle.
 *
 * `||` rather than `??` deliberately: a line of `KEY=` in a .env file yields an
 * EMPTY STRING, which is falsy but not nullish, so `??` would hand back "".
 *
 * These are PUBLIC values. Nothing secret is ever read here (see .env.example).
 *
 * Note for cloud builds: a local `.env` is gitignored and therefore NOT uploaded
 * to EAS Build. The preview APK gets these values from EAS environment variables
 * (`eas env:create` / `eas env:set`), which are inlined into the bundle at build
 * time exactly as they are locally.
 */

/**
 * Trims surrounding whitespace and removes trailing slashes, so a base URL works
 * whether it was pasted as `https://api.example.com` or `https://api.example.com/`.
 * Paths are preserved, so a base like `https://example.com/api/` is fine too.
 */
function normaliseBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export const ENV = {
  /** Base URL of the existing Express API, never ending in a slash. */
  apiUrl: normaliseBaseUrl(process.env.EXPO_PUBLIC_API_URL || ''),
  /** Supabase project URL (same project as the website). */
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim(),
  /** Supabase publishable/anon key (public by design, RLS-guarded). */
  supabaseAnonKey: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
  /** Storefront origin, used to resolve relative catalogue image paths. */
  storefrontUrl: normaliseBaseUrl(process.env.EXPO_PUBLIC_STOREFRONT_URL || ''),
} as const;

/** True when the API base URL has been provided. */
export const isApiConfigured = ENV.apiUrl.length > 0;

/**
 * True when catalogue images can be resolved.
 *
 * The API returns relative image paths (`/images/catalog/<slug>.jpg`) that are
 * served by the storefront, not the API, so without this value every product
 * falls back to a placeholder. Exposed so the UI can say so plainly instead of
 * silently rendering blank tiles.
 */
export const isStorefrontConfigured = ENV.storefrontUrl.length > 0;

/**
 * A human-readable reason the API cannot be called, or `null` when it is fine.
 *
 * Worth having because a base URL pasted without its scheme (`api.example.com`)
 * or with stray whitespace produces an opaque network failure deep inside
 * `fetch`. The deployed API is HTTPS, so plain `http://` is only acceptable for
 * local development (emulator `10.0.2.2` or a LAN address).
 */
export function apiUrlIssue(): string | null {
  if (!isApiConfigured) {
    return 'The API URL is not configured. Set EXPO_PUBLIC_API_URL (and for a cloud build, add it as an EAS environment variable), then rebuild.';
  }
  if (!/^https?:\/\//i.test(ENV.apiUrl)) {
    return `EXPO_PUBLIC_API_URL must start with https:// (got "${ENV.apiUrl}").`;
  }
  return null;
}


/**
 * Turns an API-supplied image path into an absolute URL.
 *
 * The catalogue returns relative paths such as
 * `/images/catalog/chocolate-delight-cake.jpg`, which are served by the Next.js
 * storefront's `public/` directory rather than by the API. Absolute URLs pass
 * through untouched; an unresolvable relative path returns `null` so the caller
 * can fall back to a placeholder.
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!ENV.storefrontUrl) return null;
  return `${ENV.storefrontUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}
