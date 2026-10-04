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
 * Create an account.
 *
 * The account is created in the SAME Supabase project as the website, so it is
 * immediately usable on the storefront as well.
 *
 * If the Supabase project has "Confirm email" switched on, no session is
 * returned and the shopper is told to check their inbox instead of being left
 * on a spinner.
 */
export function SignUpScreen({ navigation }: RootScreenProps<'SignUp'>) {
  const { signUp, configured } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;

    if (!email.trim() || !password) {
      setError('Enter an email address and a password.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await signUp({ email, password, fullName });
      if (!result.ok) {
        setError(result.message ?? 'We could not create your account.');
        return;
      }

      if (result.needsEmailConfirmation) {
        setNotice(
          'Almost there — check your inbox to confirm this email address, then sign in. Until then you can keep shopping as a guest.',
        );
        return;
      }

      navigation.goBack();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card
            title="Create your account"
            hint="Your account and cart work here and on the Yuhmyuhm website — sign in once, shop anywhere."
          >
            <TextField
              label="Full name (optional)"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Chioma Okafor"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!busy}
            />

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
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!busy}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {!configured ? (
              <Text style={styles.warning}>
                Accounts are not available on this build. Set the Supabase variables in mobile/.env
                and restart the dev server.
              </Text>
            ) : null}

            <Button label="Create account" busy={busy} onPress={() => void submit()} />
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <LinkButton label="Sign in" disabled={busy} onPress={() => navigation.goBack()} />
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
  notice: {
    backgroundColor: colors.cream,
    color: colors.ink,
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
