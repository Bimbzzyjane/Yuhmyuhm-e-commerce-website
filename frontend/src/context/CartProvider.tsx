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
import { ApiError, api, clearGuestCartId, getGuestCartId, setGuestCartId } from '@/lib/api';
import type { Cart } from '@/lib/types';
import { useAuth } from './AuthProvider';

/**
 * The cart, as far as the browser is concerned.
 *
 * Design notes:
 *  - The SERVER owns the cart. Every mutation returns the full cart and this
 *    provider simply adopts what came back. There is no optimistic local
 *    arithmetic, so the header badge and the totals can never disagree with
 *    the API.
 *  - A guest cart is remembered by id in localStorage, so it survives refreshes
 *    and closed tabs.
 *  - On sign-in the guest cart is merged into the account (quantities summed)
 *    and the guest id is then discarded.
 */

export type MutationResult = { ok: true } | { ok: false; message: string };

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  /** True while the first cart load is in flight. */
  loading: boolean;
  /** True while a mutation is in flight (used to disable buttons). */
  mutating: boolean;
  error: string | null;
  addItem: (productId: string, quantity?: number) => Promise<MutationResult>;
  updateItem: (itemId: string, quantity: number) => Promise<MutationResult>;
  removeItem: (itemId: string) => Promise<MutationResult>;
  clear: () => Promise<MutationResult>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, accessToken } = useAuth();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adoptCart = useCallback((next: Cart) => {
    setCart(next);
    // Remember the guest identity so a reload finds the same cart.
    if (!next.userId && next.guestToken) setGuestCartId(next.guestToken);
  }, []);

  /** Credentials for this request: the token if signed in, else the guest id. */
  const credentials = useCallback(
    () => (accessToken ? { accessToken } : { guestCartId: getGuestCartId() }),
    [accessToken],
  );

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.getCart(credentials());
      adoptCart(data);
      setError(null);
    } catch (caught) {
      setError(messageFor(caught, 'We could not load your cart.'));
    }
  }, [adoptCart, credentials]);

  // Initial load, and again whenever the sign-in state changes.
  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (accessToken) {
          const guestCartId = getGuestCartId();
          if (guestCartId) {
            try {
              // Merge first: the response already carries the combined cart, so
              // there is no need for a second round trip.
              const { data } = await api.mergeCart(guestCartId, accessToken);
              if (cancelled) return;
              adoptCart(data);
              clearGuestCartId();
              setError(null);
              return;
            } catch (caught) {
              // A failed merge must not stop the shopper from seeing their cart.
              console.error('[cart] guest merge failed:', caught);
            }
          }
        }

        const { data } = await api.getCart(
          accessToken ? { accessToken } : { guestCartId: getGuestCartId() },
        );
        if (cancelled) return;
        adoptCart(data);
        setError(null);
      } catch (caught) {
        if (!cancelled) setError(messageFor(caught, 'We could not load your cart.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authReady, accessToken, adoptCart]);

  /** Wraps a mutation so every one reports the same way and toggles `mutating`. */
  const run = useCallback(
    async (action: () => Promise<Cart>, fallbackMessage: string): Promise<MutationResult> => {
      setMutating(true);
      try {
        adoptCart(await action());
        setError(null);
        return { ok: true };
      } catch (caught) {
        const message = messageFor(caught, fallbackMessage);
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
        async () => (await api.addCartItem(productId, quantity, credentials())).data,
        'We could not add that to your cart.',
      ),
    [credentials, run],
  );

  const updateItem = useCallback(
    (itemId: string, quantity: number) =>
      run(
        async () => (await api.updateCartItem(itemId, quantity, credentials())).data,
        'We could not update that item.',
      ),
    [credentials, run],
  );

  const removeItem = useCallback(
    (itemId: string) =>
      run(
        async () => (await api.removeCartItem(itemId, credentials())).data,
        'We could not remove that item.',
      ),
    [credentials, run],
  );

  const clear = useCallback(
    () =>
      run(async () => (await api.clearCart(credentials())).data, 'We could not empty your cart.'),
    [credentials, run],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart?.itemCount ?? 0,
      loading,
      mutating,
      error,
      addItem,
      updateItem,
      removeItem,
      clear,
      refresh,
    }),
    [cart, loading, mutating, error, addItem, updateItem, removeItem, clear, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>.');
  return context;
}
