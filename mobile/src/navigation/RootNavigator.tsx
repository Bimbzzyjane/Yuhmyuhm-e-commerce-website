import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useCart } from '../context/CartProvider';
import { AccountScreen } from '../screens/AccountScreen';
import { CartScreen } from '../screens/CartScreen';
import { ConnectionStatusScreen } from '../screens/ConnectionStatusScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { colors, space } from '../theme/colors';
import { fontBody, fontDisplay } from '../theme/typography';
import type { RootStackParamList, TabParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.ink,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
    notification: colors.accent,
  },
};

/*
 * The native stack/tab navigation is kept — this is a mobile app, not a squeezed
 * website. Only the chrome is brought in line with the brand: the screen title
 * takes the display serif, and the bars pick up the cream/ink/gold palette with
 * hairline separators instead of shadows.
 */
const headerScreenOptions = {
  headerStyle: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTintColor: colors.ink,
  headerShadowVisible: false,
  headerTitleStyle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.ink,
  },
};

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof TabParamList, IoniconName> = {
  Shop: 'storefront-outline',
  Cart: 'cart-outline',
  Account: 'person-circle-outline',
};

/** Live item count badge, straight from the server-authoritative cart. */
function MainTabs() {
  const { itemCount } = useCart();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerScreenOptions,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: space.sm,
        },
        tabBarLabelStyle: { fontFamily: fontBody, fontSize: 11, letterSpacing: 0.3 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Shop" component={ShopScreen} options={{ title: 'Shop' }} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: 'Cart',
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.surface },
        }}
      />
      <Tab.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator screenOptions={headerScreenOptions}>
        <RootStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
        <RootStack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign in' }} />
        <RootStack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create account' }} />
        <RootStack.Screen
          name="Diagnostics"
          component={ConnectionStatusScreen}
          options={{ title: 'API diagnostics' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
