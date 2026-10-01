import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedIdentity } from '../domain/types';
import { UnauthorizedError } from '../utils/errors';

/**
 * Verifies a caller's bearer token and returns their identity.
 *
 * This is an interface rather than a direct Supabase call for one reason: the
 * middleware that uses it can then be tested against a stub, with no network
 * and no Supabase project.
 */
export interface AuthVerifier {
  verify(accessToken: string): Promise<AuthenticatedIdentity>;
}

function pickString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Verifies the token against the Supabase Auth server.
 *
 * `auth.getUser(jwt)` asks Supabase to validate the signature and expiry, so
 * the API never has to hold a JWT secret and cannot be fooled by a forged or
 * tampered token. Nothing the client claims about itself is trusted.
 */
export function createSupabaseAuthVerifier(client: SupabaseClient): AuthVerifier {
  return {
    async verify(accessToken: string): Promise<AuthenticatedIdentity> {
      if (!accessToken) throw new UnauthorizedError('A bearer token is required.');

      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data?.user) {
        throw new UnauthorizedError(
          'Your session is invalid or has expired. Please sign in again.',
        );
      }

      const user = data.user;
      if (!user.email) {
        throw new UnauthorizedError('That account has no email address attached.');
      }

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

      return {
        authUserId: user.id,
        email: user.email,
        // Google supplies `name` / `picture`; Supabase mirrors them as
        // `full_name` / `avatar_url`. Accept either.
        fullName: pickString(metadata, 'full_name') ?? pickString(metadata, 'name'),
        avatarUrl: pickString(metadata, 'avatar_url') ?? pickString(metadata, 'picture'),
      };
    },
  };
}

/**
 * Used when no Supabase project is configured (the out-of-the-box demo).
 *
 * Anonymous browsing, guest carts and guest checkout all still work — only the
 * authenticated endpoints are unavailable, and they say so clearly rather than
 * failing obscurely.
 */
export class DisabledAuthVerifier implements AuthVerifier {
  async verify(): Promise<AuthenticatedIdentity> {
    throw new UnauthorizedError(
      'Sign-in is not configured on this deployment. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable Google sign-in.',
    );
  }
}
