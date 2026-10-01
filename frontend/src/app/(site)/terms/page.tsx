import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms on which Yuhmyuhm Catering Services accepts and fulfils orders.',
  alternates: { canonical: '/terms' },
};

/**
 * NOTE FOR THE TEAM: this is a reasonable, readable starting point, not legal
 * advice. Have a lawyer review it — particularly the cancellation windows and
 * the limitation of liability — before you rely on it.
 */
export default function TermsPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <p className="eyebrow">Legal</p>
          <h1 className="page-head__title">Terms of Service</h1>
          <p className="page-head__lead">
            The rules that apply when you place an order with Yuhmyuhm Catering Services.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="prose">
            <h2>1. About these terms</h2>
            <p>
              These terms govern your use of this website and any order you place through it. By
              placing an order you accept them.
            </p>

            <h2>2. Products and pricing</h2>
            <ul>
              <li>
                Prices are shown in Nigerian Naira (₦) and include applicable taxes unless stated
                otherwise.
              </li>
              <li>
                Every total is calculated by our server from the current catalogue at the moment you
                place your order. A price shown in your browser is never authoritative.
              </li>
              <li>
                Cakes are made to order, so small variation in decoration is normal and not a
                defect.
              </li>
              <li>
                We may correct an obvious pricing error before an order is confirmed and will
                contact you if that happens.
              </li>
            </ul>

            <h2>3. Orders and payment</h2>
            <ul>
              <li>
                Placing an order creates a request; it is confirmed once we have acknowledged it and
                arranged payment with you.
              </li>
              <li>
                No card details are collected on this website. Payment is taken directly with our
                team.
              </li>
              <li>
                If an item becomes unavailable in the quantity you ordered we will offer an
                alternative or a full refund for that item.
              </li>
              <li>
                Once confirmed, a cake order may be cancelled up to 48 hours before your delivery
                date. Later cancellations may not be refundable because production has started.
              </li>
            </ul>

            <h2>4. Delivery</h2>
            <ul>
              <li>Delivery is same-day across Lagos; free on orders over ₦150,000.</li>
              <li>
                Someone must be available at the delivery address at the agreed time. A failed
                delivery may incur a re-delivery charge.
              </li>
              <li>
                Risk passes to you on delivery. Please check your order and tell us about any
                problem on the day.
              </li>
            </ul>

            <h2>5. Your account</h2>
            <p>
              You are responsible for keeping access to your Google account secure. Orders placed
              while signed in are treated as having been placed by you.
            </p>

            <h2>6. Acceptable use</h2>
            <p>
              Do not attempt to interfere with the site, scrape it at scale, or submit false orders.
              We may suspend access if we reasonably believe the site is being misused.
            </p>

            <h2>7. Liability</h2>
            <p>
              We are responsible for the products we supply and for delivering them with reasonable
              care. We are not liable for indirect or consequential losses. Nothing in these terms
              limits liability that cannot lawfully be limited.
            </p>

            <h2>8. Changes</h2>
            <p>
              We may update these terms; the version in force is the one published when you place
              your order.
            </p>

            <h2>9. Contact</h2>
            <p>
              Questions about an order? Email{' '}
              <a href="mailto:orders@yuhmyuhm.com">orders@yuhmyuhm.com</a> quoting your order
              reference.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
