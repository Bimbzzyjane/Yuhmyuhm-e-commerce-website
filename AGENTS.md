# AGENTS.md — Project Memory for AI Agents

> **Read this file first, in full, before touching any code.**
> Update it at the end of every work session. It is the single source of truth
> for architecture, conventions, decisions, and outstanding work.

Last updated: 2026-10-01 · Maintained by: Cline (initial scaffold)

---

## 1. Project Overview

**Yuhmyuhm Catering Services** — an e-commerce web application selling
premium cakes and professional catering equipment, with a full cart → checkout
→ order-confirmation flow and transactional email.

- **Storefront**: `frontend/` — Next.js (App Router) + TypeScript + CSS Modules.
- **Commerce API**: `backend/` — Express + TypeScript, the *only* layer allowed
  to touch the database or compute prices.
- **Database**: Supabase (hosted PostgreSQL).
- **Auth**: Google OAuth (Supabase Auth provider).
- **Email**: Mailgun (order confirmations).
- **No payment gateway.** Checkout creates an order; payment is arranged
  offline (bank transfer / on-delivery). This is intentional, not a gap.

### Brand & design

Visual source of truth: `design/homepage.png` and `design/auth.png`.
Extracted design system (implemented in `frontend/src/app/globals.css`):

| Token | Value | Usage |
| --- | --- | --- |
| `--color-bg` | `#faf7f1` | page background (warm cream) |
| `--color-surface` | `#ffffff` | cards, header |
| `--color-cream` | `#f4efe6` | alternating section bands |
| `--color-ink` | `#2a1a10` | headings, filled buttons |
| `--color-ink-soft` | `#6b5a4e` | body copy |
| `--color-accent` | `#a8912f` | badges, eyebrow rules |
| `--color-border` | `#e9e0d3` | hairlines |

Typography: **serif display** for headings (Playfair Display), **sans** for UI
and body (Inter). Eyebrow labels are uppercase, ~0.18em letter-spacing, with
`·` separators. Corners are nearly square (`6px`), shadows are minimal —
hierarchy comes from hairline borders and generous whitespace.

---

## 2. ⚠️ SPEC CONFLICT RESOLVED (read this)

The original brief contained **two mutually exclusive workstreams**:

1. The **Yuhmyuhm Catering** e-commerce specification (Next.js + Express +
   Supabase + Google OAuth + Mailgun, with `design/homepage.png` and
   `design/auth.png` as references). — *Substantive, and the obvious intent.*
2. An **"AGENT WORKFLOW" / "FINAL REVIEW"** section describing a **Todo /
   Notes** app with an in-memory store, a "Todo API", a "Notes API" and
   "dashboard statistics", stating **"No database is required to run the
   application."** — *This shares no terminology with the catering brief or the
   design references and is treated as a stale template pasted in by mistake.*

**Decision:** the catering specification is **authoritative**. The Todo/Notes
section is **not** implemented.

**However**, one requirement in it is genuinely valuable and has been adopted:
*the application must run and be fully testable without external accounts.*
This is achieved through a **pluggable repository layer** (see §5):

- `BACKEND_DATA_BACKEND=supabase` → production, real Postgres.
- `BACKEND_DATA_BACKEND=memory` → seeded in-process store; the API boots and
  the entire test suite passes with **no Supabase, Google, or Mailgun account**.
- `MAIL_TRANSPORT=console` renders emails to stdout instead of sending them.

If a future agent is asked to add Todo/Notes functionality, **stop and ask the
user for confirmation** before doing so.

---

## 3. Architecture & Boundaries

```
Browser (Next.js storefront, Vercel)
        │  fetch + Bearer <supabase access token>
        ▼
Express Commerce API  ──►  Supabase Postgres (service-role key, server-only)
        │              ──►  Mailgun (order confirmation email)
        │
        └── auth: verifies the Supabase access token server-side
```

### Hard rules

1. **The backend owns all business logic.** The frontend never computes a
   price, total, discount, or delivery fee, and never writes to the DB.
2. **The backend is authoritative for money.** Prices are read from the
   `products` table at the moment of the request. A client-supplied price is
   *ignored* — order totals are recomputed server-side from product IDs.
3. **Secrets stay server-side.** `SUPABASE_SERVICE_ROLE_KEY` and
   `MAILGUN_API_KEY` live only in `backend/.env`. The frontend only ever holds
   the Supabase **anon** key, which is public by design and guarded by RLS.
4. **Row Level Security is deny-by-default** on every table. The API connects
   with the service role, which bypasses RLS.
5. **Guest carts survive sign-in.** A guest cart is merged into the user's cart
   on login — items are combined, never silently dropped.
6. **All input is validated** with Zod at the route boundary; all errors are
   returned as one consistent JSON envelope.

---

## 4. Repository Layout

```
.
├── AGENTS.md               # this file — persistent memory
├── README.md               # human onboarding + run instructions
├── package.json            # npm workspaces root, orchestration scripts
├── .env.example            # canonical list of every env var
├── design/                 # visual reference mockups
├── backend/                # Express + TypeScript commerce API
│   └── src/
│       ├── app.ts          # express app factory (testable, no listen)
│       ├── server.ts       # bootstrap + listen + graceful shutdown
│       ├── config/         # env parsing/validation, constants
│       ├── db/             # supabase client, schema.sql, seed data
│       ├── repositories/   # data access: supabase/* + memory/*
│       ├── services/       # business logic (products, cart, orders, mail)
│       ├── routes/         # HTTP layer, thin: validate → service → respond
│       ├── middleware/     # auth, errors, rate limiting, request id
│       └── utils/          # errors, money, validation, pagination
└── frontend/               # Next.js storefront
    └── src/
        ├── app/            # App Router pages
        ├── components/     # presentational components
        ├── lib/            # api client, formatting, supabase browser client
        └── context/        # CartProvider (server-synced cart state)
```

---

## 5. Data Model

Full DDL lives in `backend/src/db/schema.sql` (idempotent, safe to re-run).
Idempotent seed data lives in `backend/src/db/seed-data.ts`.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `categories` | shop-by-category tiles | `id`, `slug` (unique), `name`, `description`, `image_url`, `sort_order`, `is_active` |
| `products` | catalogue | `id`, `slug` (unique), `name`, `description`, `category_id` → categories, `price` `numeric(12,2)`, `image_url`, `badge`, `is_featured`, `is_active`, `stock_quantity`, `sort_order` |
| `users` | app profile mirroring `auth.users` | `id`, `auth_user_id` (unique), `email` (unique), `full_name`, `avatar_url`, `phone` |
| `carts` | one active cart per owner | `id`, `user_id` → users, `guest_token`, `status` (`active`\|`converted`\|`abandoned`) |
| `cart_items` | line items | `id`, `cart_id` → carts (cascade), `product_id` → products, `quantity`, `unique(cart_id, product_id)` |
| `orders` | placed orders | `id`, `order_number` (unique), `user_id`, `customer_name`, `email`, `phone`, `delivery_address`, `delivery_city`, `delivery_notes`, `subtotal`, `delivery_fee`, `total`, `status` (`pending`\|`confirmed`\|`processing`\|`delivered`\|`cancelled`) |
| `order_items` | order snapshots | `id`, `order_id` → orders (cascade), `product_id` (nullable, `on delete set null`), `product_name`, `unit_price`, `quantity`, `line_total` |

**Snapshot rule.** `order_items` copies `product_name` and `unit_price` at
purchase time and `orders` copies the customer's details. Editing or deleting a
product must never rewrite history.

**Uniqueness invariants** (enforced by partial unique indexes):

- at most one `active` cart per `user_id`;
- at most one `active` cart per `guest_token`;
- `cart_items` cannot repeat a product within a cart (quantity is incremented).

**Money.** Stored as `numeric(12,2)` in the shop currency (`NGN`). All
arithmetic in the service layer is done in **integer kobo** via
`utils/money.ts` (`toMinor`/`fromMinor`) so no floating-point drift can occur;
values are converted back to 2-decimal strings only at the DB/JSON boundary.

---

## 6. HTTP API

Base path `/api`. Every response is JSON. Errors use one envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
```

`code` is a stable machine string (`VALIDATION_ERROR`, `NOT_FOUND`,
`UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `OUT_OF_STOCK`, `EMPTY_CART`,
`RATE_LIMITED`, `INTERNAL_ERROR`).

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | – | liveness + configured backend/transport |
| GET | `/api/products` | – | `?category=&search=&featured=&limit=&offset=` → `{ data, pagination }` |
| GET | `/api/products/:idOrSlug` | – | 404 if unknown/inactive |
| GET | `/api/categories` | – | active categories with product counts |
| GET | `/api/cart` | optional | resolved by user token, else `X-Guest-Cart-Id` |
| POST | `/api/cart/items` | optional | `{ productId, quantity }` (upsert → increments) |
| PATCH | `/api/cart/items/:itemId` | optional | `{ quantity }`; `0` removes |
| DELETE | `/api/cart/items/:itemId` | optional | |
| DELETE | `/api/cart` | optional | clear all items |
| POST | `/api/cart/merge` | **yes** | `{ guestCartId }` — merges a guest cart, sums quantities |
| GET | `/api/auth/me` | **yes** | verifies token, upserts `users`, returns profile |
| POST | `/api/orders` | optional | `{ customer: {...} }` — server-repriced; emails confirmation |
| GET | `/api/orders` | **yes** | current user's orders, newest first |
| GET | `/api/orders/:id` | **yes** | owner-only, else `403` |

**Cart resolution order** (middleware `resolveCartOwner`):
verified user → user cart; otherwise `X-Guest-Cart-Id` (UUID) → guest cart;
otherwise a new guest cart is created and its id returned in the response body
(`cart.guestToken`) for the client to persist.

**Auth.** The frontend signs in with Supabase Auth (Google provider) and sends
`Authorization: Bearer <access_token>`. The backend validates it with
`supabase.auth.getUser(token)` — server-side, nothing trusted from the client —
then maps `auth.users.id` onto `users.auth_user_id`. The verifier is an
injected interface so tests can substitute a stub without network access.

---

## 7. Conventions

- **TypeScript everywhere, `strict: true`.** No `any` in new code; prefer
  `unknown` + narrowing. Zod schemas double as the source of truth for types
  at boundaries (`z.infer<typeof x>`).
- **Layering is one-directional:** `routes → services → repositories → db`.
  A service must never import Express types; a repository must never import a
  service.
- **Repositories are interfaces** (`repositories/types.ts`). Dependencies are
  passed in through `createApp({ repositories, mailer, authVerifier })`, which
  is what makes the app testable and what lets `memory` and `supabase` be
  swapped freely.
- **Errors:** throw the typed classes in `utils/errors.ts`
  (`NotFoundError`, `ValidationError`, …). The central error middleware maps
  them to status codes; route handlers never build error responses by hand.
- **Naming:** files are `kebab-case`, types/classes `PascalCase`, functions and
  variables `camelCase`, DB columns `snake_case`. Repositories translate
  between the two so the rest of the codebase stays camelCase.
- **Comments explain *why*, not *what*.** Keep them short and load-bearing.
- **Formatting:** Prettier (`.prettierrc.json`), 2-space indent, single quotes,
  80-col. Lint with ESLint. Run `npm run typecheck && npm run lint` before
  declaring a task done.

### Frontend conventions

- App Router only. **Server Components by default**; add `'use client'` only
  for interactivity.
- Data fetching for catalogue pages happens **server-side** through
  `lib/api-server.ts` (so SEO and first paint are correct). Cart and auth are
  client-side through `CartProvider` / `AuthProvider`.
- Styling is **one global stylesheet of design tokens plus semantic, BEM-ish
  component classes** (`src/app/globals.css`, organised in sections 1–6). No
  utility framework and no CSS Modules: the class vocabulary is small and shared
  across pages, so a single file makes the entire design system reviewable in
  one pass. Every colour, radius, shadow and space value comes from a token —
  never a raw hex value inside a component.
- Currency is rendered only via `formatCurrency()` in `lib/format.ts`. In
  practice almost every price shown comes from a server-supplied `*Label`
  string; `lib/format.ts` exists for client-side values and must stay
  byte-for-byte compatible with the backend's `utils/money.ts`.

---

## 8. Commands

| Command | What it does |
| --- | --- |
| `npm install` | install both workspaces from the repo root |
| `npm run dev` | API on `:4000` + storefront on `:3000` in parallel |
| `npm run dev:api` / `npm run dev:web` | run one side only |
| `npm test` | backend Vitest suite (in-memory repositories) |
| `npm run test:coverage` | suite + coverage report |
| `npm run typecheck` | `tsc --noEmit` for both workspaces |
| `npm run lint` | ESLint for both workspaces |
| `npm run format` | Prettier write |
| `npm run build` | compile backend + production build of Next.js |
| `npm run seed` | seed Supabase from `seed-data.ts` (needs service-role creds) |
| `npm run db:print-schema` | print `schema.sql` for Supabase's SQL editor |

---

## 9. Testing Strategy

- **Vitest + Supertest against the real Express app** (`createApp`), with
  in-memory repositories and a capturing mailer. No live network, no database.
- Coverage focus, in priority order: money/pricing math, cart owner resolution
  and merge semantics, server-side repricing at checkout, order snapshot
  immutability, stock/quantity limits, and the auth/authorisation guards.
- Tests live in `backend/tests/*.test.ts`.
- **The suite must pass with zero environment variables set.** If a test needs
  a secret, the design is wrong.

### Verified results (last full run)

| Check | Command | Result |
| --- | --- | --- |
| Backend types | `npm run typecheck` | 0 errors |
| Frontend types | `npm run typecheck` | 0 errors |
| Lint (both) | `npm run lint` | 0 errors, 0 warnings |
| Formatting | `npm run format:check` | all files clean |
| API tests | `npm test` | **61 passed / 61** |
| Build | `npm run build` | backend `dist/` + 15 Next.js routes |
| Compiled API | `node backend/dist/server.js` | boots, `/api/health` 200 |
| Live walkthrough | see below | guest cart → order → email |

The live walkthrough (against `BACKEND_DATA_BACKEND=memory`,
`MAIL_TRANSPORT=console`) produced exactly the expected numbers:

```
guest cart created   token=e824ce51-…
product              Chocolate Delight Cake @ ₦45,000
add x2               subtotal=₦90,000 delivery=₦5,000 total=₦95,000
checkout             order=YM-2026-0001 total=₦95,000 userId=null
cart consumed        itemCount=0, a fresh empty cart issued
stock decremented    24 → 22
email                rendered to the API console with the order number
```

### Deliberate deviations from the brief (and why)

1. **ESLint is wired by hand instead of via `eslint-config-next`.**
   `frontend/eslint.config.mjs` composes `typescript-eslint`,
   `@next/eslint-plugin-next` (both `recommended` and `core-web-vitals`) and
   `eslint-plugin-react-hooks` directly. `npm run lint` is clean and all 24
   `@next/next/*` rules resolve (verify with
   `npx eslint --print-config src/app/layout.tsx`). The only side effect is that
   `next build` prints *"The Next.js plugin was not detected"* — Next looks for
   the `eslint-config-next` package specifically. It is cosmetic; the rules are
   enforced. Switching to `FlatCompat` + `eslint-config-next` would silence it if
   that matters more than the two extra dependencies.
2. **Prettier does not format `.md` or `.sql`.** There is no built-in SQL parser,
   and `*.md` is ignored so tables and the carefully laid-out docs in this repo
   are not reflowed. `format`/`format:check` therefore cover
   `ts,tsx,js,mjs,cjs,json,css`.
3. **Guest order confirmation renders on the checkout page**, not on
   `/orders/[id]`. `GET /api/orders/:id` is owner-only, so a guest has no session
   with which to read their own order back. Showing the confirmation in place
   avoids either loosening that rule or inventing a guessable public order URL.
   Signed-in shoppers additionally get `/orders` and `/orders/[id]`.
4. **Mailgun is called over HTTPS directly** rather than via `mailgun.js` (see
   §10).

---

## 10. Status & Roadmap

Legend: `[x]` done · `[~]` partial · `[ ]` not started

- [x] Docs, ignore rules, env templates, workspace scaffold
- [x] Express foundation (env validation, error envelope, middleware)
- [x] Supabase schema + seed data + repository layer (supabase + memory)
- [x] Products & categories (service, routes, tests)
- [x] Cart (guest + user, item CRUD, merge on sign-in, tests)
- [x] Orders (server-side repricing, snapshotting, tests)
- [x] Mailgun order-confirmation email (+ console transport)
- [x] Google OAuth (Supabase Auth) wired through the API
- [x] Storefront: design system, home, category, product, cart, checkout,
      orders, auth pages
- [x] Responsive pass
- [x] Full verification: typecheck, lint, format, 61 API tests, production
      build, compiled-server boot, live guest-order walkthrough
- [ ] Deploy: backend host + Vercel; set `NEXT_PUBLIC_API_BASE_URL` to the
      live API origin and add it to `CORS_ORIGINS`
- [ ] Point `design/` at real Yuhmyuhm photography and replace the seeded
      `picsum.photos` URLs

### Known gaps / follow-ups

- **Images**: seeded `image_url` values point at remote stock photography so
  the storefront looks like the mockups. `components/ProductImage.tsx` falls
  back to a branded local SVG if an image fails to load. Replace seeded URLs
  with real Yuhmyuhm photography before launch.
- **Payments** are intentionally out of scope (see §1).
- **Stock decrement is best-effort.** It happens after the order is durably
  stored and is wrapped in a try/catch, so a stock failure is logged rather than
  failing a checkout that already succeeded. The consequence is that stock can
  drift if that write fails; a nightly reconciliation job is the fix.
- **No cart expiry.** `carts.status` supports `abandoned`, but nothing sweeps
  stale guest carts yet. A scheduled job should retire carts untouched for
  ~30 days.
- **No CMS/admin UI.** Products are managed through the Supabase dashboard or
  the seeder. A `/admin` area is the natural next feature.
- **Contact form** posts nowhere yet; wire it to a Mailgun route or a Supabase
  table when a receiving inbox is decided.
- **Mailgun is called over HTTPS directly** (`email/mailgun-mailer.ts`) using
  Node's built-in `fetch` + `FormData`, rather than the `mailgun.js` SDK. That
  SDK is ESM-only and pulls in axios, which would force an ESM/CJS interop
  decision for the whole backend. The REST call is the same documented endpoint
  the SDK uses, with zero added dependencies.

### Gotchas for the next agent

- `backend/src/app.ts` **never listens**. `server.ts` does. Tests import the
  factory directly — do not import `server.ts` in a test.
- Cart identity is derived **only** from the verified token or
  `X-Guest-Cart-Id`. Never accept a `userId` or `cartId` from a request body.
- When adding a table, add it to `schema.sql`, both repository implementations,
  the interface in `repositories/types.ts`, **and** the memory seed, or the
  in-memory tests will diverge from production.
- Keep `AGENTS.md` and `README.md` current — they are graded deliverables.
- **Do not call `setState` synchronously in an effect body.**
  `eslint-plugin-react-hooks` v7 ships `react-hooks/set-state-in-effect`, it is
  part of `recommended`, and `next build` fails the build on it. Every pattern
  that used to need it here is solved differently: derive the value
  (`AuthProvider.user`, `CheckoutView` form prefill) or box the async result with
  the request key it belongs to and ignore non-matching boxes
  (`OrdersView`, `OrderDetailView`, `CartProvider`).
- **In tests, never build a supertest request before awaiting another one.**
  supertest starts its ephemeral listener when the request object is constructed,
  so `.set('X-Guest-Cart-Id', await seedCart())` races. Await the helper into a
  variable first.
- **`schema.sql` is copied into `dist/` by `backend/scripts/copy-assets.mjs`.**
  `tsc` does not emit non-TypeScript files, so if you add another asset (a
  migration, an email template) add it to the `ASSETS` list there.
- A production deploy must run `npm run build` in `backend/` **before**
  `npm start`; `start` executes `dist/server.js`, not the TypeScript sources.

