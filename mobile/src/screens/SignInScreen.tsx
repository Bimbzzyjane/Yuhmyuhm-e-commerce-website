import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, LinkButton } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthProvider';
import type { RootScreenProps } from '../navigation/types';
import { colors, radius, space } from '../theme/colors';
import { type } from '../theme/typography';

/**
 * Sign in with email + password.
 *
 * This is the same Supabase project the website uses, so the account entered
 * here is the same account — and the same cart. Google sign-in is deliberately
 * deferred to a later phase.
 *
 * On success the screen just goes back: CartProvider reacts to the new session,
 * merges any guest cart, and loads the account cart.
 */
export function SignInScreen({ navigation }: RootScreenProps<'SignIn'>) {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;

    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await signIn(email, password);
      if (!result.ok) {
        setError(result.message ?? 'We could not sign you in.');
        return;
      }
      navigation.goBack();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not sign you in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card
            title="Sign in to Yuhmyuhm"
            hint="Use the same email and password you use on the website — it is the same account and the same cart."
          >
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!busy}
            />

            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              editable={!busy}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!configured ? (
              <Text style={styles.warning}>
                Accounts are not available on this build. Set the Supabase variables in mobile/.env
                and restart the dev server.
              </Text>
            ) : null}

            <Button label="Sign in" busy={busy} onPress={() => void submit()} />
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Yuhmyuhm?</Text>
            <LinkButton
              label="Create an account"
              disabled={busy}
              onPress={() => navigation.navigate('SignUp')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  error: {
    backgroundColor: colors.dangerSurface,
    color: colors.danger,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 13,
    lineHeight: 18,
  },
  warning: {
    ...type.bodySmall,
    color: colors.danger,
  },
  footer: {
    alignItems: 'center',
    gap: space.xs,
  },
  footerText: {
    ...type.body,
  },
});
