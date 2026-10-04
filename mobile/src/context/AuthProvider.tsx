import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { signInWithGoogle as runGoogleSignIn } from '../lib/googleAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { UserProfile } from '../lib/types';

/**
 * Identity for the mobile app.
 *
 * Supabase owns the session; the app never mints, stores or refreshes a token of
 * its own. This provider only:
 *   1. restores the existing Supabase session on startup,
 *   2. follows `onAuthStateChange`,
 *   3. exchanges the current access token for the API's own profile row.
 *
 * The session is persisted by Supabase into AsyncStorage (`src/lib/supabase.ts`),
 * so closing and reopening the app restores step 1 without any custom token
 * storage here.
 *
 * The same Supabase project the website uses is configured, so signing in here
 * yields the SAME account — and therefore the same server-side cart.
 */

export interface AuthResult {
  ok: boolean;
  message?: string;
  /** True when the account was created but the project requires email confirmation. */
  needsEmailConfirmation?: boolean;
  /** True when the shopper dismissed the Google browser, so nothing went wrong. */
  cancelled?: boolean;
}

export const AUTH_DISABLED_MESSAGE =
  'Accounts are not available on this deployment yet. Please contact us to order.';

/**
 * Supabase returns technical, English error strings. These are the ones a
 * shopper can actually hit, rewritten into something actionable; anything
 * unrecognised falls back to a neutral message so no internals leak. Mirrors the
 * website's mapping.
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
  [/access_denied|popup closed/i, 'Google sign-in was cancelled.'],
];

function friendlyAuthMessage(raw: string, fallback: string): string {
  return AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(raw))?.[1] ?? fallback;
}

interface AuthContextValue {
  /** False until the initial session lookup has settled. */
  loading: boolean;
  /** False when the Supabase project is not configured on this build. */
  configured: boolean;
  session: Session | null;
  /** The Supabase user. */
  user: User | null;
  /** What authenticated API requests send as `Authorization: Bearer …`. */
  accessToken: string | null;
  /** The API's own profile row for this user (`GET /api/auth/me`). */
  profile: UserProfile | null;
  /**
   * Set when Supabase accepts the session but the API does not recognise the
   * account (e.g. the app is pointed at a different Supabase project than the
   * API). The session is deliberately NOT discarded here — we report it rather
   * than silently dropping the shopper into an anonymous state.
   */
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: { email: string; password: string; fullName?: string }) => Promise<AuthResult>;
  /**
   * Google OAuth, handled by Supabase against the same project the website uses,
   * so a Google account resolves to the same backend profile — and the same cart.
   */
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Re-runs the `/api/auth/me` lookup (for a "retry" on the Account screen). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured;

  const [loading, setLoading] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // `user`/`accessToken` are DERIVED from the session, so they can never drift
  // out of sync with it, and signing out needs no extra state update.
  const user = session?.user ?? null;
  const accessToken = session?.access_token ?? null;

  /*
   * 1 + 2: restore the stored session on startup, then follow auth changes.
   *
   * The listener only calls setState — Supabase warns that awaiting another
   * Supabase call inside `onAuthStateChange` can deadlock, which is why the
   * profile lookup lives in its own effect below.
   */
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session ?? null);
      })
      .catch((error: unknown) => {
        console.error('[auth] could not read the stored session:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * 3: exchange the current token for the API's profile row.
   *
   * Re-runs on every token change, so it also covers the refresh Supabase
   * performs in the background while the app is foregrounded — proving the API
   * still recognises the account with a fresh token.
   */
  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    let cancelled = false;

    api
      .me(accessToken)
      .then((value) => {
        if (cancelled) return;
        setProfile(value);
        setProfileError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[auth] profile lookup failed:', error);
        setProfile(null);
        setProfileError(apiErrorMessage(error, 'The shop could not recognise this account.'));
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: AUTH_DISABLED_MESSAGE };

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { ok: false, message: friendlyAuthMessage(error.message, 'We could not sign you in.') };
    }

    // The listener also sets this; doing it here keeps the UI responsive on the
    // same tick rather than a render later.
    if (data.session) setSession(data.session);
    return { ok: true };
  }, []);

  const signUp = useCallback(
    async ({ email, password, fullName }: { email: string; password: string; fullName?: string }) => {
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
        setSession(data.session);
        return { ok: true };
      }

      // No session means the project has "Confirm email" switched on and is
      // about to send a confirmation link.
      return { ok: true, needsEmailConfirmation: true };
    },
    [],
  );

  /**
   * Google OAuth.
   *
   * The browser round-trip lives in `lib/googleAuth.ts`; this only adapts its
   * result to the same `AuthResult` shape the screens already handle, so the
   * existing error presentation is reused verbatim.
   *
   * Nothing is set locally: establishing the session makes Supabase emit
   * `onAuthStateChange`, which updates `session`/`accessToken` above and in turn
   * re-runs the `/api/auth/me` lookup and the cart merge.
   */
  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    const result = await runGoogleSignIn();
    return {
      ok: result.ok,
      message: result.message
        ? friendlyAuthMessage(result.message, result.message)
        : undefined,
      cancelled: result.cancelled,
    };
  }, []);

  const signOut = useCallback(async () => {
    // Clears the Supabase session (and its AsyncStorage entry) but leaves the
    // account's server-side cart untouched.
    await supabase?.auth.signOut();
    setSession(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!accessToken) return;
    try {
      setProfile(await api.me(accessToken));
      setProfileError(null);
    } catch (error) {
      setProfile(null);
      setProfileError(apiErrorMessage(error, 'The shop could not recognise this account.'));
    }
  }, [accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      configured,
      session,
      user,
      accessToken,
      profile,
      profileError,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [
      loading,
      configured,
      session,
      user,
      accessToken,
      profile,
      profileError,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
