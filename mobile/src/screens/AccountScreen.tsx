import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenBrand } from '../components/Brand';
import { Button, LinkButton } from '../components/Button';
import { Card, DetailRow, StateView } from '../components/Card';
import { Screen } from '../components/Screen';
import { useAuth } from '../context/AuthProvider';
import { useCart } from '../context/CartProvider';
import type { TabScreenProps } from '../navigation/types';
import { colors, radius, space } from '../theme/colors';
import { type } from '../theme/typography';

/**
 * Account tab.
 *
 * Shows who is signed in — as Supabase sees them AND as the API recognises them
 * via `/api/auth/me` — and where the cart currently lives.
 *
 * Signing out clears only the local Supabase session. The account's server-side
 * cart is deliberately left alone, so signing back in restores it; anonymous
 * browsing simply resumes with a guest cart afterwards.
 */
export function AccountScreen({ navigation }: TabScreenProps<'Account'>) {
  const { loading, configured, accessToken, user, profile, profileError, signOut, refreshProfile } =
    useAuth();
  const { cart, itemCount, authenticated } = useCart();
  const [signingOut, setSigningOut] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const handleRecheck = useCallback(async () => {
    setChecking(true);
    try {
      await refreshProfile();
    } finally {
      setChecking(false);
    }
  }, [refreshProfile]);

  if (loading) {
    return (
      <Screen>
        <StateView busy title="Restoring your session…" />
      </Screen>
    );
  }

  // ---------------------------------------------------------------- signed out
  if (!accessToken) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenBrand />
          <Card
            title="Browsing as a guest"
            hint="You can shop right away. Sign in with the same account you use on the website and your cart follows you between the app, the website and any other device."
          >
            <Button label="Sign in" onPress={() => navigation.navigate('SignIn')} />
            <Button
              label="Create an account"
              variant="secondary"
              onPress={() => navigation.navigate('SignUp')}
            />
          </Card>

          <Card title="Current cart">
            <DetailRow label="Cart" value={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`} />
            <DetailRow
              label="Type"
              value="Guest cart on this device"
              tone={authenticated ? 'default' : 'muted'}
            />
            <Text style={styles.note}>
              Signing in merges this guest cart into your account through the API's cart-merge
              endpoint — the two carts are summed, not replaced.
            </Text>
          </Card>

          <Card title="Configuration">
            <DetailRow
              label="Supabase auth"
              value={configured ? 'Configured' : 'Not configured'}
              tone={configured ? 'default' : 'warning'}
            />
            <LinkButton
              label="API diagnostics"
              onPress={() => navigation.navigate('Diagnostics')}
            />
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  // --------------------------------------------------------------- signed in
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenBrand />
        <Card title="Signed in">
          <DetailRow label="Email" value={user?.email ?? profile?.email ?? '—'} selectable />
          {profile?.fullName ? <DetailRow label="Name" value={profile.fullName} /> : null}
          <DetailRow
            label="Shop recognises you"
            value={profileError ? 'Not yet' : profile ? 'Yes' : 'Checking…'}
            tone={profileError ? 'warning' : 'default'}
          />
        </Card>

        {profileError ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>The shop could not recognise this account</Text>
            <Text style={styles.warningBody}>{profileError}</Text>
            <Text style={styles.warningBody}>
              This usually means the app and the API are pointed at different Supabase projects, or the
              API is not configured for Supabase yet.
            </Text>
            <LinkButton label="Check again" busy={checking} onPress={() => void handleRecheck()} />
          </View>
        ) : null}

        <Card title="Your cart">
          <DetailRow label="Items" value={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`} />
          <DetailRow label="Total" value={cart?.totalLabel ?? '—'} selectable={Boolean(cart)} />
          <Text style={styles.note}>
            This is your account's server-side cart — the same one the website shows for your
            account, not a separate phone cart.
          </Text>
        </Card>

        <Button
          label="Sign out"
          variant="secondary"
          busy={signingOut}
          onPress={() => void handleSignOut()}
        />

        <LinkButton label="API diagnostics" onPress={() => navigation.navigate('Diagnostics')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  note: {
    ...type.meta,
  },
  warningCard: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  warningTitle: {
    ...type.h2,
    fontSize: 16,
    lineHeight: 22,
    color: colors.danger,
  },
  warningBody: {
    ...type.bodySmall,
    color: colors.danger,
  },
});
