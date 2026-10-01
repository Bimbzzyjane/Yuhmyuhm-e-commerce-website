'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { BagIcon, ChefHatIcon, SearchIcon, UserIcon } from './Icons';

/**
 * Site header — logo, centred nav, and the search / account / cart actions
 * from the design mockup.
 *
 * A client component because the cart badge and the signed-in avatar are live
 * state. Everything else is static markup.
 */

const NAV_LINKS = [
  { href: '/', label: 'Home', exact: true },
  { href: '/category/cakes', label: 'Cakes' },
  { href: '/category/catering-equipment', label: 'Equipment' },
  { href: '/orders', label: 'Orders' },
] as const;

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { user, configured, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="header">
      <div className="container header__inner">
        <Link href="/" className="header__logo" aria-label="Yuhmyuhm Catering Services — home">
          <span className="header__logo-mark" aria-hidden="true">
            <ChefHatIcon size={22} />
          </span>
          <span className="header__logo-text">
            <span className="header__logo-name">Yuhmyuhm</span>
            <span className="header__logo-tag">Catering Services</span>
          </span>
        </Link>

        <nav className="header__nav" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive(pathname, link.href, 'exact' in link ? link.exact : false)
                  ? 'header__link header__link--active'
                  : 'header__link'
              }
              aria-current={
                isActive(pathname, link.href, 'exact' in link ? link.exact : false)
                  ? 'page'
                  : undefined
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header__actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSearchOpen((open) => !open)}
            aria-expanded={searchOpen}
            aria-label="Search the shop"
          >
            <SearchIcon size={20} />
          </button>

          {user ? (
            <div className="header__account">
              <Link href="/orders" className="header__account-link" aria-label="Your orders">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    width={34}
                    height={34}
                    className="header__avatar"
                    unoptimized
                  />
                ) : (
                  <span className="icon-btn" aria-hidden="true">
                    <UserIcon size={20} />
                  </span>
                )}
              </Link>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/auth/signin"
              className="icon-btn"
              aria-label={configured ? 'Sign in' : 'Sign in (not configured)'}
            >
              <UserIcon size={20} />
            </Link>
          )}

          <Link href="/cart" className="icon-btn" aria-label={`Cart, ${itemCount} item(s)`}>
            <BagIcon size={20} />
            {itemCount > 0 ? (
              <span className="icon-btn__badge" aria-hidden="true">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {searchOpen ? (
        <div className="header__searchbar">
          <div className="container">
            <form role="search" action="/search" method="get" className="header__searchform">
              <label htmlFor="site-search" className="sr-only">
                Search products
              </label>
              <input
                id="site-search"
                className="input"
                type="search"
                name="q"
                placeholder="Search for cakes, equipment or supplies…"
                autoFocus
              />
              <button type="submit" className="btn">
                Search
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* On narrow screens the nav moves below the bar and scrolls sideways. */}
      <nav className="header__nav--collapsed" aria-label="Main (compact)">
        {NAV_LINKS.map((link) => (
          <Link key={`compact-${link.href}`} href={link.href} className="header__link">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
