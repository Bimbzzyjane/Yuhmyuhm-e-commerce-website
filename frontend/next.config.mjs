/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Do not advertise the framework in responses.
  poweredByHeader: false,

  // The API is a separate origin; fail the production build if it is not set
  // rather than shipping a storefront that silently talks to localhost.
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
  },

  images: {
    // Remote photography for the demo catalogue. Replace with the brand's own
    // assets before launch; `ProductImage` degrades to a local SVG if a remote
    // image ever fails.
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      // picsum redirects to this CDN host for the actual bytes.
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      // Google account avatars shown next to a signed-in shopper.
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default nextConfig;
