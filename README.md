# Yuhmyuhm Catering Services

A full e-commerce storefront for premium cakes and professional catering
equipment — Next.js + Express + Supabase, with persistent carts, a
server-authoritative checkout, and Mailgun order confirmations.

> Looking for architecture, conventions, and the decision log?
> Read **[AGENTS.md](./AGENTS.md)**.

---

## Why this stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Storefront | Next.js (App Router) + TypeScript | UI, SEO, sessions, cart UX |
| Commerce API | Express + TypeScript | **All** pricing, cart and order logic |
| Database | Supabase (PostgreSQL) | Persistence, Row Level Security |
| Auth | Supabase Auth → Google OAuth | Identity only |
| Email | Mailgun | Order confirmations |

The API is the **only** component that talks to the database or calculates a
price. That keeps money math in one auditable place and lets the storefront
stay a pure view layer.

---

## Quick start

Requires **Node 20.9+** (developed on Node 24).

```bash
git clone git https://github.com/Bimbzzyjane/Yuhmyuhm-e-commerce-website.git
cd "E-COMMERCE WEBSITE"
npm install
```

The API ships with a seeded in-memory data backend, so **you can run the whole
app with no accounts and no `.env` at all**:

```bash
npm run dev          # API on http://localhost:4000, storefront on :3000
```

Open <http://localhost:3000>. Products, categories, cart and checkout all work
immediately; confirmation emails are printed to the API console.

### Verify everything works

```bash
npm run typecheck    # tsc --noEmit, both workspaces
npm run lint         # eslint, both workspaces
npm test             # vitest API suite
npm run build        # backend compile + production Next.js build
```

---

## Wiring up real services

### 1. Environment files

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
```

`/.env.example` at the repo root is the canonical reference for every variable.

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste the contents of `backend/src/db/schema.sql`
   (also printable with `npm run db:print-schema`) → **Run**. This creates the
   tables, indexes, `updated_at` triggers, and enables deny-by-default RLS.
3. **Project Settings → API** → copy the URL and the **service_role** key into
   `backend/.env`, then set:

   ```env
   BACKEND_DATA_BACKEND=supabase
   ```

4. Seed the catalogue:

   ```bash
   npm run seed
   ```

### 3. Google OAuth

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth
   client ID** (Web application).
2. Authorised JavaScript origin: `http://localhost:3000`
3. Authorised redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`
4. Supabase → **Authentication → Providers → Google**: enable, paste the Client
   ID and Client Secret.
5. Supabase → **Authentication → URL Configuration**: add
   `http://localhost:3000/auth/callback` to *Redirect URLs*.
6. Copy the project URL and **anon** key into `frontend/.env.local`.

### 4. Mailgun (optional — order confirmation emails)

The API boots and the whole test suite passes with **no Mailgun account**: the
default `MAIL_TRANSPORT=console` prints the email to stdout instead of sending
it. To send real mail, set these in `backend/.env`:

```env
MAIL_TRANSPORT=mailgun
MAILGUN_API_KEY=key-...
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=orders@yourdomain.com
MAILGUN_FROM_NAME=Yuhmyuhm Catering Services   # optional, this is the default
EMAIL_ORDER_NOTIFICATION_TO=orders@yourdomain.com   # optional team copy
```

All of these are read **only** from the backend environment. None of them
belong in `frontend/.env.local` — that file is inlined into the browser bundle,
and the storefront never sends mail.

**Region.** `MAILGUN_API_BASE` defaults to `https://api.mailgun.net`. Domains
on the EU region need `MAILGUN_API_BASE=https://api.eu.mailgun.net`. It is
read from config rather than hard-coded, so switching regions is a one-line
change.

**Secrets.** `MAILGUN_API_KEY` is a live credential. Put it in `backend/.env`,
which is gitignored, and nowhere else — not in `.env.example`, not in the docs,
not in the frontend. `.env.example` documents the variable with a blank value.
If a key ever leaks, revoke it in the Mailgun dashboard.

**Sandbox domains.** A Mailgun *sandbox* domain can only send to addresses
listed as authorized recipients, and each must click the activation link
Mailgun sends before mail to that address is accepted. Anyone else fails with:

```
403 Domain ... is not allowed to send: Free accounts are for test purposes only.
```

That is expected on a free plan and is **not** a bug in this app. The
confirmation is addressed to the *customer*, so on a sandbox it will only be
accepted for recipient addresses you have authorized — upgrade the plan or use a
paid domain before launch.

**Email never affects checkout.** The order is stored first and the confirmation
is sent only afterwards. A failed send is logged as
`[orders] confirmation email failed for <order number>` and the checkout still
returns `201`.

---

## Project layout

```
backend/    Express + TypeScript commerce API   (see backend/src)
frontend/   Next.js storefront                  (see frontend/src)
design/     Reference mockups used for the visual system
AGENTS.md   Architecture, conventions, decisions
```

---

## API at a glance

`GET /api/health` · `GET /api/products` · `GET /api/products/:idOrSlug` ·
`GET /api/categories` · `GET|POST|PATCH|DELETE /api/cart[…/items]` ·
`POST /api/cart/merge` · `GET /api/auth/me` · `POST|GET /api/orders`

`GET /api/health` is a liveness probe only — `status`, `service` and
`uptimeSeconds` — so it can stay public without advertising which datastore is
in use, whether email is really being sent, or the shop's prices.

Full request/response contracts, cart-resolution rules and error codes are in
[AGENTS.md §6](./AGENTS.md).

---

## Key behaviours

- **Guest carts persist.** A guest gets a cart token stored in `localStorage`;
  the API keeps the cart in the database, so it survives refreshes and closed
  tabs. Not a client-side `localStorage` cart.
- **Signing in merges, never discards.** On first authenticated load the guest
  cart is merged into the user's cart with quantities summed.
- **Prices are never trusted from the client.** Checkout re-reads every product
  price from the database and recomputes subtotal, delivery fee and total.
- **Orders are immutable snapshots.** Each line stores the product name and
  unit price as they were at purchase time.
- **Guest checkout works end to end.** A guest can buy without an account and
  sees their confirmation (with the order reference) right on the checkout page.
  Because `GET /api/orders/:id` is owner-only, a guest cannot read an order back
  later — that keeps order ids unguessable rather than turning them into a public
  lookup. Signing in gives you `/orders` and a permanent history.
- **Checkout is rate limited separately from browsing.** `POST /api/orders` gets
  a deliberately small allowance (default 5/min) while the rest of the API keeps
  a generous one (120/min). The limiter is mounted on that single route, so
  throttling the one anonymous endpoint that writes a row, moves stock and sends
  an email never affects ordinary shoppers.
- **Deny-by-default covers functions and views, not just tables.** RLS has no
  policies, and `schema.sql` additionally revokes `EXECUTE`/`SELECT` on every
  helper — `create_order_with_items`, `next_order_number`, `set_updated_at` and
  `catalogue_summary` — from `PUBLIC` *and* from `anon`/`authenticated`,
  granting them only to the API's service role. Without that, the publishable key
  could create orders or burn order numbers straight through `/rest/v1/rpc`.
  Re-run the schema after pulling: `create or replace function` re-grants to
  `PUBLIC` on every deploy.
- **Secrets never reach the browser.** The service-role and Mailgun keys exist
  only in the API process; RLS is deny-by-default as a second line of defence.

---

## Accounts & sign-in

Two ways in — **both produce the same session**, so the API, the cart and the
header behave identically afterwards:

- **Email + password** — works as soon as `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. Email authentication is enabled by
  default in every Supabase project, so there is nothing to switch on.
- **Google** — additionally needs the Google provider enabled in Supabase
  (setup step 3 below).

Signing in merges any guest cart into the account, so a shopper loses nothing by
creating an account after browsing. And if the same person later continues with
Google using the same address, the API re-links their existing profile instead
of creating a second one — their cart and order history follow them.

### Enabling Google sign-in

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client
   ID** → *Web application*.
2. **Authorised JavaScript origin:** `http://localhost:3000` (plus your Vercel
   origin in production).
3. **Authorised redirect URI:** `https://<project-ref>.supabase.co/auth/v1/callback`
4. Supabase → **Authentication → Providers → Google** → enable, then paste the
   Client ID and Client Secret.
5. Supabase → **Authentication → URL Configuration → Redirect URLs** → add
   `http://localhost:3000/auth/callback`.

> **Why the Google keys are not read from `.env`:** an OAuth client secret has
> to be held by whichever party exchanges the authorisation code — here that is
> Supabase. Storing it in the app's environment would either leave the app
> unable to complete the exchange, or move the secret somewhere that does not own
> it. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are therefore kept in the env
> files as a record of the values, with the dashboard step documented beside them.

---

## Deployment

**Frontend → Vercel.** Import the repo, set the root directory to `frontend`,
and add `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.

**Backend → Railway / Render / Fly.io.** Root directory `backend`, build
`npm run build`, start `npm start`. Set every variable from
`backend/.env.example`, with `NODE_ENV=production`,
`BACKEND_DATA_BACKEND=supabase` and `MAIL_TRANSPORT=mailgun`.

Also set **`TRUST_PROXY_HOPS` to match the host's real topology.** It is the one
variable whose wrong value silently disables rate limiting:

| Where the API runs | Value |
| --- | --- |
| `npm run dev`, or any host that reaches the API directly | `0` |
| Exactly one proxy in front (typical Vercel / Render / Railway / Fly edge) | `1` — the default |
| N chained proxies | `N` (max 10; anything larger fails at boot) |

Set it too high and a caller can forge `X-Forwarded-For` and get a fresh
rate-limit bucket on every request. Set it too low (or `0` behind a proxy) and
every visitor shares a single bucket. `POST /api/orders` carries its own tight
budget — `CHECKOUT_RATE_LIMIT_MAX_REQUESTS` per window, default **5/min** —
while browsing uses `RATE_LIMIT_MAX_REQUESTS`, default **120/min**.

Finally add the deployed storefront origin to `CORS_ORIGINS` on the API.

---

## License

Proprietary — © Yuhmyuhm Catering Services.
