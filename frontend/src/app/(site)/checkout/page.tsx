import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutView } from '@/components/CheckoutView';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Confirm your delivery details and place your Yuhmyuhm order.',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/cart">Cart</Link>
            <span className="breadcrumb__sep" aria-hidden="true">
              /
            </span>
            <span>Checkout</span>
          </nav>
          <h1 className="page-head__title">Checkout</h1>
          <p className="page-head__lead">
            No account needed — we just need to know where to deliver.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <CheckoutView />
        </div>
      </section>
    </>
  );
}
