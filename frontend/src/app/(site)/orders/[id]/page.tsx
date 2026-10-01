import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderDetailView } from '@/components/OrderDetailView';

export const metadata: Metadata = {
  title: 'Order details',
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <div className="page-head">
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/orders">Your orders</Link>
            <span className="breadcrumb__sep" aria-hidden="true">
              /
            </span>
            <span>Order details</span>
          </nav>
          <h1 className="page-head__title">Order details</h1>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <OrderDetailView orderId={id} />
        </div>
      </section>
    </>
  );
}
