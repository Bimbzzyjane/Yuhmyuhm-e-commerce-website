import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

/**
 * Google sign-in for the native app.
 *
 * Supabase owns the whole flow — this module only opens the browser and turns the
 * redirect back into a Supabase session. There is no second auth system and no
 * Google credential of any kind in the app: the provider is configured once in
 * the Supabase dashboard and reused verbatim from the website.
 *
 * The resulting session is established through `supabase.auth`, which fires
 * `onAuthStateChange`. `AuthProvider` already listens for that, so it — and
 * therefore `/api/auth/me` and the cart merge — behave exactly as they do for
 * email/password sign-in.
 */

/** Must match `expo.scheme` in app.json. */
const SCHEME = 'yuhmyuhm';

const REDIRECT_PATH = 'auth/callback';

export interface GoogleAuthResult {
  ok: boolean;
  message?: string;
  /** True when the shopper backed out, so the UI can stay quiet. */
  cancelled?: boolean;
}

/**
 * The native redirect URI for the installed app: `yuhmyuhm://auth/callback`.
 *
 * Built with `makeRedirectUri` (so it stays correct if the scheme ever changes)
 * and then normalised: on Android, Expo's native redirect carries THREE slashes
 * (`yuhmyuhm:///auth/callback`). Reducing it to two keeps the value that has to
 * be registered in Supabase simple and canonical.
 */
export function nativeRedirectUri(): string {
  return makeRedirectUri({ scheme: SCHEME, path: REDIRECT_PATH }).replace(':///', '://');
}

// Required on web to complete the browser session; harmless (a no-op) on native.
WebBrowser.maybeCompleteAuthSession();

const CANCELLED: GoogleAuthResult = {
  ok: false,
  cancelled: true,
  message: 'Google sign-in was cancelled.',
};

const FAILED: GoogleAuthResult = {
  ok: false,
  message: 'Google could not sign you in. Please try again.',
};

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'Accounts are not available on this build. Please contact us to order.',
    };
  }

  const redirectTo = nativeRedirectUri();

  let authUrl: string | undefined;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // We open the URL ourselves so we control the browser session and get the
        // redirect back.
        skipBrowserRedirect: true,
        // Always let the shopper pick which Google account to use, as on the web.
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) return { ok: false, message: error.message };
    authUrl = data.url;
  } catch {
    return {
      ok: false,
      message: 'We could not reach Google. Please check your connection and try again.',
    };
  }

  if (!authUrl) return FAILED;

  // Opens the system browser / Chrome Custom Tab and resolves when the app is
  // brought back via the deep link.
  let callbackUrl: string | undefined;
  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
    if (result.type === 'success') callbackUrl = result.url;
  } catch {
    return {
      ok: false,
      message: 'We could not reach Google. Please check your connection and try again.',
    };
  }

  if (!callbackUrl) return CANCELLED; // cancelled or dismissed the browser

  const { params, errorCode } = QueryParams.getQueryParams(callbackUrl);

  if (errorCode) {
    // `access_denied` is what Google returns when the shopper declines consent.
    return errorCode === 'access_denied' ? CANCELLED : FAILED;
  }

  /*
   * Supabase may hand the tokens back directly (implicit flow) or as an
   * authorisation code to exchange (PKCE). Both are handled so the flow works
   * whichever flow the project is configured for.
   */
  try {
    const code = params.code;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return error ? { ok: false, message: error.message } : { ok: true };
    }

    const accessToken = params.access_token;
    const refreshToken = params.refresh_token;
    if (!accessToken || !refreshToken) return FAILED;

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return error ? { ok: false, message: error.message } : { ok: true };
  } catch {
    return {
      ok: false,
      message: 'We could not complete Google sign-in. Please try again.',
    };
  }
}