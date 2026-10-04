import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Eyebrow } from '../components/Brand';
import { Button } from '../components/Button';
import { Card, DetailRow } from '../components/Card';
import { Screen } from '../components/Screen';
import { ENV, isApiConfigured, isStorefrontConfigured } from '../config/env';
import { ApiError, api, type HealthResponse } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';
import { space } from '../theme/colors';

/**
 * API diagnostics.
 *
 * Its real job in production is answering "which configuration is actually baked
 * into this build?", which is exactly what went wrong when the previous APK was
 * missing its storefront URL. Every value shown here is what the app is really
 * using at runtime.
 */

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; result: HealthResponse }
  | { kind: 'error'; message: string; code: string };

function describeError(error: unknown): { message: string; code: string } {
  if (error instanceof ApiError) return { message: error.message, code: error.code };
  if (error instanceof Error) return { message: error.message, code: 'UNKNOWN' };
  return { message: 'Something went wrong.', code: 'UNKNOWN' };
}

function statusLabel(status: Status): string {
  switch (status.kind) {
    case 'idle':
      return 'Not checked yet';
    case 'loading':
      return 'Contacting the API…';
    case 'success':
      return 'Connected';
    case 'error':
      return 'Could not connect';
  }
}

export function ConnectionStatusScreen() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const runCheck = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const result = await api.health();
      setStatus({ kind: 'success', result });
    } catch (error) {
      setStatus({ kind: 'error', ...describeError(error) });
    }
  }, []);

  // Probe once on launch so the screen is useful without a tap.
  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const busy = status.kind === 'loading';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Eyebrow>Diagnostics</Eyebrow>

        <Card hint="These are the values baked into this build. Product photos come from the storefront, not the API.">
          <DetailRow
            label="API URL"
            value={isApiConfigured ? ENV.apiUrl : 'Not set — see mobile/.env.example'}
            tone={isApiConfigured ? 'default' : 'warning'}
            selectable
          />
          <DetailRow
            label="Storefront"
            value={
              isStorefrontConfigured ? ENV.storefrontUrl : 'Not set — catalogue images will not resolve'
            }
            tone={isStorefrontConfigured ? 'default' : 'warning'}
            selectable
          />
          <DetailRow
            label="Supabase auth"
            value={isSupabaseConfigured ? 'Configured' : 'Not configured'}
            tone={isSupabaseConfigured ? 'default' : 'warning'}
          />
        </Card>

        <Card title="API connection">
          <DetailRow label="Status" value={statusLabel(status)} />

          {status.kind === 'success' ? (
            <View style={styles.details}>
              <DetailRow label="Service" value={status.result.service} />
              <DetailRow label="Uptime" value={`${status.result.uptimeSeconds}s`} />
            </View>
          ) : null}

          {status.kind === 'error' ? (
            <View style={styles.details}>
              <DetailRow label="Code" value={status.code} tone="warning" />
              <DetailRow label="Message" value={status.message} tone="warning" />
            </View>
          ) : null}

          <Button
            label={busy ? 'Testing…' : 'Test API connection'}
            busy={busy}
            onPress={() => void runCheck()}
          />
        </Card>
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
  details: {
    gap: space.sm,
  },
});