'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import {
  authRedirectTo,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/types';

/**
 * Identity only.
 *
 * This provider exists to hand an access token to the API client. It never
 * decides what a shopper may see or buy — that is the server's job.
 *
 * Three sign-in methods, all producing the SAME Supabase session and therefore
 * the same bearer token for the API:
 *   1. email + password        (needs no configuration — email auth is on by
 *                              default in every Supabase project)
 *   2. Google                  (needs the Google provider enabled in Supabase)
 *   3. an existing session     (restored from cookies on reload)
 *
 * When Supabase is not configured (`configured === false`) the storefront still
 * works end to end as a guest; the auth pages explain it only when submitted.
 */

export interface AuthResult {
  ok: boolean;
  message?: string;
  /**
   * True when the account was created but Supabase has not returned a session
   * because email confirmation is switched on for the project.
   */
  needsEmailConfirmation?: boolean;
}

export const AUTH_DISABLED_MESSAGE =
  'Accounts are not available on this deployment yet. Please contact us to order.';

/**
 * Supabase returns technical, English error strings. These are the ones a
 * shopper can actually hit, rewritten into something actionable; anything
 * unrecognised falls back to a neutral message so we never leak internals.
 */
const AUTH_ERROR_MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/invalid login credentials/i, 'That email and password do not match an account.'],
  [/user already registered/i, 'An account already exists with that email — sign in instead.'],
  [
    /password should be at least|weak password/i,
    'Your password needs to be at least 8 characters.',
  ],
  [/unable to validate email|invalid email/i, 'That email address does not look valid.'],
  [/email not confirmed/i, 'Please confirm your email address first — check your inbox.'],
  [/rate limit|too many requests/i, 'Too many attempts. Please wait a moment and try again.'],
];

function friendlyAuthMessage(raw: string, fallback: string): string {
  return AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(raw))?.[1] ?? fallback;
}

interface AuthContextValue {
  /** False until the initial session lookup has settled. */
  ready: boolean;
  configured: boolean;
  accessToken: string | null;
  user: UserProfile | null;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (input: {
    email: string;
    password: string;
    fullName?: string;
  }) => Promise<AuthResult>;
  signInWithGoogle: (next?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();

  const [ready, setReady] = useState(!configured);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  /*
   * `user` is DERIVED, not stored. A profile cached from a previous session must
   * never be visible once the token is gone, and deriving it here means signing
   * out needs no extra state update (and no cascading render).
   */
  const user = accessToken ? profile : null;

  // Track the Supabase session (its cookie-backed store survives reloads).
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return; // `ready` is already true in this case.

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setAccessToken(data.session?.access_token ?? null);
      })
      .catch((error: unknown) => {
        console.error('[auth] could not read the session:', error);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Exchange the token for the API's own profile row (created on first sight).
  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    api
      .me(accessToken)
      .then(({ data }) => {
        if (!cancelled) setProfile(data);
      })
      .catch((error: unknown) => {
        // A 401 means the session died (expired/revoked) — drop it locally.
        if (!cancelled) {
          console.error('[auth] profile lookup failed:', error);
          setProfile(null);
          setAccessToken(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { ok: false, message: AUTH_DISABLED_MESSAGE };

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return {
          ok: false,
          message: friendlyAuthMessage(error.message, 'We could not sign you in.'),
        };
      }

      // The auth listener also sets this, but doing it here keeps the UI
      // responsive on the same tick rather than a render later.
      if (data.session) setAccessToken(data.session.access_token);
      return { ok: true };
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName?: string;
    }): Promise<AuthResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { ok: false, message: AUTH_DISABLED_MESSAGE };

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // The name is user metadata, which the API already reads back into
        // `users.full_name`.
        options: fullName?.trim() ? { data: { full_name: fullName.trim() } } : undefined,
      });

      if (error) {
        return {
          ok: false,
          message: friendlyAuthMessage(error.message, 'We could not create your account.'),
        };
      }

      if (data.session) {
        setAccessToken(data.session.access_token);
        return { ok: true };
      }

      // No session means the Supabase project has "Confirm email" switched on
      // and is about to send a confirmation link.
      return { ok: true, needsEmailConfirmation: true };
    },
    [],
  );

  const signInWithGoogle = useCallback(async (next = '/'): Promise<AuthResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { ok: false, message: AUTH_DISABLED_MESSAGE };

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectTo(next),
        // Always let the shopper choose which Google account to use.
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      return {
        ok: false,
        message: friendlyAuthMessage(error.message, 'We could not start Google sign-in.'),
      };
    }
    // On success the browser navigates away to Google, so there is nothing to
    // resolve and `busy` is deliberately left set.
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setAccessToken(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured,
      accessToken,
      user,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [
      ready,
      configured,
      accessToken,
      user,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
