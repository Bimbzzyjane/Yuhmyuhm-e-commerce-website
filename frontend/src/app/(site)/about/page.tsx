import type { Metadata } from 'next';
import Link from 'next/link';
import { AwardIcon, LeafIcon, TruckIcon } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'About us',
  description:
    'Yuhmyuhm Catering Services bakes celebration cakes and supplies professional catering equipment, baking supplies and event essentials.',
  alternates: { canonical: '/about' },
};

const VALUES = [
  {
    Icon: LeafIcon,
    title: 'Made fresh, never stockpiled',
    body: 'Cakes are baked to order. If it is on the site, we can make it for your date.',
  },
  {
    Icon: AwardIcon,
    title: 'The kit we actually use',
    body: 'Every piece of equipment on this site is something our own kitchen runs on, so we only stock what we would buy again.',
  },
  {
    Icon: TruckIcon,
    title: 'Delivered and set up',
    body: 'Same-day delivery across Lagos, with on-site setup for larger events and multiple-course service.',
  },
];

export default function AboutPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <p className="eyebrow">About us</p>
          <h1 className="page-head__title">Fresh · Delicious · Memorable</h1>
          <p className="page-head__lead">
            Yuhmyuhm started as a small cake kitchen in Lagos and grew into a full catering supply
            business — because the same customers who ordered our cakes kept asking where we got our
            equipment.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="prose">
            <h2>What we do</h2>
            <p>
              We bake celebration cakes to order and supply the professional equipment, baking
              supplies and event essentials that keep a catering team moving. Everything we stock
              has been through our own kitchen first.
            </p>

            <h2>How ordering works</h2>
            <ul>
              <li>Add what you need to your cart — it is saved whether or not you sign in.</li>
              <li>Sign in with Google at any point and we merge your guest cart automatically.</li>
              <li>
                Checkout asks only for your contact and delivery details. No price is ever sent from
                your browser: our server recalculates every total from the live catalogue.
              </li>
              <li>
                We email you a confirmation with your order reference, then call to arrange delivery
                and payment.
              </li>
            </ul>

            <h2>Delivery and payment</h2>
            <p>
              Delivery is same-day across Lagos and free on orders over ₦150,000. Payment is
              arranged directly with our team after your order is confirmed — we do not take card
              details on this site.
            </p>
          </div>

          <ul className="grid grid--3" style={{ marginTop: 'var(--space-7)' }}>
            {VALUES.map(({ Icon, title, body }) => (
              <li className="product-card" key={title}>
                <div className="product-card__body">
                  <span className="trust__icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h2 className="trust__title" style={{ marginTop: 'var(--space-3)' }}>
                    {title}
                  </h2>
                  <p className="trust__body">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="section-actions">
            <Link href="/search" className="btn">
              Browse the catalogue
            </Link>
            <Link href="/contact" className="btn btn--outline">
              Talk to our team
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
