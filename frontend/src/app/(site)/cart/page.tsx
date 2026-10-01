import type { Metadata } from 'next';
import { CartView } from '@/components/CartView';

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review the cakes and catering equipment in your Yuhmyuhm basket.',
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <p className="eyebrow">Your basket</p>
          <h1 className="page-head__title">Shopping cart</h1>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <CartView />
        </div>
      </section>
    </>
  );
}
