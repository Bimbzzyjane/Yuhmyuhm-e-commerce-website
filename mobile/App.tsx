import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthProvider';
import { CartProvider } from './src/context/CartProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * Root component.
 *
 * Provider order matters:
 *   SafeAreaProvider -> AuthProvider -> CartProvider -> RootNavigator
 *
 * AuthProvider supplies the Supabase session/access token; CartProvider needs
 * that token to decide whether to use the account cart or the guest cart, so it
 * must sit inside. Both providers only talk to the existing Express API — there
 * is no mobile-only backend.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
