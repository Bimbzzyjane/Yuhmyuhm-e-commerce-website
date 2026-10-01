import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthProvider';
import { CartProvider } from '@/context/CartProvider';
import './globals.css';

/**
 * Root layout: fonts, metadata and the client-side providers.
 *
 * The visible chrome (header/footer) lives in the `(site)` route-group layout,
 * so the auth pages can render as the full-bleed split screen from the design.
 *
 * Fonts are self-hosted by next/font at build time — no runtime request to
 * Google, no layout shift, and `display: swap` so text is never invisible.
 */

const display = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

const body = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Yuhmyuhm Catering Services — Celebration Cakes & Catering Equipment',
    template: '%s · Yuhmyuhm Catering Services',
  },
  description:
    'Order hand-finished celebration cakes, professional catering equipment, baking supplies and event essentials. Fresh · Delicious · Memorable.',
  applicationName: 'Yuhmyuhm Catering Services',
  keywords: [
    'catering',
    'celebration cakes',
    'catering equipment',
    'baking supplies',
    'event essentials',
    'Lagos',
    'Nigeria',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Yuhmyuhm Catering Services',
    title: 'Yuhmyuhm Catering Services — Celebration Cakes & Catering Equipment',
    description:
      'Hand-finished cakes and professional catering supplies, delivered. Fresh · Delicious · Memorable.',
    url: siteUrl,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#2a1a10',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        {/*
          Auth wraps Cart because the cart needs the access token to know whose
          cart to load, and to merge a guest cart the moment a shopper signs in.
        */}
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
