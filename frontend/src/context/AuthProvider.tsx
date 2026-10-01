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
 * decides what a shopper may see or buy — that is the server's job. When
 * Supabase is not configured (`configured === false`) the storefront still
 * works end to end as a guest; only the sign-in button is disabled.
 */

interface AuthContextValue {
  /** False until the initial session lookup has settled. */
  ready: boolean;
  configured: boolean;
  accessToken: string | null;
  user: UserProfile | null;
  signInWithGoogle: (next?: string) => Promise<{ ok: boolean; message?: string }>;
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

  const signInWithGoogle = useCallback(async (next = '/') => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { ok: false, message: 'Sign-in is not configured on this deployment.' };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectTo(next),
        // Always let the shopper choose which Google account to use.
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setAccessToken(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, configured, accessToken, user, signInWithGoogle, signOut }),
    [ready, configured, accessToken, user, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
