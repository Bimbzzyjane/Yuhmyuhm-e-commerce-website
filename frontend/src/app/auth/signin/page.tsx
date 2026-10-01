import type { Metadata } from 'next';
import Link from 'next/link';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { ChefHatIcon } from '@/components/Icons';
import { ProductImage } from '@/components/ProductImage';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in with Google to keep your Yuhmyuhm cart and order history.',
  robots: { index: false, follow: true },
};

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'Google sign-in is not configured on this deployment yet.',
  missing_code: 'Google did not return an authorisation code. Please try again.',
  exchange_failed: 'We could not complete the sign-in. Please try again.',
};

const TRUST_POINTS = ['Free delivery over ₦150,000', 'Order history', 'Saved delivery details'];

/**
 * Sign-in — the split layout from design/auth.png.
 *
 * Lives outside the `(site)` route group so it renders full-bleed without the
 * storefront header and footer.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error
    ? (ERROR_MESSAGES[error] ?? 'Something went wrong during sign-in. Please try again.')
    : null;

  return (
    <div className="auth">
      <aside className="auth__art">
        <ProductImage
          src="https://picsum.photos/seed/yuhmyuhm-auth/1200/1500"
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
            <h1 className="auth__title">Sign in to Yuhmyuhm</h1>
            <p className="auth__lead">
              We only use your Google account to recognise you and keep your cart and order history
              together. No passwords to remember.
            </p>
          </div>

          <div style={{ marginTop: 'var(--space-6)' }}>
            <GoogleSignInButton />
          </div>

          <p className="auth__divider">or</p>

          <Link href="/search" className="btn btn--outline btn--block">
            Continue as a guest
          </Link>

          <p className="auth__terms">
            By continuing you agree to our <Link href="/terms">Terms of Service</Link> and{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
