'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';

/**
 * "Continue with Google".
 *
 * Google's brand guidelines require the multicolour G, which is why the glyph
 * below hard-codes its four brand colours instead of using `currentColor` like
 * the rest of the icon set.
 *
 * When Supabase is not configured the button is disabled with an explanation,
 * rather than failing on click — a fresh clone can still check out as a guest.
 */

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export interface GoogleSignInButtonProps {
  /** Where to land after the round-trip. Defaults to the current path. */
  next?: string;
  label?: string;
}

export function GoogleSignInButton({
  next,
  label = 'Continue with Google',
}: GoogleSignInButtonProps) {
  const { signInWithGoogle, configured } = useAuth();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setBusy(true);
    setMessage(null);

    const result = await signInWithGoogle(next ?? pathname ?? '/');
    if (!result.ok) {
      setMessage(result.message ?? 'We could not start the sign-in. Please try again.');
      setBusy(false);
    }
    // On success the browser navigates away, so `busy` is intentionally kept.
  };

  return (
    <>
      <button
        type="button"
        className="google-btn"
        onClick={() => void handleClick()}
        disabled={!configured || busy}
      >
        <GoogleGlyph />
        {busy ? 'Redirecting to Google…' : label}
      </button>

      {!configured ? (
        <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
          Sign-in is not configured on this deployment. Guest checkout still works — your cart is
          saved either way.
        </p>
      ) : null}

      {message ? (
        <p className="field__error" role="alert" style={{ marginTop: 'var(--space-2)' }}>
          {message}
        </p>
      ) : null}
    </>
  );
}
