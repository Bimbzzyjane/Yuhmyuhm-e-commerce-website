import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { ENV } from '../config/env';

/**
 * Mobile Supabase client.
 *
 * Identity only — like the website, the app never reads or writes a table
 * directly (all commerce data goes through the Express API, which re-verifies
 * this session's access token server-side). This client exists to sign the user
 * in and to hand `auth.ts`/the API client a fresh `access_token`.
 *
 * React Native has no browser storage/cookies and no URL bar, so the client is
 * configured explicitly:
 *   - `storage: AsyncStorage`   -> the session survives app restarts
 *   - `persistSession: true`    -> store it
 *   - `autoRefreshToken: true`  -> refresh the short-lived access token
 *   - `detectSessionInUrl: false` -> required on native; there is no OAuth URL
 *     fragment to parse on launch (that is a browser-only behaviour)
 *
 * Returns `null` when Supabase is not configured, so the app can still render a
 * "not configured" state instead of crashing — the same defensive pattern the
 * website's `getSupabaseBrowserClient()` uses.
 */

export const isSupabaseConfigured: boolean =
  ENV.supabaseUrl.length > 0 && ENV.supabaseAnonKey.length > 0;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: {
        // AsyncStorage is not available on web; on native it is what persists
        // the session across restarts.
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Supabase only refreshes tokens while the app is in the foreground. Registering
 * this once (module scope) tells it to start refreshing when the app becomes
 * active and stop when it is backgrounded, so a backgrounded app does not burn
 * battery polling for a refresh it cannot use.
 *
 * Registered exactly once because this module is only evaluated once.
 */
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
