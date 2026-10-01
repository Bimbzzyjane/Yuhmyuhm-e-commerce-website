import Link from 'next/link';
import './globals.css';

/**
 * Root 404 — used for URLs that match no route at all.
 *
 * The storefront's own `not-found` (inside the `(site)` group) handles
 * `notFound()` calls from pages and includes the header and footer.
 */
export default function RootNotFound() {
  return (
    <main className="container section">
      <div className="empty">
        <h1 className="empty__title">Page not found</h1>
        <p className="empty__body">That address does not exist on Yuhmyuhm Catering Services.</p>
        <div className="section-actions">
          <Link href="/" className="btn">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
