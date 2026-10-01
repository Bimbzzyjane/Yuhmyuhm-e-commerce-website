import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Google OAuth callback.
 *
 * Supabase redirects here with `?code=...` after the provider round-trip. We
 * exchange that code for a session, which @supabase/ssr writes into HTTP-only
 * cookies so the browser client can pick it up on the next render.
 *
 * This route deliberately does NOT create a user or a cart: the API does that
 * lazily the first time it sees the access token (see `GET /api/auth/me`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/auth/signin?error=not_configured`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/signin?error=missing_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth/callback] code exchange failed:', error.message);
    return NextResponse.redirect(`${origin}/auth/signin?error=exchange_failed`);
  }

  // Only ever redirect to a path on this site: an attacker-supplied absolute URL
  // would turn the callback into an open redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
