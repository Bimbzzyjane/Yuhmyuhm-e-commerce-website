# Yuhmyuhm — Mobile (Android)

The Yuhmyuhm Catering Services **Android app**, built with **Expo + React Native
+ TypeScript**. It is a **standalone project**: it is deliberately *not* listed
in the repository root `package.json` `workspaces`, so it installs and builds
independently of `frontend/` and `backend/`.

> Status: **Phase 3 — core shopping experience.** Sign in with the same Supabase
> account as the website, browse the catalogue, and add/update/remove items in the
> **same server-side cart** the website uses. Checkout and orders are not
> implemented yet.

## What it reuses (and what it does not)

- Uses the **existing Express API** (`backend/`) — there is no second API.
- Uses the **same Supabase Auth project and the same server-side cart** as the
  website, so the same account and the same cart are shared across devices.
- Does **not** modify `frontend/`, `backend/`, the database schema, or any API route.

## Requirements

- Node.js **>= 20.9** (developed on Node 24)
- The existing API running (see the repository root README)

## Setup

```bash
cd mobile
npm install
cp .env.example .env      # then fill in the values
npm start                 # Expo dev server
```

`npm run android` starts the dev server and opens the Android emulator.

### Environment variables

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL of the existing Express API | No |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (same project as web) | No |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key (RLS-guarded) | No |
| `EXPO_PUBLIC_STOREFRONT_URL` | Storefront origin, used to resolve relative image paths | No |

> **Never** put a server secret in `mobile/.env`. There is no Supabase
> service-role/secret key, Mailgun credential, Google OAuth client secret or
> database connection string here, and there must never be.

### Pointing the app at the API

`localhost` on an Android device refers to the device itself, not your computer.

| Where the app runs | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:4000` |
| Physical phone (same Wi-Fi) | `http://<your-computer-LAN-IP>:4000` |
| **Preview APK / deployed API** | `https://api.yourdomain.com` |

The value is trimmed and any trailing slash is removed, so both
`https://api.yourdomain.com` and `https://api.yourdomain.com/` work. It is never
hard-coded in TypeScript — it always comes from `EXPO_PUBLIC_API_URL`, and a
missing or scheme-less value produces a readable message instead of an opaque
network failure.

For a physical phone over the LAN, allow inbound TCP 4000 through the firewall and
verify `http://<LAN-IP>:4000/api/health` in the phone's browser first.

### Building the Android preview APK (physical device)

`eas.json` defines a single `preview` profile that produces an **installable
APK** (`android.buildType: "apk"`, `distribution: "internal"`) using the existing
Android package `com.yuhmyuhm.catering`. There is deliberately no production
profile yet.

```bash
npx eas-cli login

# 1. Local .env is gitignored and is NOT uploaded to EAS Build, so the values
#    must be set as EAS environment variables in the `preview` environment.
npx eas-cli env:create --name EXPO_PUBLIC_API_URL           --value https://api.yourdomain.com            --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL      --value https://<ref>.supabase.co              --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <publishable key>                      --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_STOREFRONT_URL  --value https://your-storefront.vercel.app      --environment preview --visibility plaintext

# 2. Build the APK (only this command actually reaches Expo's servers).
npx eas-cli build --platform android --profile preview
```

Because the deployed API is **HTTPS**, the app does **not** enable
`usesCleartextTraffic` — no Android networking exception is required. The `http://`
addresses above are for local development only.

All four variables are public by design, so `plaintext` visibility is appropriate;
`EXPO_PUBLIC_*` values are inlined into the APK bundle at build time and are
readable by anyone who has the file.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Start and open on Android |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run validate` | Print the resolved Expo config |
| `npm run doctor` | Run `expo-doctor` project validation |
| `npm run assets:placeholder` | Regenerate the placeholder icon assets |

## What it does today

- Browse the catalogue from `GET /api/products` (image, name, `priceLabel`, add to cart).
- Sign in / sign up with **email + password** against the same Supabase project as the
  website, so it is literally the same account.
- Call `GET /api/auth/me` after sign-in to confirm the API recognises the account, and
  surface a clear error if it does not.
- Add, change and remove cart items through the existing cart endpoints, always adopting
  the full cart the API returns (the server stays authoritative).
- Keep a guest cart for anonymous shopping, identified by a UUID in AsyncStorage.
- Merge the guest cart into the account cart on sign-in via `POST /api/cart/merge`.
- Restore the session on relaunch from Supabase's AsyncStorage-backed session.

## Cart synchronisation

There is exactly **one** cart database — the existing Express API backed by Supabase:

```
Website ─┐
         ├─> Express API ─> Supabase `carts` / `cart_items`
Mobile  ─┘
```

Both clients identify the same shopper with the same Supabase access token, so they
resolve to the same `carts` row. Nothing is stored on the device except the opaque
guest-cart UUID; every quantity, price and total shown comes from the API.

## Structure

```
mobile/
├── App.tsx                       # SafeAreaProvider → Auth → Cart → Navigator
├── index.ts                      # Expo entry (registerRootComponent)
├── app.json                      # Expo config: name, slug, Android package, icon
├── assets/                       # PLACEHOLDER icon (see note below)
├── scripts/
│   └── generate-placeholder-assets.mjs
└── src/
    ├── components/
    │   ├── Button.tsx            # Button + LinkButton
    │   ├── Card.tsx              # Card, DetailRow, StateView (loading/error/empty)
    │   ├── ProductCard.tsx       # catalogue row with Add to cart
    │   ├── ProductThumb.tsx      # image with placeholder fallback
    │   ├── QuantityStepper.tsx   # − / value / +
    │   ├── Screen.tsx            # safe-area + background container
    │   └── TextField.tsx
    ├── config/env.ts             # EXPO_PUBLIC_* reader + resolveAssetUrl()
    ├── context/
    │   ├── AuthProvider.tsx      # Supabase session + /api/auth/me profile
    │   └── CartProvider.tsx      # server-authoritative cart + guest merge
    ├── lib/
    │   ├── api.ts                # typed API client, error envelope, endpoints
    │   ├── guestCart.ts          # guest cart UUID in AsyncStorage
    │   ├── supabase.ts           # RN Supabase client (AsyncStorage + AppState)
    │   ├── types.ts              # mirrors backend/src/domain/types.ts
    │   └── uuid.ts
    ├── navigation/
    │   ├── RootNavigator.tsx     # stack + Shop/Cart/Account tabs
    │   └── types.ts
    ├── screens/
    │   ├── AccountScreen.tsx
    │   ├── CartScreen.tsx
    │   ├── ConnectionStatusScreen.tsx  # API diagnostics
    │   ├── ShopScreen.tsx
    │   ├── SignInScreen.tsx
    │   └── SignUpScreen.tsx
    └── theme/colors.ts           # brand tokens shared with the website
```

## App icon (placeholder)

`assets/icon.png`, `assets/adaptive-icon.png` and `assets/favicon.png` are
**temporary placeholders** generated by
`scripts/generate-placeholder-assets.mjs` (a brand-coloured ring on the site's
"ink" background). They exist so the Expo config is valid and a future Android
APK has a launchable icon. **They are not final branding** — replace them with
real Yuhmyuhm artwork (1024×1024 PNG) before release, then run
`npm run assets:placeholder` only if you need to regenerate the placeholders.

A branded launch/splash screen is not configured yet; when wanted, add the
`expo-splash-screen` config plugin (SDK 57 no longer accepts a top-level
`splash` key).

## Android identity

- App name: `Yuhmyuhm`
- Slug: `yuhmyuhm`
- Android package: `com.yuhmyuhm.catering`
