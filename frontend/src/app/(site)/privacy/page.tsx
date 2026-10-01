import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What personal data Yuhmyuhm Catering Services collects, why we collect it, and how to have it removed.',
  alternates: { canonical: '/privacy' },
};

/**
 * NOTE FOR THE TEAM: written to match what the software actually does — that
 * alignment is the point. If data collection changes (analytics, a newsletter,
 * a payment provider), this page must change with it.
 */
export default function PrivacyPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <p className="eyebrow">Legal</p>
          <h1 className="page-head__title">Privacy Policy</h1>
          <p className="page-head__lead">What we collect, why, and how to ask us to delete it.</p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="prose">
            <h2>1. What we collect</h2>
            <ul>
              <li>
                <strong>Account details.</strong> When you sign in with Google we receive your name,
                email address and profile picture. We never see your Google password.
              </li>
              <li>
                <strong>Order details.</strong> The name, email, phone number, delivery address and
                any notes you give us at checkout, plus the items you ordered.
              </li>
              <li>
                <strong>Cart details.</strong> The items in your cart. A guest cart is identified by
                a random id stored in your browser — it contains no personal information.
              </li>
            </ul>

            <h2>2. What we do not do</h2>
            <ul>
              <li>We do not take or store card details on this website.</li>
              <li>We do not sell or rent your personal data to anyone.</li>
              <li>We do not use your data for third-party advertising.</li>
            </ul>

            <h2>3. Why we use it</h2>
            <ul>
              <li>To prepare and deliver your order, and to contact you about it.</li>
              <li>To keep your cart and order history attached to your account.</li>
              <li>To meet our accounting and legal obligations.</li>
            </ul>

            <h2>4. Who processes it for us</h2>
            <ul>
              <li>
                <strong>Supabase</strong> — hosts our database and handles Google sign-in.
              </li>
              <li>
                <strong>Mailgun</strong> — delivers your order confirmation email.
              </li>
              <li>
                <strong>Our hosting providers</strong> — run the website and the API.
              </li>
            </ul>
            <p>
              These providers only process data on our instructions and only as far as needed to
              provide their service.
            </p>

            <h2>5. How long we keep it</h2>
            <p>
              Order records are kept for as long as we need them for accounting and warranty
              purposes. Guest carts that are never converted are retained in case you return, and
              can be cleared by emptying your cart.
            </p>

            <h2>6. Your rights</h2>
            <p>
              You can ask us for a copy of the personal data we hold about you, ask us to correct
              it, or ask us to delete it. Email{' '}
              <a href="mailto:orders@yuhmyuhm.com">orders@yuhmyuhm.com</a> and we will respond
              within a reasonable period. Note that we may need to keep order records for accounting
              purposes even after a deletion request.
            </p>

            <h2>7. Cookies and local storage</h2>
            <p>
              We use a session cookie for signed-in users, and a single local-storage entry to
              remember a guest cart id. We do not use advertising or tracking cookies.
            </p>

            <h2>8. Contact</h2>
            <p>
              Questions about this policy? Email{' '}
              <a href="mailto:orders@yuhmyuhm.com">orders@yuhmyuhm.com</a>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
