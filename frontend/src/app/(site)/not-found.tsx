import Link from 'next/link';
import { SearchIcon } from '@/components/Icons';

/**
 * 404 inside the storefront (so it still has the header and footer).
 */
export default function SiteNotFound() {
  return (
    <section className="section">
      <div className="container">
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            <SearchIcon size={28} />
          </span>
          <h1 className="empty__title">We could not find that page</h1>
          <p className="empty__body">
            The page you were looking for may have moved, or the product might no longer be
            available.
          </p>
          <div className="section-actions">
            <Link href="/" className="btn">
              Back to home
            </Link>
            <Link href="/search" className="btn btn--outline">
              Browse the catalogue
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
