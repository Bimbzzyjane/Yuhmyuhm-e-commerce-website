'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthProvider';

/**
 * Email + password form, shared by `/auth/signin` and `/auth/signup`.
 *
 * One component rather than two so the pages cannot drift apart in validation,
 * labels, error wording or the loading affordance. The only differences are the
 * name and confirm-password fields, both driven by `mode`.
 *
 * Supabase does the authoritative validation (password strength, email format,
 * duplicates, rate limits); the checks here exist only to avoid a pointless
 * round trip and to put a message under the offending field.
 */

export interface AuthFormProps {
  mode: 'signin' | 'signup';
  /** Where to land once a session exists. Defaults to the homepage. */
  next?: string;
}

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ mode, next = '/' }: AuthFormProps) {
  const isSignUp = mode === 'signup';
  const router = useRouter();
  const { user, signInWithEmail, signUpWithEmail, signOut } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): Record<string, string> => {
    const problems: Record<string, string> = {};
    const trimmed = email.trim();

    if (!trimmed) problems.email = 'Enter your email address.';
    else if (!EMAIL_PATTERN.test(trimmed)) problems.email = 'Enter a valid email address.';

    if (!password) problems.password = 'Enter your password.';
    else if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      problems.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (isSignUp && password !== confirmPassword) {
      problems.confirmPassword = 'The two passwords do not match.';
    }

    return problems;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const problems = validate();
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setSubmitting(true);
    try {
      if (isSignUp) {
        const result = await signUpWithEmail({ email, password, fullName });
        if (!result.ok) {
          setError(result.message ?? 'We could not create your account.');
          return;
        }
        if (result.needsEmailConfirmation) {
          setNotice(
            `Almost there — check ${email.trim()} for a confirmation link, then come back to sign in.`,
          );
          return;
        }
      } else {
        const result = await signInWithEmail(email, password);
        if (!result.ok) {
          setError(result.message ?? 'We could not sign you in.');
          return;
        }
      }

      // A refresh guarantees the header, cart and page shell all rebuild
      // against the newly authenticated session rather than the anonymous one.
      router.push(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  // Someone already authenticated (for example they followed "Sign in" from the
  // header) should never see a password form — submitting one would only
  // produce a confusing "wrong password" error.
  if (user) {
    return (
      <div className="stack">
        <div className="alert alert--info" role="status">
          <div>
            <span className="alert__title">You are already signed in</span>
            {user.fullName || user.email}
          </div>
        </div>
        <Link href="/orders" className="btn btn--block">
          View your orders
        </Link>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? (
        <div className="alert alert--error" role="alert">
          <div>{error}</div>
        </div>
      ) : null}

      {notice ? (
        <div className="alert alert--success" role="status">
          <div>{notice}</div>
        </div>
      ) : null}

      {isSignUp ? (
        <div className="field">
          <label className="field__label" htmlFor="auth-name">
            Full name <span className="muted">(optional)</span>
          </label>
          <input
            id="auth-name"
            className="input"
            type="text"
            value={fullName}
            autoComplete="name"
            placeholder="Ada Obi"
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="auth-email">
          Email address
        </label>
        <input
          id="auth-email"
          className={fieldErrors.email ? 'input input--invalid' : 'input'}
          type="email"
          value={email}
          autoComplete="email"
          placeholder="you@example.com"
          autoFocus
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        {fieldErrors.email ? (
          <span className="field__error" id="auth-email-error" role="alert">
            {fieldErrors.email}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="auth-password">
          Password
        </label>
        <div className="password-field">
          <input
            id="auth-password"
            className={fieldErrors.password ? 'input input--invalid' : 'input'}
            type={revealPassword ? 'text' : 'password'}
            value={password}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder={isSignUp ? 'At least 8 characters' : '••••••••'}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="password-field__toggle"
            onClick={() => setRevealPassword((shown) => !shown)}
            aria-pressed={revealPassword}
          >
            {revealPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {fieldErrors.password ? (
          <span className="field__error" id="auth-password-error" role="alert">
            {fieldErrors.password}
          </span>
        ) : null}
      </div>

      {isSignUp ? (
        <div className="field">
          <label className="field__label" htmlFor="auth-confirm-password">
            Confirm password
          </label>
          <input
            id="auth-confirm-password"
            className={fieldErrors.confirmPassword ? 'input input--invalid' : 'input'}
            type={revealPassword ? 'text' : 'password'}
            value={confirmPassword}
            autoComplete="new-password"
            placeholder="Type it again"
            aria-invalid={fieldErrors.confirmPassword ? true : undefined}
            aria-describedby={
              fieldErrors.confirmPassword ? 'auth-confirm-password-error' : undefined
            }
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {fieldErrors.confirmPassword ? (
            <span className="field__error" id="auth-confirm-password-error" role="alert">
              {fieldErrors.confirmPassword}
            </span>
          ) : null}
        </div>
      ) : null}

      <button type="submit" className="btn btn--block" disabled={submitting}>
        {submitting ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {isSignUp ? 'Creating your account…' : 'Signing you in…'}
          </>
        ) : isSignUp ? (
          'Create account'
        ) : (
          'Sign in'
        )}
      </button>
    </form>
  );
}
