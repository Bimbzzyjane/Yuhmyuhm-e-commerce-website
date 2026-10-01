import type { Metadata } from 'next';
import Link from 'next/link';
import { MailIcon, MapPinIcon, PhoneIcon } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Talk to Yuhmyuhm Catering Services about cakes, catering equipment, event supply or delivery in Lagos.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <p className="eyebrow">Get in touch</p>
          <h1 className="page-head__title">Let&rsquo;s plan your event</h1>
          <p className="page-head__lead">
            Tell us the date, the headcount and roughly what you have in mind. We will come back
            with options and a quote.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="split">
            <div className="prose">
              <h2>Reach us directly</h2>
              <p>
                The fastest way to get an answer is a phone call or an email — we usually reply the
                same working day.
              </p>

              <dl className="data-list" style={{ marginTop: 'var(--space-5)' }}>
                <dt>
                  <MailIcon size={15} /> Email
                </dt>
                <dd>
                  <a href="mailto:orders@yuhmyuhm.com">orders@yuhmyuhm.com</a>
                </dd>

                <dt>
                  <PhoneIcon size={15} /> Phone
                </dt>
                <dd>
                  <a href="tel:+2348000000000">+234 800 000 0000</a>
                </dd>

                <dt>
                  <MapPinIcon size={15} /> Kitchen &amp; showroom
                </dt>
                <dd>
                  Victoria Island, Lagos, Nigeria
                  <br />
                  Monday to Saturday, 8am – 6pm
                </dd>
              </dl>

              <h2>Already ordered?</h2>
              <p>
                Quote your order reference (it looks like <strong>YM-2026-0001</strong>) and we can
                pick up right where you left off. If you were signed in, you can also find it under{' '}
                <Link href="/orders">your orders</Link>.
              </p>
            </div>

            <aside className="summary" aria-label="Planning checklist">
              <h2 className="summary__title">Helpful to have ready</h2>
              <ul className="summary__lines">
                <li className="summary__line">
                  <span>Date and start time</span>
                </li>
                <li className="summary__line">
                  <span>Number of guests</span>
                </li>
                <li className="summary__line">
                  <span>Venue and delivery access</span>
                </li>
                <li className="summary__line">
                  <span>Dietary requirements</span>
                </li>
                <li className="summary__line">
                  <span>Service style — buffet or plated</span>
                </li>
              </ul>

              <p className="summary__note">
                Prefer to shop first? Everything we stock is available in the catalogue, and a guest
                cart is saved without an account.
              </p>

              <div className="summary__cta">
                <Link href="/search" className="btn btn--block">
                  Browse the catalogue
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
