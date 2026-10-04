import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from './uuid';

/**
 * Guest cart identity.
 *
 * A guest cart is identified by a UUID the client holds and replays as the
 * `X-Guest-Cart-Id` header — the same key the website keeps in localStorage, so
 * the concept is identical. The UUID is the ONLY thing stored locally: the cart
 * *contents* always live on the server, which stays authoritative.
 *
 * The guest token is cleared after a successful merge into an account (see
 * CartProvider), so signing out starts anonymous browsing from a fresh cart
 * rather than replaying a token the server has already retired.
 */
const GUEST_CART_KEY = 'yuhmyuhm.guestCartId';

/**
 * In-process cache so several requests in one session do not each hit storage.
 * `undefined` means "not read yet"; `null` means "there is none".
 */
let cached: string | null | undefined;

/** The stored guest cart id, or null. Does not create one. */
export async function getStoredGuestCartId(): Promise<string | null> {
  if (cached !== undefined) return cached;
  const stored = await AsyncStorage.getItem(GUEST_CART_KEY);
  cached = stored && stored.trim() !== '' ? stored : null;
  return cached;
}

/** The stored guest cart id, generating and persisting one on first use. */
export async function ensureGuestCartId(): Promise<string> {
  const existing = await getStoredGuestCartId();
  if (existing) return existing;
  return storeGuestCartId(uuidv4());
}

/** Persists a guest cart id (also used to stay in step with the server's echo). */
export async function storeGuestCartId(id: string): Promise<string> {
  cached = id;
  await AsyncStorage.setItem(GUEST_CART_KEY, id);
  return id;
}

/** Forgets the guest cart id — called only after a merge has succeeded. */
export async function clearGuestCartId(): Promise<void> {
  cached = null;
  await AsyncStorage.removeItem(GUEST_CART_KEY);
}
