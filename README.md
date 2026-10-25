# VARATAAA — Custom Print T-Shirt Storefront

A production storefront for **VARATAAA** custom-print streetwear. It is a single-page React application backed by **Firebase** for content and **Cashfree** for payments, with a small Express API handling everything money-related.

This README explains what the project is, how the code is organized, and how to run, extend, and deploy it. For deeper internal documentation see [`docs/architecture.md`](docs/architecture.md), [`docs/admin-panel-spec.md`](docs/admin-panel-spec.md), and [`walkthrough.md`](walkthrough.md). Agent/machine instructions live in [`AGENTS.md`](AGENTS.md).

---

## 1. What this project is

| | |
|---|---|
| **Storefront** | Vite + React SPA with hash-based routing, Tailwind CSS, and Framer Motion |
| **Catalog** | Products, collections, and site content live in **Firestore** and are read directly from the browser (read-only) |
| **Checkout** | A **Cashfree hosted-checkout** payment flow orchestrated by an Express API |
| **API** | The same Express app runs locally (`node server.cjs`) and as a **Firebase Cloud Function** (`/api/**` rewrite) |
| **Admin** | A private `/admin` area for order management, gated by Firebase Auth + a server-verified `admin` custom claim |
| **Firebase project** | `ecommerce-f1448` (see `.firebaserc`) |

There is **no** Firebase Auth on the storefront (customers never log in), no Firestore writes from the browser (security rules deny all client writes), and no test suite — `npm run build` is the verification gate.

---

## 2. How it works

```
                    ┌──────────────────────────────────────────────┐
                    │                  BROWSER SPA                 │
                    │                                              │
  Firestore SDK ────┤  • read catalog / TOTD / site config         │
  (read-only)       │                                              │
                    │  • cart in localStorage ("cart")             │
                    │                                              │
  fetch ────────────┤  • /api/create-order      → server re-prices │
                    │  • /api/verify-payment    → confirms payment │
                    │  • /api/admin/*           → admin panel      │
                    │                                              │
  Cashfree SDK ─────┤  • open hosted checkout page                 │
                    └──────────────┬───────────────────────────────┘
                                   │ return to #payment-return?order_id=…
                                   ▼
        Firebase Hosting (static dist/)
                                   │  /api/** rewrite
                                   ▼
        Cloud Function `api`  (functions/index.js → server.cjs)
                                   │
           ┌───────────────────────┼──────────────────────────┐
           ▼                       ▼                          ▼
    Firestore (Admin SDK)   Cashfree REST API         mail collection
    • pendingOrders         • create session          → transactional
    • orders + mirrors      • verify payment             emails
    • fulfillment mirrors
```

### Checkout flow (the short version)

1. Customer browses the catalog (products are rendered from Firestore data).
2. Cart contents live in **localStorage**; sizes are appended to product IDs (`-<SIZE>`).
3. At checkout the client posts to `/api/create-order`; **the server re-computes the total from Firestore prices** — client amounts are never trusted. Shipping is free and no extra tax is charged; checkout display and `server.cjs` must stay aligned on this.
4. The server creates a Cashfree order and returns a hosted-checkout session; the customer pays on Cashfree's page.
5. Cashfree redirects back to `#payment-return?order_id=…`; the client calls `/api/verify-payment` to confirm before showing success.
6. A paid order is written to the `orders` collection (document ID = Cashfree `order_id`, which doubles as the idempotency key) plus one of three server-managed fulfillment mirrors (`orders_production`, `orders_out_for_delivery`, `orders_delivered`).

---

## 3. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (strict), Vite 5, Tailwind CSS, Framer Motion, lucide-react |
| Routing | Custom hash router (`src/hooks/useRouter.ts`) — no react-router |
| State | Local component state + localStorage; **no Redux/Zustand** |
| Backend | Node.js CommonJS (`.cjs`), Express 5, Helmet, CORS, express-rate-limit |
| Database | Cloud Firestore (client SDK reads / Admin SDK writes) |
| Auth | Firebase Authentication — **admin accounts only** |
| Payments | Cashfree (hosted checkout) via a swappable gateway adapter |
| Hosting | Firebase Hosting + Cloud Functions (Node 20) |

---

## 4. Repository structure

```
creating X/
├── index.html                     # SPA entry document
├── vite.config.ts                 # base "/varataaa/" + /api dev proxy
├── tailwind.config.ts             # Tailwind theme (metal-* / font-display tokens)
├── firebase.json                  # Hosting rewrites (/api/** → fn `api`) + Firestore rules path
├── firestore.rules                # Locks down client access (see §9)
├── .firebaserc                    # Firebase project: ecommerce-f1448
│
├── src/                           # -------- FRONTEND --------
│   ├── main.tsx / App.tsx         # App shell + page switching
│   ├── types.ts                   # Shared domain types
│   ├── components/                # Screen + UI components
│   │   ├── Navbar, Footer, Hero, …# Storefront sections
│   │   ├── CartDrawer.tsx         # Cart UI (localStorage-backed)
│   │   ├── CheckoutPage.tsx       # Address form → create-order → Cashfree
│   │   ├── PaymentReturnPage.tsx  # Verifies payment on return
│   │   ├── AdminPortal.tsx        # Admin login + access gate
│   │   ├── AdminOrders.tsx        # Order management (fulfillment status)
│   │   └── ui/                    # Radix-based primitives (button, dialog, …)
│   ├── features/tshirt-customizer/# T-shirt customizer (SVG/CSS viewer, presets, pricing)
│   ├── hooks/
│   │   ├── useRouter.ts           # Hash routing + payment-return parsing
│   │   ├── useCart.ts             # Cart state ↔ localStorage
│   │   ├── useCatalog.ts          # Firestore catalog subscriptions
│   │   └── useAdminAuth.ts        # Admin session (checks `admin` custom claim)
│   ├── lib/                       # firebase init, payment API helpers, admin API
│   ├── data/                      # Firestore → app mapping, site data
│   └── utils/                     # formatting, scroll, cookies, string helpers
│
├── server.cjs                     # -------- BACKEND (single file) --------
│   │                              # All Express routes: /api/health, /api/create-order,
│   │                              # /api/verify-payment, /api/cashfree-webhook,
│   │                              # /api/subscribe, and protected /api/admin/*
│   │
├── gateway/                       # Payment adapters (gateway-agnostic interface)
│   ├── index.cjs                  #   adapter registry (PAYMENT_GATEWAY env selects one)
│   └── cashfree.cjs               #   Cashfree create/verify implementation
│
├── functions/                     # Cloud Functions wrapper
│   ├── index.js                   #   exports server.cjs's `app` as function `api`
│   ├── server.cjs / gateway/      #   COPIES of the root files (see copy-server)
│   └── copy-server.js             #   copies server.cjs, gateway/, .env → functions/
│
├── firestore-upload/              # One-off dev utility: bulk-uploads products.json to Firestore
├── docs/                          # architecture.md, admin-panel-spec.md
├── walkthrough.md                 # How `_config/collections` drives the catalog
├── AGENTS.md                      # Operating rules for coding agents
└── .github/workflows/             # CI: Hosting deploys on merge/PR (build only)
```

> **Note:** `functions/server.cjs` is a generated copy. Edit the **root** `server.cjs` / `gateway/`, then run `npm run copy-server` inside `functions/` before deploying functions. `firebase.json` has no predeploy hook, so this step is manual.

---

## 5. Getting started

### Prerequisites

- **Node.js 20+** and npm
- A **Firebase project** (Firestore in Native mode, Email/Password Auth enabled)
- A **Cashfree account** (sandbox for development, production for live)
- **Firebase CLI** (`npm i -g firebase-tools`) for deploying

### Install

```bash
git clone <repo-url>
cd "creating X"
npm install
cd functions && npm install && cd ..
```

### Environment variables

Create a `.env` in the project root. **Never commit it, and never put secrets into `VITE_*` variables** (those ship inside the browser bundle).

**Client-facing (`VITE_*`, safe for the browser):**

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web app API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `<project>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics measurement ID (optional) |

**Server-only (backend processes and Cloud Function):**

| Variable | Purpose |
|---|---|
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase **service-account** credentials — used by the Admin SDK for Firestore writes and token verification |
| `PAYMENT_GATEWAY` | Which adapter in `gateway/` to use (`cashfree`) |
| `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` | Cashfree API credentials |
| `CASHFREE_API_URL` | Cashfree base URL — **sandbox by default when unset**; set to the production URL for live sales |
| `CASHFREE_API_VERSION` | Cashfree API version header |
| `PAYMENT_RETURN_URL` | Where Cashfree redirects after payment |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of origins allowed to call the API (localhost origins are always allowed in addition) |

Cloud Functions use the same variables, minus the `FIREBASE_*` names (reserved in that runtime — the copy-server script filters them out; inside Cloud Functions the Admin SDK uses the project's default service account automatically).

### Run locally

```bash
# Terminal 1 — frontend (Vite on :5173)
npm run dev

# Terminal 2 — API (Express on :5000)
npm run server

# Or both at once
npm run dev:all
```

The Vite dev server proxies `/api/**` to `http://localhost:5000`, so checkout works end-to-end using the Cashfree **sandbox** (set `CASHFREE_API_URL` accordingly) against your dev Firebase project.

---

## 6. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (paths expect `/varataaa/`) |
| `npm run server` | Express API on `:5000` |
| `npm run dev:all` | Dev server + API together |
| `npm run build` | `tsc -b && vite build` → `dist/` — **the main verification gate** |
| `npm run preview` | Preview the production build |
| `npm run copy-server` *(in `functions/`)* | Copy `server.cjs`, `gateway/`, filtered `.env` into `functions/` |
| `npx firebase deploy --only functions` | Deploy the API function (run `copy-server` first) |
| `npx firebase deploy --only firestore:rules` | Deploy security rules |
| `node firestore-upload/upload.js` | Bulk-upload `firestore-upload/products.json` into Firestore (dev utility) |

---

## 7. Admin panel

The admin area lives at **`/admin`** (or `#admin` in the hash) inside the same SPA. It lists paid orders and lets an administrator move orders through fulfillment: **production → out for delivery → delivered**.

Access is intentionally strict — there is no "make me admin" button in the app:

1. Create a user in **Firebase Authentication** (Email/Password).
2. Grant a custom claim on that user with the Admin SDK:
   ```js
   admin.auth().setCustomUserClaims(uid, { admin: true })
   ```
3. The user signs out and back in (custom claims are only picked up on a fresh token), then the UI checks the claim (`src/hooks/useAdminAuth.ts`) **and** the API re-verifies it server-side for every `/api/admin/*` request (`requireAdmin` in `server.cjs`). Revoking the claim immediately blocks the API, and the client on next token refresh.

Admin API endpoints (all require a valid ID token with `admin: true`, rate-limited separately):

- `GET /api/admin/session` — authorization probe used by the admin landing page
- `GET /api/admin/orders?status=<production|out_for_delivery|delivered>`
- `POST /api/admin/orders/fulfillment-status` — bulk status transitions (max 50 per call)

Design context and open decisions for future admin work: [`docs/admin-panel-spec.md`](docs/admin-panel-spec.md).

---

## 8. Payments and the gateway adapter

The server never imports a payment SDK directly. Endpoints call `gateway/index.cjs`, which selects an adapter via the `PAYMENT_GATEWAY` env var. Every adapter implements the same two functions:

```js
createOrder({ amount, currency, receipt, customer, returnUrl, items })
// → { orderId, amount, currency, gatewayData }   gatewayData: session/session token

verifyPayment({ paymentData, orderDetails })
// → { verified, gatewayPaymentId, gatewayOrderId }
```

To add Stripe/PayU/etc.: create `gateway/<name>.cjs`, export those two functions, register it in the `adapters` map in `gateway/index.cjs`, and set `PAYMENT_GATEWAY=<name>`. No endpoint changes required — the pattern is documented in detail at the top of `gateway/index.cjs`.

Amounts are handled in **INR**; the Cashfree adapter defaults to `INR`. The authoritative total is always recomputed server-side from Firestore `price` fields.

---

## 9. Firestore data model & security

**Public, browser-readable (catalog/content):**

- Product collections — discovered dynamically from the `_config/collections` document, plus the fixed `TOTD` collection. See `walkthrough.md` and `src/data/firestoreContent.ts`.
- `_config/{document}` — collection discovery configuration (public read).

**Server-only (never readable/writable by clients — rules deny all access; the Admin SDK bypasses rules):**

| Collection | Contents |
|---|---|
| `pendingOrders` | Checkout intents awaiting payment verification (contains PII) |
| `orders` | Canonical paid orders; doc ID = Cashfree `order_id` |
| `orders_production` / `orders_out_for_delivery` / `orders_delivered` | Server-managed fulfillment mirrors of `orders` (exactly one exists per order at a time) |
| `newsletter` | Newsletter subscribe requests (PII) |
| `mail` | Documents consumed by a mail-trigger extension |

Guarantees (enforced in `firestore.rules`):

- All client **writes**: denied.
- `orders`, `pendingOrders`, `newsletter`, `mail`, and the fulfillment mirrors: no direct client read; access flows exclusively through the authenticated server routes.
- Catalog collections: public reads only.

Deploy rules after editing: `npx firebase deploy --only firestore:rules`.

---

## 10. Key contracts (change these together with both sides)

- **Product ID:** `${slugify(collectionName)}-${documentId}`. Cart size variants append `-<SIZE>`; the server strips the trailing size when resolving a product in Firestore.
- **Price authority:** the **server** reads `price` from Firestore and rejects orders whose client-computed totals don't match. Keep `CheckoutPage.tsx` and `server.cjs` in sync on shipping (currently free) and tax policy (currently none).

---

## 11. Deployment

**Hosting (static SPA):** on every push to `main`, GitHub Actions runs `npm ci && npm run build` and deploys `dist/` to Firebase Hosting (`.github/workflows/firebase-hosting-merge.yml`; PRs get preview channels). `VITE_FIREBASE_*` values are injected from repo secrets.

**API (Cloud Function):** not covered by CI — deploy manually:

```bash
cd functions
npm run copy-server
cd ..
npx firebase deploy --only functions
```

**Production URL shape:** the site is built with Vite `base "/varataaa/"` and is served under that path on the production custom domain (`/varataaa`). The client keeps API calls inside the current mount (`src/lib/paymentApi.ts`), and Hosting rewrites `/api/**` to the `api` function. If you don't use the external `/varataaa` proxy, you'll need to adjust `base` in `vite.config.ts`.

**Firestore rules:** `npx firebase deploy --only firestore:rules` after editing `firestore.rules`.

---

## 12. Known limitations / current gaps

Honest list so new contributors don't trip over them:

- **Customizer carts cannot check out.** T-shirt-customizer products use `custom-*` IDs that the server's `resolveProductFromFirestore` can't resolve, so paying for a customized tee currently fails.
- **No stock enforcement.** Stock counts are displayed client-side; the server does not reserve or decrement inventory, so overselling is possible.
- **Size/colour are not persisted on paid order documents.** Order line items store id/name/price/qty/image only — fulfillment must rely on separate info today.
- **The Cashfree webhook does not verify signatures.** It re-queries Cashfree before writing orders, but strict signature validation should be added.
- **No automated tests, ESLint, or Prettier.** `npm run build` and manual QA are the current gates.
- **Collections in `_config/collections` are data.** Adding a collection is a Firestore change, not a code change — see `walkthrough.md`.

---

## 13. Security checklist for contributors

- Never commit `.env`, `functions/.env`, service-account keys, or any real credential.
- Never introduce secrets in `VITE_*` variables.
- Keep `FIREBASE_*` service credentials, Cashfree keys, and admin claims **server-side only**.
- Don't loosen `firestore.rules` reads beyond the public catalog collections.
- New admin endpoints **must** sit behind the existing `app.use('/api/admin', adminLimiter, requireAdmin)` boundary in `server.cjs`.

---

## 14. License

No license file is currently included in this repository. Add one before making the project publicly consumable.
