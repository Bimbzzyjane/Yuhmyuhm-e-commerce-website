import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, apiErrorMessage, type CartCredentials } from '../lib/api';
import {
  clearGuestCartId,
  ensureGuestCartId,
  getStoredGuestCartId,
  storeGuestCartId,
} from '../lib/guestCart';
import type { Cart } from '../lib/types';
import { useAuth } from './AuthProvider';

/**
 * The cart, as far as the app is concerned.
 *
 * THE SERVER OWNS THE CART. There is exactly one cart database — the API's,
 * backed by Supabase — and both the website and this app read and write the same
 * rows:
 *
 *   Website ─┐
 *           ├─> Express API ─> Supabase `carts` / `cart_items`
 *   Mobile  ─┘
 *
 * Every cart endpoint returns the FULL cart DTO, so this provider simply adopts
 * what came back. There is no optimistic arithmetic and no mobile-only cart
 * store: local state is a display cache, nothing more.
 *
 * Identity comes from the auth provider — the Supabase access token when signed
 * in, otherwise the guest cart UUID held in AsyncStorage. Exactly one is ever
 * sent, and `POST /api/cart/merge` folds the guest cart into the account on
 * sign-in (quantities summed, so an existing account cart is never overwritten).
 */

export type MutationResult = { ok: true } | { ok: false; message: string };

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  /** True while the first cart load is in flight. */
  loading: boolean;
  /** True while a mutation is in flight (used to disable controls). */
  mutating: boolean;
  error: string | null;
  /** True when the cart belongs to a signed-in account (false = guest cart). */
  authenticated: boolean;
  addItem: (productId: string, quantity?: number) => Promise<MutationResult>;
  updateItem: (itemId: string, quantity: number) => Promise<MutationResult>;
  removeItem: (itemId: string) => Promise<MutationResult>;
  clear: () => Promise<MutationResult>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, accessToken } = useAuth();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adoptCart = useCallback((next: Cart) => {
    setCart(next);
    // Stay in step with whatever token the server used. Only relevant for a guest
    // cart, where the header we send is echoed back on the cart.
    if (!next.userId && next.guestToken) void storeGuestCartId(next.guestToken);
  }, []);

  /** Credentials for this request: the token if signed in, else the guest id. */
  const credentials = useCallback(async (): Promise<CartCredentials> => {
    if (accessToken) return { accessToken };
    return { guestCartId: await ensureGuestCartId() };
  }, [accessToken]);

  const refresh = useCallback(async () => {
    try {
      adoptCart(await api.getCart(await credentials()));
      setError(null);
    } catch (caught) {
      setError(apiErrorMessage(caught, 'We could not load your cart.'));
    }
  }, [adoptCart, credentials]);

  /*
   * Initial load, and again whenever the sign-in state changes.
   *
   * On sign-in we merge the guest cart BEFORE reading, because the merge
   * response already carries the combined cart — one round trip instead of two,
   * and no window in which the account cart could be overwritten by the guest's.
   */
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (accessToken) {
          const guestCartId = await getStoredGuestCartId();
          if (guestCartId) {
            try {
              const merged = await api.mergeCart(guestCartId, accessToken);
              if (cancelled) return;
              adoptCart(merged);
              // Only forget the guest token once the merge actually succeeded, so
              // a transient failure can be retried without losing the cart.
              await clearGuestCartId();
              setError(null);
              return;
            } catch (caught) {
              // A failed merge must not stop the shopper seeing their account cart.
              console.error('[cart] guest merge failed:', caught);
            }
          }
        }

        adoptCart(
          await api.getCart(
            accessToken ? { accessToken } : { guestCartId: await ensureGuestCartId() },
          ),
        );
        setError(null);
      } catch (caught) {
        if (!cancelled) setError(apiErrorMessage(caught, 'We could not load your cart.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, accessToken, adoptCart]);

  /** Wraps a mutation so every one reports the same way and toggles `mutating`. */
  const run = useCallback(
    async (action: () => Promise<Cart>, fallbackMessage: string): Promise<MutationResult> => {
      setMutating(true);
      try {
        adoptCart(await action());
        setError(null);
        return { ok: true };
      } catch (caught) {
        const message = apiErrorMessage(caught, fallbackMessage);
        setError(message);
        return { ok: false, message };
      } finally {
        setMutating(false);
      }
    },
    [adoptCart],
  );

  const addItem = useCallback(
    (productId: string, quantity = 1) =>
      run(
        async () => api.addCartItem(productId, quantity, await credentials()),
        'We could not add that to your cart.',
      ),
    [credentials, run],
  );

  /** `quantity: 0` removes the line — the API's documented PATCH behaviour. */
  const updateItem = useCallback(
    (itemId: string, quantity: number) =>
      run(
        async () => api.updateCartItem(itemId, quantity, await credentials()),
        'We could not update that item.',
      ),
    [credentials, run],
  );

  const removeItem = useCallback(
    (itemId: string) =>
      run(
        async () => api.removeCartItem(itemId, await credentials()),
        'We could not remove that item.',
      ),
    [credentials, run],
  );

  const clear = useCallback(
    () => run(async () => api.clearCart(await credentials()), 'We could not empty your cart.'),
    [credentials, run],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart?.itemCount ?? 0,
      loading,
      mutating,
      error,
      authenticated: Boolean(accessToken),
      addItem,
      updateItem,
      removeItem,
      clear,
      refresh,
    }),
    [
      cart,
      loading,
      mutating,
      error,
      accessToken,
      addItem,
      updateItem,
      removeItem,
      clear,
      refresh,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>.');
  return context;
}
