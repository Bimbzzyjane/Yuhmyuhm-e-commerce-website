import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Navigation shape.
 *
 * Deliberately small: three tabs (Shop / Cart / Account) plus the auth and
 * diagnostics screens a stack needs. Everything is guest-accessible — signing in
 * changes which cart is used, not whether the shop is reachable.
 */

export type RootStackParamList = {
  Tabs: undefined;
  SignIn: undefined;
  SignUp: undefined;
  Diagnostics: undefined;
};

export type TabParamList = {
  Shop: undefined;
  Cart: undefined;
  Account: undefined;
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
