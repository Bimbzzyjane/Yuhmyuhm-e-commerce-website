import type { Metadata } from 'next';
import { OrdersView } from '@/components/OrdersView';

export const metadata: Metadata = {
  title: 'Your orders',
  description: 'Track the orders you have placed with Yuhmyuhm Catering Services.',
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <p className="eyebrow">Your account</p>
          <h1 className="page-head__title">Your orders</h1>
          <p className="page-head__lead">
            Every order you place while signed in appears here, with its reference and status.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <OrdersView />
        </div>
      </section>
    </>
  );
}
