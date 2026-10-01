/**
 * The API is a separate origin from the storefront, so its URL has to reach the
 * browser bundle. Resolved here (rather than only in lib/api.ts) so a missing
 * or blank `frontend/.env.local` still produces a working local build instead
 * of a storefront that silently calls relative URLs.
 *
 * `||` rather than `??`: a line of `KEY=` in a .env file yields an EMPTY STRING,
 * which is falsy but not nullish, so `??` would hand back "".
 *
 * Both spellings are exported because `lib/api.ts` still accepts the legacy
 * `NEXT_PUBLIC_API_BASE_URL` name.
 */
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Do not advertise the framework in responses.
  poweredByHeader: false,

  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_API_BASE_URL: apiUrl,
  },

  images: {
    // Catalogue photography is bundled in `public/images/catalog/`, so it needs
    // no remote pattern. Only Google account avatars, shown next to a signed-in
    // shopper, are still fetched from a third-party host.
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
};

export default nextConfig;
