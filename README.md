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
git clone <your-repo-url>
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

### 4. Mailgun

Add your API key and sending domain to `backend/.env` and switch transport:

```env
MAIL_TRANSPORT=mailgun
MAILGUN_API_KEY=key-...
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=orders@yourdomain.com
```

Domains on the EU region also need
`MAILGUN_API_BASE=https://api.eu.mailgun.net`.

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

Finally add the deployed storefront origin to `CORS_ORIGINS` on the API.

---

## License

Proprietary — © Yuhmyuhm Catering Services.
