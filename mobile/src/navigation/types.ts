import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Order } from '../lib/types';

/**
 * Navigation shape.
 *
 * Deliberately small: three tabs (Shop / Cart / Account) plus the auth,
 * checkout and diagnostics screens a stack needs. Everything is guest-accessible —
 * signing in changes which cart is used, not whether the shop is reachable.
 */

export type TabParamList = {
  Shop: undefined;
  Cart: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  /** Wrapped so a screen can jump straight to a tab, e.g. after checkout. */
  Tabs: NavigatorScreenParams<TabParamList>;
  SignIn: undefined;
  SignUp: undefined;
  Diagnostics: undefined;
  Checkout: undefined;
  /**
   * Carries the created order so the confirmation can show the real order number
   * and totals straight from the API response — nothing is re-derived locally.
   */
  OrderConfirmation: { order: Order };
};

/**
 * A screen inside the tab navigator that can also address root-stack routes.
 * `navigate('SignIn')` from a tab bubbles up to the stack, because the action is
 * dispatched through the navigator chain.
 */
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
