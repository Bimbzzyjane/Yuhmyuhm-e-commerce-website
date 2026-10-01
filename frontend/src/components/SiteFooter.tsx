import Link from 'next/link';
import {
  ChefHatIcon,
  FacebookIcon,
  InstagramIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  TwitterIcon,
} from './Icons';

/**
 * Site footer — four columns on cream, matching the mockup, with the social
 * row and the copyright bar.
 */

const SHOP_LINKS = [
  { href: '/category/cakes', label: 'Cakes' },
  { href: '/category/catering-equipment', label: 'Catering Equipment' },
  { href: '/category/baking-supplies', label: 'Baking Supplies' },
  { href: '/category/event-essentials', label: 'Event Essentials' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
  { href: '/orders', label: 'Track an Order' },
  { href: '/cart', label: 'Your Cart' },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__about">
            <span className="header__logo">
              <span className="header__logo-mark" aria-hidden="true">
                <ChefHatIcon size={22} />
              </span>
              <span className="header__logo-text">
                <span className="header__logo-name">Yuhmyuhm</span>
                <span className="header__logo-tag">Catering Services</span>
              </span>
            </span>
            <p>
              Fresh · Delicious · Memorable. We bake celebration cakes and supply the professional
              equipment, supplies and event essentials that keep kitchens running across Lagos and
              beyond.
            </p>
            <div className="footer__social">
              <a className="icon-btn" href="https://instagram.com" aria-label="Instagram">
                <InstagramIcon size={18} />
              </a>
              <a className="icon-btn" href="https://facebook.com" aria-label="Facebook">
                <FacebookIcon size={18} />
              </a>
              <a className="icon-btn" href="https://x.com" aria-label="X">
                <TwitterIcon size={18} />
              </a>
            </div>
          </div>

          <div>
            <h2 className="footer__heading">Shop</h2>
            <ul className="footer__list">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="footer__heading">Company</h2>
            <ul className="footer__list">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="footer__heading">Get in touch</h2>
            <ul className="footer__list">
              <li>
                <a href="mailto:orders@yuhmyuhm.com">
                  <MailIcon size={16} /> orders@yuhmyuhm.com
                </a>
              </li>
              <li>
                <a href="tel:+2348000000000">
                  <PhoneIcon size={16} /> +234 800 000 0000
                </a>
              </li>
              <li>
                <span>
                  <MapPinIcon size={16} /> Victoria Island, Lagos, Nigeria
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {year} Yuhmyuhm Catering Services. All rights reserved.</span>
          <span className="footer__legal">
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
