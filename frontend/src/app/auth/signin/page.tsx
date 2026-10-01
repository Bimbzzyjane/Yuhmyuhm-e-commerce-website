import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { ChefHatIcon } from '@/components/Icons';
import { ProductImage } from '@/components/ProductImage';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to Yuhmyuhm Catering Services with your email and password, or continue with Google.',
  robots: { index: false, follow: true },
};

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'Accounts are not available on this deployment yet.',
  missing_code: 'Google did not return an authorisation code. Please try again.',
  exchange_failed: 'We could not complete the sign-in. Please try again.',
};

const TRUST_POINTS = ['Free delivery over ₦150,000', 'Order history', 'Saved delivery details'];

/**
 * Sign in — the split layout from design/auth.png, with the order the brief
 * asked for:
 *
 *   1. email + password (the primary route)
 *   2. an `or` divider
 *   3. Continue with Google
 *   4. a link to create an account
 *
 * `?next=` is honoured through both routes and validated to be a local path, so
 * it can never become an open redirect.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  const message = error
    ? (ERROR_MESSAGES[error] ?? 'Something went wrong during sign-in. Please try again.')
    : null;

  const safeNext =
    typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  return (
    <div className="auth">
      <aside className="auth__art">
        <ProductImage
          src="/images/catalog/auth-cake.jpg"
          alt=""
          className="auth__art-image"
          sizes="(max-width: 880px) 100vw, 50vw"
          priority
        />
        <div className="auth__art-body">
          <p className="eyebrow">Fresh · Delicious · Memorable</p>
          <h2 className="auth__art-title">Your cart, wherever you are.</h2>
          <p className="auth__art-lead">
            Sign in and everything you have already added stays with you — on your phone, your
            laptop, anywhere. We will merge your guest cart so nothing is lost.
          </p>
          <ul className="auth__art-trust">
            {TRUST_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="auth__panel">
        <div className="auth__card">
          <Link href="/" className="header__logo" aria-label="Yuhmyuhm Catering Services — home">
            <span className="header__logo-mark" aria-hidden="true">
              <ChefHatIcon size={22} />
            </span>
            <span className="header__logo-text">
              <span className="header__logo-name">Yuhmyuhm</span>
              <span className="header__logo-tag">Catering Services</span>
            </span>
          </Link>

          {message ? (
            <div
              className="alert alert--error"
              role="alert"
              style={{ marginTop: 'var(--space-5)' }}
            >
              <div>
                <span className="alert__title">Sign-in problem</span>
                {message}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 'var(--space-6)' }}>
            <p className="eyebrow">Welcome back</p>
            <h1 className="auth__title">Sign in</h1>
            <p className="auth__lead">
              Sign in to keep your cart, your order history and your saved delivery details
              together.
            </p>
          </div>

          <div style={{ marginTop: 'var(--space-5)' }}>
            <AuthForm mode="signin" next={safeNext} />
          </div>

          <p className="auth__divider">or</p>

          <GoogleSignInButton next={safeNext} />

          <p className="auth__switch">
            Don&rsquo;t have an account yet?{' '}
            <Link href={`/auth/signup?next=${encodeURIComponent(safeNext)}`}>Create one</Link>
          </p>

          <p className="auth__terms">
            By continuing you agree to our <Link href="/terms">Terms of Service</Link> and{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
