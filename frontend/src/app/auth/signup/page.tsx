import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { ChefHatIcon } from '@/components/Icons';
import { ProductImage } from '@/components/ProductImage';

export const metadata: Metadata = {
  title: 'Create an account',
  description:
    'Create a Yuhmyuhm Catering Services account with an email and password, or sign up with Google.',
  robots: { index: false, follow: true },
};

const TRUST_POINTS = ['Check out in seconds', 'Track every order', 'Free delivery over ₦150,000'];

/**
 * Create an account.
 *
 * Mirrors `/auth/signin` exactly — name, email, password, confirm password,
 * then an `or` divider and Google — with the framing changed. Both routes
 * produce the same Supabase session, so `GET /api/auth/me` creates the profile
 * on the very first request either way.
 *
 * If the Supabase project has "Confirm email" switched on, Supabase returns no
 * session after sign-up; `AuthForm` detects that and asks the shopper to check
 * their inbox rather than pretending they are signed in.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

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
          <p className="eyebrow">Join the family</p>
          <h2 className="auth__art-title">One account, every occasion.</h2>
          <p className="auth__art-lead">
            An account keeps your cart across devices, remembers your delivery address and puts
            every order you have placed in one place.
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

          <div style={{ marginTop: 'var(--space-6)' }}>
            <p className="eyebrow">Get started</p>
            <h1 className="auth__title">Create your account</h1>
            <p className="auth__lead">It takes a moment, and your guest cart comes with you.</p>
          </div>

          <div style={{ marginTop: 'var(--space-5)' }}>
            <AuthForm mode="signup" next={safeNext} />
          </div>

          <p className="auth__divider">or</p>

          <GoogleSignInButton next={safeNext} label="Sign up with Google" />

          <p className="auth__switch">
            Already have an account?{' '}
            <Link href={`/auth/signin?next=${encodeURIComponent(safeNext)}`}>Sign in</Link>
          </p>

          <p className="auth__terms">
            By creating an account you agree to our <Link href="/terms">Terms of Service</Link> and{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
