# PROJECT_CONTEXT.md — VARATAAA Storefront

> **Purpose of this document:** onboarding and architecture reference for the repository at `D:\creating X`.
>
> **Basis:** direct inspection of the working tree on 2026-10-20, commit `ea29abf` on branch `feature/admin-auth`, plus a successful production build (`npm run build`). No secret values are reproduced in this document.
>
> **Rule followed:** anything not confirmed from source or a command is explicitly marked **UNVERIFIED**.

---

## 1. At a glance

### 1.1 What this project is

A single-page e-commerce storefront for a streetwear T-shirt brand. It is branded inconsistently as **VARATAAA**, **METALFLUX**, and **Thoughts Of The Day (TOTD)** in different places. The store sells:

- Fixed catalog T-shirts stored in Firestore.
- A separate TOTD collection stored in Firestore.
- User-designed custom T-shirts created in a browser-based mockup studio.

The app supports product discovery, filtering, search, a persistent cart, Cashfree hosted-checkout payments, order persistence, and an order-confirmation email trigger.

### 1.2 What it is not

- Not a multi-tenant SaaS.
- Not server-rendered. It is a Vite-built React SPA.
- Not a full commerce platform: there is no admin UI, authentication, inventory reservation, returns workflow, or order-management screen.
- Not a monorepo with workspaces. It is one root frontend package plus two auxiliary Node packages (`functions`, `firestore-upload`).

### 1.3 High-level topology

```text
Browser (React SPA, built with Vite, base path /varataaa/)
  │
  ├── Firebase Web SDK ──► Firestore (public read of catalog; all client writes denied)
  │
  ├── fetch POST /api/create-order, /api/verify-payment, /api/subscribe
  │        │
  │        ▼
  │   Firebase Hosting rewrite /api/** ──► Cloud Function "api"
  │        │                                  (Express app from server.cjs)
  │        ├── Firebase Admin SDK ──► Firestore (orders, pendingOrders, mail, newsletter)
  │        └── Cashfree REST API ──► order creation / payment verification
  │
  └── Cashfree JS SDK (CDN) ──► hosted checkout page ──► redirect back to
                                                   /varataaa#payment-return?order_id=...
```

Production also appears to be served under `https://www.thehandle.in/varataaa` through an external reverse proxy (the code comments call it a Vercel proxy). The proxy configuration is **not in this repository**, so the exact behavior is **UNVERIFIED**.

---

## 2. Technology stack

### 2.1 Frontend

| Area | Technology | Notes |
|---|---|---|
| UI framework | React 18.3 | Function components and hooks only |
| Language | TypeScript 5.7, `strict: true` | No path aliases; relative imports |
| Build tool | Vite 5.4 | `base: '/varataaa/'` |
| Styling | Tailwind CSS 3.4 + custom CSS | `tailwind.config.ts`, `src/styles/globals.css` |
| Animation | Framer Motion 11 | Reveal, magnetic buttons, page/drawer transitions |
| Icons | lucide-react | |
| Routing | Custom hash router (`src/hooks/useRouter.ts`) | No React Router |
| State | React hooks + localStorage + cookies | No Redux/Zustand/Context store |
| HTTP | Native `fetch` | No Axios |

### 2.2 Backend

| Area | Technology | Notes |
|---|---|---|
| Runtime | Node.js 20 (functions), local Node | Cloud Function runtime declared as Node 20 |
| Framework | Express 5 | `server.cjs` |
| Language | CommonJS JavaScript (`.cjs` / `.js`) | Separate from the TypeScript frontend |
| Security middleware | `helmet`, `cors`, `express-rate-limit` | CORS allowlist, 100 kb JSON limit |
| Config | `dotenv` | Loads root `.env` locally; Cloud Function uses `functions/.env` |
| Firebase Admin | `firebase-admin` 12.x | Firestore writes and Admin credentials |
| Payment | Cashfree REST API via native `fetch` | No Cashfree server SDK |
| Cloud entry | `functions/index.js` | Wraps the Express app in `functions.https.onRequest` |

### 2.3 Data and platform

| Area | Technology |
|---|---|
| Database | Cloud Firestore (Native mode) |
| Hosting | Firebase Hosting (`dist`) |
| Serverless | Firebase Cloud Functions v1 (`api`, us-central1) |
| Analytics | Firebase Analytics SDK initialized, but no explicit event calls found |
| Auth | **Not used** (no Firebase Auth imports, no server auth middleware) |
| File storage | **Not used** (no Firebase Storage integration; customizer uploads stay in the browser) |
| CI/CD | GitHub Actions: Firebase Hosting deploy on `main` and PR previews |

### 2.4 Dependencies (declared in root `package.json`)

**Runtime:** `cors`, `dotenv`, `express`, `express-rate-limit`, `firebase`, `firebase-admin`, `framer-motion`, `helmet`, `lucide-react`, `react`, `react-dom`.

**Development:** `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `autoprefixer`, `concurrently`, `postcss`, `tailwindcss`, `typescript`, `vite`.

**Notably absent:** React Router, a state-management library, a UI component library, Three.js/WebGL, a test runner, ESLint, Prettier, Zod/Yup, an ORM.

### 2.5 Auxiliary packages

- `functions/package.json`: `firebase-functions` 4.x, `firebase-admin` 12.x, Express/CORS/Helmet/rate-limit/dotenv. Node 20 engine.
- `firestore-upload/package.json`: only `firebase-admin` 14.x. This is a standalone developer script, not part of the app runtime.

---

## 3. Repository structure

```text
D:\creating X\
├── src\                              # React SPA
│   ├── main.tsx                      # React root
│   ├── App.tsx                       # Composition shell; wires hooks to pages
│   ├── types.ts                      # Shared domain types
│   ├── assets\                       # Bundled logo, hero video, backgrounds, sale badge
│   ├── components\                   # Home sections, drawers, pages, primitives
│   ├── data\
│   │   ├── firestoreContent.ts       # Firestore discovery, mapping, live subscriptions
│   │   └── siteData.ts               # Static nav/footer/features/stats + unused seed data
│   ├── features\tshirt-customizer\   # Custom mockup studio
│   ├── hooks\                        # useCart, useCatalog, useRouter
│   ├── lib\                          # firebase init, payment client API, Cashfree client
│   ├── styles\globals.css            # Tailwind entry + design tokens + custom effects
│   └── utils\                        # cookies, currency format, hash scroll, slugify
├── gateway\                          # Server-side payment adapter registry
│   ├── index.cjs                     # Adapter selection / placeholder
│   └── cashfree.cjs                  # Cashfree createOrder + verifyPayment
├── functions\                        # Firebase Cloud Functions package
│   ├── index.js                      # exports `api` HTTPS function
│   ├── copy-server.js                # Copies server.cjs + gateway + filtered .env
│   ├── server.cjs                    # Generated copy of root server.cjs (gitignored)
│   └── gateway\                      # Generated copy (gitignored)
├── firestore-upload\                 # Standalone admin utility (not runtime code)
├── server.cjs                        # Express API used locally and copied to functions
├── firebase.json                     # Hosting + functions config, /api rewrite
├── firestore.rules                   # Firestore security rules
├── .firebaserc                       # Default Firebase project
├── .github\workflows\                # Hosting deploy / PR preview
├── index.html                        # Vite HTML entry
├── vite.config.ts                    # /varataaa base + dev proxy to :5000
├── tailwind.config.ts                # Design tokens
├── postcss.config.js                 # Tailwind + autoprefixer
├── tsconfig*.json                    # Project references, strict TS
├── package.json                      # Scripts + dependencies
├── walkthrough.md                    # Notes on dynamic Firestore collection discovery
├── PROJECT_CONTEXT.md                # This document
├── dist\                             # Build output (gitignored)
├── .env                              # Local secrets/config (gitignored)
└── firebase-debug.log                # Local deploy log (gitignored; contains credentials)
```

### 3.1 Important root files

| File | Purpose |
|---|---|
| `server.cjs` | The entire backend: Firebase Admin init, CORS/rate limiting, product price resolution, create-order, verify-payment, Cashfree webhook, newsletter subscription. Exports `{ app }`; starts listening only when run directly. |
| `gateway/index.cjs` | Gateway-agnostic adapter registry. Reads `PAYMENT_GATEWAY`; falls back to a placeholder that throws. Only `cashfree` is registered. |
| `gateway/cashfree.cjs` | Creates Cashfree orders via `POST {CASHFREE_API_URL}/orders`; verifies via `GET /orders/{id}` and `GET /orders/{id}/payments`. |
| `firebase.json` | Declares the Cloud Function source and Hosting `dist`; rewrites `/api/**` to the function and everything else to `index.html`. |
| `firestore.rules` | Public read for most top-level collections; all client writes denied; `orders` and `mail` fully blocked. |
| `vite.config.ts` | Sets the `/varataaa/` base path and proxies `/api` to `http://localhost:5000`. |
| `walkthrough.md` | Explains the `_config/collections` contract for dynamic product collections. |
| `firestore-upload/upload.js` | Manual batch script that merge-writes stock fields into a hardcoded `Fight` collection. Not imported by the app. |

### 3.2 Important frontend files

| File | Purpose |
|---|---|
| `src/App.tsx` | Chooses the active page based on router state and passes catalog/cart data into components. |
| `src/hooks/useRouter.ts` | Hash-based routing (`#products`, `#product-<id>`, `#checkout`, `#totd`, `#customize`, `#payment-return?order_id=...`), return-page tracking, hash sync. |
| `src/hooks/useCatalog.ts` | Subscribes to the merged catalog and TOTD; tracks `loading/ready/error`. |
| `src/hooks/useCart.ts` | Cart state, localStorage persistence, derived count/subtotal, add/remove/clear. |
| `src/data/firestoreContent.ts` | Collection discovery, defensive Firestore document mapping, real-time subscriptions. |
| `src/lib/firebase.ts` | Initializes Firebase app, Firestore, and Analytics. |
| `src/lib/paymentApi.ts` | Chooses `/api` vs `/varataaa/api` based on the current pathname. |
| `src/lib/paymentGateway.ts` | Loads the Cashfree JS SDK and redirects to hosted checkout. |
| `src/components/CheckoutPage.tsx` | Checkout form, client-side totals (18% tax, free shipping), order creation call. |
| `src/components/PaymentReturnPage.tsx` | Verifies payment after redirect, displays success/failure, clears local cart. |
| `src/features/tshirt-customizer/TShirtCustomizer.tsx` | Customizer UI, pricing (Rs. 599 base, +150 acid wash), add-to-cart, SVG export. |
| `src/features/tshirt-customizer/components/TShirt3DViewer.tsx` | SVG/CSS mockup viewer with drag/rotate and a simulated rotating showroom. Not real WebGL/Three.js. |

---

## 4. Frontend architecture

### 4.1 Composition model

`src/main.tsx` mounts `<App />` inside `React.StrictMode`. `App.tsx` is deliberately thin:

- Calls three hooks: `useCart()`, `useCatalog()`, `useRouter()`.
- Derives the selected product by searching both catalogs.
- Selects a page component based on `router.activePage`.
- Hides the Navbar/Footer on checkout and payment-return pages.
- Always renders the animated background canvas, cart drawer, search drawer, and cookie banner.

There is no global context/store. Cross-page state is limited to:

- `localStorage["cart"]` for the cart.
- Cookies for consent and recommendations.
- `sessionStorage["cashfree_checkout_context"]` for checkout display data.
- URL hash for page/navigation state.

### 4.2 Page map

| `activePage` | Component | Route |
|---|---|---|
| `home` | Hero, LatestDrop, Collections, Lookbook, Customize, About | default / any unmatched hash |
| `products` | `ProductViewingPage` | `#products` |
| `productDetail` | `ProductDetailsPage` or `TOTDProductDetailsPage` | `#product-<encodeURIComponent(id)>` |
| `totd` | `TOTD` | `#totd` |
| `customize` | `TShirtCustomizer` | `#customize` |
| `checkout` | `CheckoutPage` | `#checkout` |
| `paymentReturn` | `PaymentReturnPage` | `#payment-return?order_id=...` |

The router listens to `hashchange` and `popstate`, but navigation methods use `history.pushState` and then update React state directly. The product-return page (`home`, `products`, `totd`, `customize`) is kept in memory; it is not encoded in the URL.

### 4.3 Catalog data layer

Firestore is the only product source for the live UI. Static product data in `src/data/siteData.ts` is not used by the catalog.

**Collection discovery** (`discoverCollectionNames`):

1. Read `_config/collections`.
2. Accept an array field named `productCollections`, `collections`, or `names`.
3. Trim strings and drop empties.
4. Always append the base collection from `VITE_FIRESTORE_PRODUCTS_COLLECTION` (default `products`).
5. De-duplicate.

**Subscriptions** (`subscribeToProducts`):

- Creates one `onSnapshot` per discovered collection.
- Keeps the latest snapshot per collection in a `Map`.
- Merges and sorts all products by the optional numeric `order` field.
- Also watches `_config/collections`; when it changes after the initial snapshot, it re-discovers and rebuilds all listeners.
- Returns a teardown function.

**TOTD** (`subscribeToTOTD`) is a separate `onSnapshot` on the fixed collection name `TOTD` (case-sensitive). TOTD products are not part of the main catalog unless the collection name is also listed in `_config/collections`.

### 4.4 Firestore product document contract

`toProduct()` is intentionally tolerant and accepts many aliases:

| Product field | Firestore sources |
|---|---|
| `id` | `${slugify(collectionName)}-${documentId}` (composite, used everywhere) |
| `name` | `name`, `title`, fallback `"Product info unavailable"` |
| `price` | `price` (numeric or numeric string parsed client-side) |
| `priceLabel` | `priceLabel`, or the original string `price` |
| `image` | `img1`, `image`, `imageUrl`, `imageAddress` |
| `alt` | `alt`, `imageAlt`, `name` |
| `tag` | `tag`; forced to `"NEW"` when latest-drop is true |
| `filters` | derived collection label + `filter`, `filters`, `productFilter` |
| `subtitle` | `subtitle`, `productSubtitle` |
| `model` | `model`, `fit` |
| `description` | `description`, `productDescription` |
| `details` | `details`, `features`, `bullets` (newline/semicolon separated) |
| `shippingReturns` | `shippingReturns`, `shipping` |
| `careInstructions` | `careInstructions`, `care` |
| `galleryImages` | `galleryImages`, `images`, `productImages`, `gallery`, `photos`, plus every matching `imgN`/`imageN` field; primary image first |
| `colors` | `colors`, `colorOptions`, `color` |
| `sizes` | `sizes`, `sizeStock`, `stockBySize`, `stock`; if absent, fields `XXS/XS/S/M/L/XL/XXL/XXXL` |
| `sizeGuide` | `sizeGuide` array |
| `theme` | **derived from the Firestore collection name**, not from a `theme` field |
| `collectionImage` | `img1`, `collectionImage`, `collectionImageUrl`, `themeImage`, `themeImageUrl` |
| `isLatestDrop` | `isLatestDrop`, `latestDrop`, `latest`, `lastest` (boolean/string) |
| `order` | `order` |
| `dropOrder` | `dropOrder`, `latestDropOrder` |
| `collectionOrder` | `collectionOrder`, `themeOrder` |
| `createdAt` | `createdAt`, `updatedAt` as Firestore `Timestamp` or `Date` |
| `hero` | `hero` string; the hero section only shows products whose value is `"yes"` (case-insensitive) |

**Important data caveats:**

- Collection display names strip a trailing `" Collection"` (`collectionLabel`). "Cricket Collection" becomes "Cricket".
- The composite ID embeds the **full** collection name, then the document ID. The backend uses the same slugify logic.
- `createdAt`/`updatedAt` stored as ISO strings are ignored (only `Date`/Timestamp-like values are parsed).
- If a product has no size data at all, `sizeFields()` still returns eight sizes with `stock: 0`, so the product appears fully out of stock. The `DEFAULT_SIZES` fallback in the detail page is effectively unreachable for Firestore products.
- Size field names are case-sensitive (`S`, not `s`).
- Server-side checkout requires `price` to be numeric or a plain numeric string. A formatted string such as `"Rs. 599"` displays on the client but fails server validation.

### 4.5 Cart behavior

`useCart`:

- Loads `CartLine[]` from `localStorage["cart"]` defensively.
- Saves on every change.
- `cartCount` is the sum of quantities; `subtotal` is `sum(price * quantity)`.
- Adding an existing `id` increments quantity; adding a new `id` appends a line.
- Adding opens the cart drawer.
- Quantity decrement removes the line at quantity 1.
- There is no stock validation, reservation, or price re-check.

Size variants are distinguished by appending `-<SIZE>` to the product ID, e.g. `products-Connar McGregor-L`. The customizer creates a unique `custom-...-<timestamp>` ID on every add.

### 4.6 Customizer architecture

- State shape: color (`white|black|red`), garment size (`S–XXL`), active panel (`front|back|leftSleeve|rightSleeve|extra`), per-panel design (`url`, `name`, `x`, `y`, `sizeType`, `rotation`), style (`oversized|polo`), finish (`normal|acid wash`).
- Four built-in designs are inline SVG data URIs in `presets.ts`.
- Uploads are converted with `URL.createObjectURL(file)` and never uploaded to a server.
- Pricing: base `Rs. 599`, acid wash `+Rs. 150`; printing positions show as included. Pricing is locked until both front and back have a design. The Add-to-Cart button still works when locked and falls back to `599`.
- Add-to-cart builds a `Product` with a synthetic ID and metadata, but the backend cannot resolve that ID (see Known Issues).
- Export serializes the SVG inside `#tshirt-viewer-container` and downloads it.
- The "3D" viewer is an SVG/CSS mockup with drag/rotate controls and a CSS `rotateY` showroom, not a WebGL renderer.

---

## 5. Backend architecture

### 5.1 Express app lifecycle

`server.cjs`:

1. Loads `.env` with `dotenv`.
2. Initializes `firebase-admin`:
   - Locally: if `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, and a project ID exist, uses explicit service-account credentials.
   - In Cloud Functions: if `FUNCTION_TARGET` or `K_SERVICE` is set, uses Application Default Credentials.
   - Otherwise: logs warnings and leaves `db = null`.
3. Applies `helmet()`, CORS, and `express.json({ limit: "100kb" })`.
4. Applies a general rate limiter to `/api/` and a stricter limiter to create/verify.
5. Registers routes.
6. Starts listening only if `require.main === module`; otherwise exports `{ app }` for the Cloud Function wrapper.

### 5.2 Middleware and security controls

| Control | Implementation |
|---|---|
| Security headers | `helmet()` defaults |
| CORS | Allowlist from `CORS_ALLOWED_ORIGINS` + localhost dev origins; only `GET`/`POST`; `Content-Type` header; no credentials |
| Rate limiting | General: 100 requests / 15 min / IP. Payment create/verify: 10 / 15 min / IP |
| Body size | 100 kb |
| Input sanitization | Item count max 50, quantity integer 1–100, strings stripped of HTML tags and truncated on order write |
| Price authority | Server reads prices from Firestore; ignores any client amount |
| Amount validation | Cashfree amount must equal the pending order total (rounded to 2 decimals) |
| Idempotency | Firestore document ID for a paid order is the Cashfree `order_id`; `create()` rejects duplicates |
| Webhook trust | Does **not** verify the webhook signature; instead re-queries Cashfree before writing |

### 5.3 API endpoints

| Method | Path | Purpose | Notes |
|---|---|---|---|
| `GET` | `/api/health` | Health check | Returns status, gateway name, ISO time |
| `POST` | `/api/create-order` | Validate cart, resolve products/prices, create Cashfree order, store pending context | Returns `orderId`, `amount`, `currency`, `gatewayData` (includes `payment_session_id`) |
| `POST` | `/api/verify-payment` | Verify paid status with Cashfree, compare amount, write paid order, enqueue email, delete pending order | Idempotent; body `{ orderId }` |
| `POST` | `/api/cashfree-webhook` | Alternative paid-order creation path | No signature check; ignores non-success events; returns 200 even on processing error |
| `POST` | `/api/subscribe` | Newsletter subscription | Validates email, de-duplicates, writes `newsletter`; no frontend caller found |

### 5.4 Product resolution and pricing

`resolveProductFromFirestore(productId)`:

1. Reads `_config/collections` (fallback: `products`).
2. Appends `TOTD`.
3. For each collection, computes `slugify(collection) + "-"`.
4. If the composite ID starts with that prefix, takes the remainder as the document ID.
5. Reads the document.
6. If not found, strips the final `-<size>` segment and tries again.
7. Returns collection, document ID, and data, or `null`.

The server then:

- Requires `Number(product.data.price)` to be finite and > 0.
- Multiplies by quantity.
- Computes `tax = round(subtotal * 0.18, 2)`.
- Sets shipping to `0`.
- Charges `subtotal + tax`.

This logic is duplicated in `CheckoutPage.tsx` for display. The two must stay in sync.

### 5.5 Order persistence

**`pendingOrders/{cashfreeOrderId}`** (written by `create-order`):

```text
items: [{ productId, name, price, quantity, lineTotal, image }]
subtotalAmount, taxAmount, totalAmount
customer: { name, email, phone }
shipping: { country, address, apartment, city, state, pinCode }
status: "pending"
createdAt: ISO string
cashfreeOrderId, cfOrderId
```

**`orders/{cashfreeOrderId}`** (written by `verify-payment` or webhook):

```text
customer: { email, firstName, lastName, phone }
shipping: { country, address, apartment, city, state, pinCode }
items: [{ id, name, price, quantity, image }]
pricing: { subtotal, tax, shipping, total }
payment: { gateway, cashfreeOrderId, transactionId, paymentStatus }
status: "paid"
createdAt: ISO string
source: "webhook"   // only on the webhook path
```

**`mail`** (verify path only): `{ to, message: { subject, html } }`. This assumes the Firebase "Trigger Email" extension is installed; that is **UNVERIFIED** in this repository.

**`newsletter`**: `{ email, subscribedAt }`.

### 5.6 Payment flow

1. User submits checkout.
2. Client validates required fields, computes display totals, loads the Cashfree JS SDK from `https://sdk.cashfree.com/js/v3/cashfree.js`.
3. Client `POST /api/create-order` with `items: [{id, quantity}]`, customer, and shipping.
4. Server re-prices from Firestore, creates a Cashfree order, stores `pendingOrders`, returns `payment_session_id`.
5. Client stores display context in `sessionStorage` and calls `cashfree.checkout({ paymentSessionId, redirectTarget: "_self" })`.
6. Cashfree redirects back to the configured return URL with `order_id` in the fragment query.
7. `PaymentReturnPage` calls `POST /api/verify-payment`.
8. Server:
   - Returns the existing order if already verified.
   - Queries Cashfree order status and the successful payment transaction.
   - Requires status `PAID` and a non-empty transaction ID.
   - Compares the Cashfree amount with the stored total.
   - Writes the paid order, enqueues the email, deletes the pending order.
9. Client clears `localStorage["cart"]` and shows success.

Webhook path: Cashfree calls `/api/cashfree-webhook`; the server ignores non-success statuses, checks idempotency, re-verifies with Cashfree, and writes the order. It does **not** send the confirmation email.

### 5.7 Payment gateway adapter

`gateway/index.cjs` selects an adapter from a registry based on `PAYMENT_GATEWAY`:

- Registered: `cashfree`.
- Missing/unknown: placeholder adapter that throws clear configuration errors.
- Adapter contract: `createOrder({ amount, currency, receipt, customer, returnUrl, items })` and `verifyPayment({ orderId })`.

`cashfree.cjs`:

- Uses `x-client-id`, `x-client-secret`, and `x-api-version`.
- Defaults API URL to the **sandbox** if `CASHFREE_API_URL` is absent.
- Creates order IDs like `order_<timestamp>_<random>`.
- Appends `?order_id={order_id}` to the return URL.
- Requires a successful payment record with a transaction ID before returning `verified: true`.

---

## 6. Database architecture (Firestore)

### 6.1 Collections observed in code

| Collection | Read by client | Written by client | Written by server | Purpose |
|---|---|---|---|---|
| `_config` | Yes | No | No (manual console) | `_config/collections` holds the product collection list |
| `products` | Yes | No | No | Default/base product collection |
| Any name in `_config/collections` | Yes | No | No | Additional product collections |
| `TOTD` | Yes | No | No | Thoughts Of The Day products |
| `orders` | **No** | No | Yes (Admin SDK) | Paid orders |
| `pendingOrders` | **Currently yes** (rules gap) | No | Yes (Admin SDK) | Temporary checkout context |
| `mail` | **No** | No | Yes (Admin SDK) | Email trigger documents |
| `newsletter` | **Currently yes** (rules gap) | No | Yes (Admin SDK) | Newsletter emails |

No indexes, migrations, schema validators, or seed scripts for the live catalog are present. Data is maintained manually in the Firebase Console.

### 6.2 Security rules analysis

`firestore.rules`:

```text
match /{collectionName}/{document} {
  allow read: if collectionName != 'orders' && collectionName != 'mail';
  allow write: if false;
}
```

Consequences:

- Public read of every top-level collection except `orders` and `mail`.
- **`pendingOrders` is publicly readable**, including customer name/email/phone and shipping address. This is a real PII exposure.
- **`newsletter` is publicly readable**, exposing subscriber emails.
- Any future sensitive top-level collection is readable unless explicitly excluded.
- Nested subcollections are not covered by this wildcard and would be denied by default.
- `orders` and `mail` are fully blocked for clients.
- Client writes are blocked everywhere.

`firebase.json` does **not** declare a `firestore` block, so `firebase deploy` will not deploy `firestore.rules` automatically. Rules must be deployed/pasted separately. Whether the deployed rules match this file is **UNVERIFIED**.

---

## 7. Deployment and hosting

### 7.1 Build

```bash
npm install
npm run build          # tsc -b && vite build
```

Verified on 2026-10-20: build succeeds.

- Output: `dist/`
- JS bundle: ~808 kB minified / ~217 kB gzip (Vite warns about the 500 kB threshold).
- Largest assets: logo ~6.76 MB, `back1.png` ~6.21 MB, hero video ~10.04 MB.

### 7.2 Local development

```bash
npm run dev       # Vite dev server
npm run server    # Express API on :5000
npm run dev:all   # Both via concurrently
npm run preview   # Preview the production build
```

Vite proxies `/api` to `http://localhost:5000`. Because `base` is `/varataaa/`, the dev URL is expected to be `http://localhost:5173/varataaa/`.

### 7.3 Firebase configuration

- Project: `ecommerce-f1448` (from `.firebaserc`).
- Hosting public dir: `dist`.
- Rewrites:
  - `/api/**` → Cloud Function `api`.
  - `**` → `/index.html`.
- Cloud Function source: `functions/`, entry `index.js`, export `api`.
- No `predeploy` hook is configured in `firebase.json`, despite comments in `functions/index.js` referring to a predeploy copy.
- `functions/copy-server.js` must therefore be run manually (or its output committed/generated) before deploying functions.
- The generated `functions/server.cjs` currently matches the root file in content (the file hash differs only due to line endings).

### 7.4 CI/CD

Two GitHub Actions workflows:

- `firebase-hosting-merge.yml`: on push to `main`, runs `npm ci && npm run build` with the seven `VITE_FIREBASE_*` secrets and deploys Hosting live using `FIREBASE_SERVICE_ACCOUNT_ECOMMERCE_F1448`.
- `firebase-hosting-pull-request.yml`: PR preview channel deploy, same build/secrets.

Neither workflow deploys Cloud Functions or Firestore rules, and neither passes server-side payment/Firebase Admin secrets. Functions appear to be deployed separately with the Firebase CLI.

### 7.5 Base-path constraint

`vite.config.ts` sets `base: '/varataaa/'`, so the built HTML references `/varataaa/assets/...`. `paymentApi.ts` switches to `/varataaa/api` whenever the pathname starts with `/varataaa`.

This implies:

- The app is designed to be served at `https://www.thehandle.in/varataaa` through an external proxy that maps `/varataaa/*` onto the Firebase site root (the code comment calls it a Vercel proxy).
- The Firebase Hosting default URL (`https://ecommerce-f1448.web.app/`) will likely fail to load assets because it serves `index.html` at `/` but the HTML requests `/varataaa/assets/...`, which is not present at that origin. This is inferred from configuration, not runtime-verified.
- In local Vite dev, `paymentApiPath()` returns `/varataaa/api/...`, while `vite.config.ts` only proxies `/api`. Local checkout requests will likely 404 unless a proxy rule for `/varataaa/api` is added. This is inferred from configuration.
- The `/api` rewrite in Firebase Hosting only matches `/api/**`, not `/varataaa/api/**`; the external proxy must strip the prefix for production payments to work.

---

## 8. Important workflows

### 8.1 Boot and catalog sync

1. `main.tsx` mounts `App`.
2. `useCatalog` subscribes to `_config/collections`.
3. One Firestore listener per collection is created.
4. TOTD listener is created separately.
5. All products are merged, mapped, and sorted by `order`.
6. Home sections derive their subsets:
   - Hero: `hero === "yes"`, max 2.
   - Latest Drop: `isLatestDrop`, sorted by `dropOrder`/`order` then `createdAt`, max 8.
   - Collections: grouped by derived collection label (`theme`), carousel triplicated for infinite scroll.
   - Lookbook: first 10 catalog products.
   - Search: name/tag/theme/model/description substring match.
   - Filters: all collection labels plus `filter(s)` values, OR semantics.

### 8.2 Product detail and add to cart

1. Product ID is read from the hash.
2. `App` finds the product in the catalog or TOTD list.
3. Detail page selects the first in-stock size.
4. Add to cart creates a variant line:
   - ID: `${product.id}-${size}`
   - Name: `${product.name} (${size})`
   - Image: currently displayed gallery image
5. `useCart` increments an existing variant or appends a new line and opens the drawer.
6. "Buy Now" currently calls the same add-to-cart handler; it does not jump to checkout.

### 8.3 Checkout totals

- Subtotal: client cart line prices.
- Tax: 18% of subtotal.
- Shipping: 0 (shown as FREE).
- Total: subtotal + tax.
- The server independently recomputes the same values from Firestore prices. If the catalog price changed since the item was added, the displayed total and charged total can differ.

### 8.4 Payment return

1. Cashfree redirects to the return URL with `order_id` in the fragment query.
2. `useRouter` parses `#payment-return?order_id=...`.
3. `PaymentReturnPage` prevents duplicate verification in StrictMode with a ref.
4. On success, it removes `cart` from localStorage.
5. Because the React cart state was initialized before removal, the in-memory cart count can remain until a full reload/navigation. The redirect normally causes a fresh load, so this is usually invisible.

### 8.5 Newsletter (backend-only)

`POST /api/subscribe` validates the email, lowercases/truncates it, checks for duplicates, and writes to `newsletter`. No frontend form or `fetch` call to this endpoint was found. The checkout "Email me with news and offers" checkbox is local state only and is never sent or persisted.

### 8.6 Cookie consent and recommendations

- `CookieConsent` writes `cookie_consent=accepted|essential` for 365 days and dispatches a `cookieConsentChanged` event.
- No component listens to that event.
- Product detail pages read the consent cookie and, if `accepted`, update:
  - `recently_viewed`: last 10 product IDs.
  - `you_may_also_like`: category preference scores used to sort related products.
- TOTD detail pages update only `recently_viewed`.
- Cookie writes use `SameSite=Lax; Secure`.

---

## 9. Environment variables and external integrations

> **No secret values are listed below.** Only names and purposes.

### 9.1 Client/build-time variables (`VITE_*`)

These are embedded in the public JavaScript bundle and must never contain server secrets.

| Variable | Required | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web SDK config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Web SDK config |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase Web SDK config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Web SDK config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase Web SDK config |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase Web SDK config |
| `VITE_FIREBASE_MEASUREMENT_ID` | Yes (for Analytics) | Firebase Analytics config |
| `VITE_FIRESTORE_PRODUCTS_COLLECTION` | No | Base product collection name; default `products` |
| `VITE_FIRESTORE_LOOKBOOK_COLLECTION` | No | Declared but unused |
| `VITE_HERO_POSTER_URL` | No | Overrides the hero video poster |
| `VITE_HERO_VIDEO_URL` | No | Overrides the bundled hero video |

In the current local env files, the hero and product-collection overrides are not set; code fallbacks apply.

### 9.2 Server/Cloud Function variables

| Variable | Required | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Local yes; Cloud Functions via ADC | Admin SDK project (falls back to `VITE_FIREBASE_PROJECT_ID`) |
| `FIREBASE_CLIENT_EMAIL` | Local yes | Admin SDK service-account email |
| `FIREBASE_PRIVATE_KEY` | Local yes | Admin SDK private key (literal `\n` converted to newlines) |
| `PAYMENT_GATEWAY` | Yes | Adapter name; expected `cashfree` |
| `CASHFREE_APP_ID` | Yes for payments | Cashfree client ID |
| `CASHFREE_SECRET_KEY` | Yes for payments | Cashfree secret (server only) |
| `CASHFREE_API_VERSION` | No | Default `2025-01-01` |
| `CASHFREE_API_URL` | No | Defaults to Cashfree **sandbox** URL |
| `CORS_ALLOWED_ORIGINS` | Production yes | Comma-separated origin allowlist; localhost dev origins are always added |
| `PAYMENT_RETURN_URL` | Production recommended | Explicit return URL for reverse-proxied deployments |
| `PORT` | No | Local server port; default `5000` |

`functions/.env` is generated by `copy-server.js`, which filters out lines beginning with `FIREBASE_` so the Cloud Function uses Application Default Credentials. It also copies the client `VITE_*` values and the Cashfree/CORS settings.

### 9.3 CI/CD variables (GitHub secrets)

| Secret | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_MEASUREMENT_ID` | Build-time Firebase Web config |
| `FIREBASE_SERVICE_ACCOUNT_ECOMMERCE_F1448` | Hosting deploy credentials |
| `GITHUB_TOKEN` | Provided automatically for the deploy action |

No server-side Cashfree/Firebase Admin secrets are passed to the Hosting workflows.

### 9.4 External integrations

| Integration | Usage | Verified |
|---|---|---|
| Firebase Firestore | Catalog reads, live updates, order/newsletter/mail writes | Yes |
| Firebase Hosting | Serves `dist`, rewrites `/api/**` | Yes |
| Firebase Cloud Functions | Hosts the Express API as `api` | Yes |
| Firebase Analytics | `getAnalytics` initialized; no explicit event logging found | Partially |
| Cashfree PG | Hosted checkout, order creation, verification | Yes |
| Email delivery | Firestore `mail` collection, presumably Trigger Email extension | Extension **UNVERIFIED** |
| Google Fonts | Space Grotesk and Syne | Yes |
| Unsplash | About/Customize imagery and default customizer fallback | Yes |
| Wikimedia Commons | Default hero poster (black image) | Yes |
| Google Maps | Footer iframe | Yes |
| Instagram | Footer link | Yes |
| GitHub Actions | Hosting deploys | Yes |
| Firebase Auth / Storage | Not integrated | Confirmed absent |

---

## 10. Current implementation status

### 10.1 Verified working (from source and/or build)

- Production build succeeds (`tsc -b && vite build`).
- Firestore-driven catalog and TOTD subscriptions.
- Dynamic collection discovery via `_config/collections`.
- Home page, latest drop, collections carousel, lookbook grid, about, footer.
- Product listing with filters and pagination.
- Product detail with gallery, size selection, size guide, accordions, related products.
- Search drawer.
- Cart with localStorage persistence and quantity controls.
- Checkout form and 18% tax/free-shipping calculation.
- Cashfree order creation and redirect flow.
- Server-authoritative pricing and amount validation.
- Idempotent paid-order persistence.
- Confirmation email enqueue on the return-verification path.
- Cashfree webhook endpoint with re-verification.
- Newsletter backend endpoint.
- Cookie consent and recommendation cookies.
- Customizer UI, presets, upload preview, pricing, SVG export, mockup interactions.
- Responsive layouts and reduced-motion handling in several animated components.

### 10.2 Partially implemented / limited

| Area | Status |
|---|---|
| Customizer commerce | UI works, but custom items cannot be checked out |
| Custom design persistence | Uploads are local blob URLs only; nothing is sent to a server |
| Product variants | Size is encoded in the cart ID, but the order loses size/color |
| Color selection | TOTD shows non-interactive swatches; ProductDetailsPage does not render colors at all |
| Newsletter | Backend only; no UI; checkout opt-in ignored |
| Account/login | "Sign in" is a toast placeholder; no auth |
| Admin | No admin UI; data managed in Firebase Console |
| Order management | No UI; orders are read in the Firebase Console |
| Inventory | Stock displayed, but never decremented or reserved |
| Lookbook | Uses catalog products; Firestore lookbook code is dead |
| Analytics | SDK initialized, but no events |
| Email | Queued to `mail`; actual delivery depends on an extension |
| Payments | Cashfree only; adapter registry supports future gateways |

### 10.3 Not implemented

- Firebase Authentication / admin authorization.
- Admin dashboard for products, collections, stock, orders, or refunds.
- Server-side stock validation or reservation.
- Order status lifecycle beyond `pending`/`paid`.
- Returns/refunds workflow.
- Shipping integration or tracking.
- Discounts/coupons.
- Multi-currency (prices are INR; `formatPrice` is INR-only).
- File upload/storage.
- Transactional email templates outside the inline HTML.
- Automated tests, linting, type-check CI, or E2E coverage.
- Sitemap/robots/per-page SEO metadata.
- Structured logging/observability.
- Error boundary in the React app.

---

## 11. Known issues and risks

### 11.1 Critical / high

| # | Issue | Evidence / impact |
|---|---|---|
| 1 | **`pendingOrders` and `newsletter` are publicly readable** | `firestore.rules` only excludes `orders` and `mail` from the wildcard read. Pending orders contain customer name, email, phone, and shipping address; newsletter contains subscriber emails. Fix the rules before production. |
| 2 | **Customizer products cannot be purchased** | `TShirtCustomizer` creates IDs like `custom-...-<timestamp>`; `resolveProductFromFirestore` only matches known collection prefixes (`products`, configured collections, `TOTD`) and returns 404. Checkout fails for custom tees. |
| 3 | **Orders do not record size or color** | The client sends only `{ id, quantity }`; the server stores the Firestore product name (base name, without the `(SIZE)` suffix) and price. Fulfillment has no variant data. |
| 4 | **No stock enforcement** | The server never checks or decrements `stock`. Concurrent orders can oversell. |
| 5 | **Secrets exist in local files** | `.env`, `functions/.env`, and `firebase-debug.log` contain live-looking production credentials. They are gitignored and not tracked in current history, but the debug log is plaintext and includes environment variables. Treat them as sensitive and rotate if ever exposed/shared. |
| 6 | **Firestore rules are not wired into `firebase.json`** | No `"firestore": { "rules": ... }` block, so a normal `firebase deploy` will not publish rule changes. The deployed rules may differ from the repository. |
| 7 | **Webhook has no signature verification** | `/api/cashfree-webhook` trusts the payload enough to call Cashfree verification. It cannot forge a paid order, but it can be abused to trigger verification calls and relies entirely on the follow-up API check. |

### 11.2 Medium

| # | Issue | Evidence / impact |
|---|---|---|
| 8 | **Base-path mismatch on Firebase Hosting** | Built assets are requested from `/varataaa/assets/...`, but Firebase Hosting serves the site at `/`. The default `web.app` URL likely cannot load the app. Production appears to depend on an external proxy. |
| 9 | **Local checkout path likely 404s** | `paymentApiPath()` returns `/varataaa/api/...` under the Vite dev path, but Vite only proxies `/api`. |
| 10 | **Client/server price drift** | Cart displays client-cached prices; the server charges current Firestore prices. The payment amount can differ from what the user saw. |
| 11 | **Products with no size data are unsellable** | `sizeFields()` returns eight sizes with stock 0 when no size data exists, so `DEFAULT_SIZES` is never used for Firestore products. |
| 12 | **Non-numeric Firestore prices fail server-side** | Server uses `Number(data.price)`; formatted strings such as `"Rs. 599"` are rejected even though the client can display them. |
| 13 | **Rate limiting behind a proxy** | No `app.set('trust proxy', ...)`. Behind Firebase Hosting/proxy, `express-rate-limit` v8 may see proxy IPs or emit validation errors, causing shared limits or ineffective limits. Runtime behavior **UNVERIFIED**. |
| 14 | **`verify-payment` can return a fake success without a DB** | If `db` is null but Cashfree verification succeeds, it returns `orderId: dev_mock_...` and writes nothing. This can mask misconfiguration. |
| 15 | **Webhook path omits confirmation email** | `orders` are created with `source: "webhook"`, but the mail enqueue block exists only in `/api/verify-payment`. |
| 16 | **Client Cashfree mode is hardcoded to production** | `new window.Cashfree({ mode: 'production' })` while the server defaults to the sandbox API URL when `CASHFREE_API_URL` is unset. Mixed environments will fail. |
| 17 | **Return URL construction relies on a fragment** | Cashfree appends `?order_id=...` to the configured URL. The current design stores it after `#payment-return`, which the router parses. It is fragile if the configured URL already has a query string. |
| 18 | **`src/assets` is gitignored but tracked** | New binary assets will be silently untracked unless force-added. A fresh clone without the tracked assets would fail the build. |
| 19 | **Large payloads** | ~6.8 MB logo, ~6.2 MB background, ~10 MB hero video, ~808 kB JS. Poor mobile load performance and bandwidth cost. |
| 20 | **No code splitting** | Single JS chunk >500 kB; Vite warns. |

### 11.3 Low / UX / maintainability

| # | Issue |
|---|---|
| 21 | "Buy Now" only adds to cart; it does not start checkout. |
| 22 | Product card's plus button always opens product details because `onOpen` is supplied; quick-add is effectively disabled. |
| 23 | `ProductDetailsPage` computes `colors` but never renders them; no color selection. TOTD color swatches are non-interactive. |
| 24 | Checkout "Sign in" shows a "coming soon" toast. |
| 25 | Checkout address search and phone help are toasts, not integrations. |
| 26 | Footer support/size-guide/legal links show "Soon". |
| 27 | Marketing opt-in checkbox is never sent or persisted. |
| 28 | `/api/subscribe` has no frontend caller. |
| 29 | `PaymentReturnPage` removes localStorage directly instead of calling `clearCart`; in-memory state can remain stale. |
| 30 | `cookieConsentChanged` is dispatched but never listened to. |
| 31 | `lookbookCollectionName`, `toLookbookItem`, `lookbookItems`, static `products`, and `seedCartProductIds` are dead code. |
| 32 | `src/features/tshirt-customizer/customizer.css` is not imported anywhere; it also uses Tailwind v4 syntax while the project uses Tailwind v3. |
| 33 | `analyticsReady` is exported but never used; Analytics is initialized as a module side effect with no events. |
| 34 | Cart/search drawers do not implement focus trapping. |
| 35 | No React error boundary; a render failure blanks the app. |
| 36 | Branding is inconsistent: VARATAAA (site), METALFLUX (logo/alt/package names), Thoughts Of The Day (TOTD). |
| 37 | `.firebase/hosting.ZGlzdA.cache` is tracked despite `.firebase/` being ignored. |
| 38 | `codex.html` is an unrelated "AI Projects Showcase" static file; `Payment possiblities/` is a screenshot folder. Both are gitignored and not part of the app. |
| 39 | `firestore-upload/upload.js` hardcodes the `Fight` collection and only writes stock fields; it is a one-off utility with no guardrails. |
| 40 | No tests, lint, formatter, or CI type-check. |

---

## 12. Coding conventions and constraints

### 12.1 Frontend conventions

- **TypeScript strict** (`tsconfig.app.json`), target ES2020, `noEmit`, `isolatedModules`.
- **2-space indentation**, single quotes, semicolons, trailing commas.
- **Function components**, named exports for most components (`App` and `TShirtCustomizer` have default exports too).
- **Hooks** are extracted for cross-cutting concerns (`useCart`, `useCatalog`, `useRouter`); `App` stays a composition layer.
- **Domain types** live in `src/types.ts`; feature-specific types live under the feature folder.
- **Relative imports** only; no path aliases.
- **Derived values** use `useMemo`; callbacks use `useCallback` where identity matters.
- **Defensive parsing** in the Firestore mapping layer: accept aliases, normalize, filter empties.
- **Loading/error UI** uses `DataStatus` (`loading | ready | error`) and explicit empty states.
- **Styling**: Tailwind utility classes, `max-w-shell`, `font-display`, `metal-*` color tokens, black/white high-contrast aesthetic, uppercase tracking for labels.
- **Motion**: Framer Motion; check `useReducedMotion()` and respect `(pointer: fine)` for hover effects.
- **Accessibility**: `aria-label`, `aria-modal`, `aria-pressed`, keyboard handlers, `role="button"` where non-button elements are clickable.
- **Comments**: divider banners such as `// ===== ... =====`, and bullet summaries at the top of hooks.
- **No global state library**: prefer hook-local state and persistence.

### 12.2 Backend conventions

- **CommonJS**, 2-space indentation, single quotes, semicolons.
- Express 5 route handlers; async/await with `try/catch`.
- **Gateway adapter pattern**: keep endpoints gateway-agnostic; add new gateways in `gateway/<name>.cjs` and register them in `adapters`.
- **`camelCase`** for functions/variables, **`UPPER_SNAKE_CASE`** for env/config constants.
- **Security-first comments** explain why prices are re-read, why writes are server-only, and why idempotency exists.
- **Sanitize** all customer-supplied strings before persistence.
- **Return JSON consistently**: `{ success, message, ... }`.

### 12.3 Critical invariants (do not break casually)

1. **Product ID contract:** `${slugify(collectionName)}-${documentId}` on the client and server. The server reverses it and optionally strips a trailing `-<size>`.
2. **Server is the price authority.** Never accept a client-supplied amount.
3. **Paid order document ID = Cashfree `order_id`.** This is the idempotency key for both verify and webhook paths.
4. **Client writes to Firestore are always denied.** Catalog changes are manual/admin-side.
5. **New product collections must be added to `_config/collections`** (and products must exist) or the frontend will not discover them.
6. **TOTD is a fixed collection name** (`TOTD`, uppercase) and is separate from the config-driven catalog.
7. **Tax (18%) and free shipping are hardcoded in two places** (`CheckoutPage.tsx` and `server.cjs`). Change both together.
8. **`price` in Firestore must be numeric** (or a plain numeric string) for checkout to work.
9. **The `/varataaa` base path and `paymentApiPath()` logic are coupled.** Changes require corresponding proxy/hosting changes.
10. **Cloud Function source is generated**: edit `server.cjs`/`gateway/`, then run the copy step before deploying functions.
11. **Never commit secrets.** `.env`, `functions/.env`, service-account JSON, and `firebase-debug.log` must remain untracked.
12. **Preserve reduced-motion and mobile layouts** when changing animated components.

---

## 13. How to run, build, and deploy (observed)

### 13.1 Local

```bash
npm install
npm run dev          # Vite, expected at http://localhost:5173/varataaa/
npm run server       # Express API at http://localhost:5000
npm run dev:all      # Both
npm run build        # Type-check + production build
npm run preview      # Serve dist
```

Local payment requires valid Firebase Admin and Cashfree credentials in the root `.env`, and (because of the base path) likely a Vite proxy adjustment for `/varataaa/api`. This is **UNVERIFIED** at runtime.

### 13.2 Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

The GitHub Actions workflow performs the same deploy on pushes to `main`.

### 13.3 Cloud Functions

```bash
cd functions
npm install
npm run copy-server      # copies ../server.cjs, ../gateway/*, filtered ../.env
cd ..
firebase deploy --only functions
```

`firebase.json` has no `predeploy` hook, so `copy-server` is a manual step.

### 13.4 Firestore rules

There is no `firestore` section in `firebase.json`. Deploy rules through the Firebase Console or add:

```json
"firestore": {
  "rules": "firestore.rules"
}
```

then run `firebase deploy --only firestore:rules`. Do not assume the repository rules are live.

### 13.5 Firestore catalog setup

1. Create product documents in `products` and/or additional collections.
2. Create `_config/collections` with `productCollections: ["Cricket Collection", "Football Collection", ...]`.
3. Ensure each product has a numeric `price` and size stock fields or a `sizes` structure.
4. Create a `TOTD` collection for Thoughts Of The Day products.
5. The frontend will discover and subscribe without a redeploy.

### 13.6 Adding a payment gateway

1. Create `gateway/<name>.cjs` exporting `{ name, createOrder, verifyPayment }`.
2. Register it in `gateway/index.cjs`.
3. Set `PAYMENT_GATEWAY=<name>` and add credentials.
4. Update `src/lib/paymentGateway.ts` for the client-side checkout flow (currently Cashfree-specific).
5. Run the copy step before deploying functions.

---

## 14. Environment and security notes

- **Firebase Web config is public by design**, but do not add server secrets to `VITE_*` variables.
- **Cashfree secret and Firebase Admin private key are server-only.** They must never appear in the client bundle.
- **Local sensitive files currently present:** `.env`, `functions/.env`, `firestore-upload/serviceAccountKey.json`, and `firebase-debug.log`. All are ignored by git and were not found in tracked history, but they contain real-looking credentials. Restrict access, avoid sharing archives of the working directory, and rotate keys if exposure is suspected.
- **Firestore PII:** fix the wildcard read rule before launch. At minimum, explicitly deny `pendingOrders`, `newsletter`, and any future sensitive collection.
- **Webhook:** add Cashfree signature verification if the gateway supports it, and consider an explicit shared secret/IP allowlist.
- **Rate limiting:** set `trust proxy` appropriately for the hosting topology and verify per-client IP behavior.
- **No authentication:** any future admin surface must add Firebase Auth + custom claims/role checks and server-side authorization. The current branch name `feature/admin-auth` does not contain admin code (the diff vs `main` is limited to stock data, `.gitignore`, and the hosting cache).

---

## 15. Explicitly unverified items

The following could not be confirmed from the repository and should be checked against the live environment:

1. Whether the deployed Firestore rules match `firestore.rules`.
2. Whether the Firebase "Trigger Email" extension is installed and `mail` documents are delivered.
3. Whether the external `thehandle.in/varataaa` proxy is configured as the code comments imply.
4. Whether the live Cloud Function matches the current `server.cjs` (the local `firebase-debug.log` records a successful function deploy dated 2026-09-14; HEAD is dated 2026-10-20, so later changes may not be deployed).
5. Whether `https://ecommerce-f1448.web.app/` works with the `/varataaa/` asset base.
6. Whether local Vite dev checkout works with the `/varataaa/api` path.
7. Actual Cashfree production/sandbox mode used at runtime (client hardcodes production; server depends on `CASHFREE_API_URL`).
8. Actual inventory levels, product documents, and collection names in Firestore.
9. Whether any order-management or admin tooling exists outside this repository.
10. Real user traffic, conversion, and performance metrics.
11. Whether `functions/.env` is packaged by the Firebase CLI in the current deployment (the debug log shows payment env vars present on the deployed function).
12. The exact behavior of `express-rate-limit` behind the production proxy.

---

## 16. Suggested next steps (not implemented)

Ordered by risk reduction, not by feature value:

1. **Fix Firestore rules** to deny `pendingOrders`, `newsletter`, and any future sensitive collection; deploy and verify.
2. **Fix customizer checkout** by either creating a server-recognized custom-product flow or adding a dedicated custom-order endpoint that accepts a validated design/price payload.
3. **Persist variant data** (size, color, custom design reference) in cart items and orders.
4. **Add server-side stock validation/reservation** or explicitly mark the store as made-to-order with no stock guarantees.
5. **Reconcile client and server price authority** by re-fetching/validating the cart before payment and showing the server total.
6. **Fix the base-path/proxy mismatch** for local dev and Firebase Hosting, or document the required proxy contract.
7. **Add a `firestore` block and `predeploy` hook** to `firebase.json`; automate functions/rules deployment.
8. **Remove or intentionally disable dead code** (`lookbook` subscription, static products, unused CSS, unused analytics export).
9. **Remove/rotate local secrets** from logs and ensure `.env` files never enter source control.
10. **Optimize assets and code-split** the bundle.
11. **Add tests/lint/type-check CI** and a minimal smoke test for checkout.
12. **Add authentication and an admin surface** if the `feature/admin-auth` direction is pursued.

---

## 17. Quick reference

### 17.1 Key commands

| Command | Meaning |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview built site |
| `npm run server` | Run Express API locally |
| `npm run dev:all` | Frontend + backend together |
| `npm run copy-server` (in `functions/`) | Copy backend + gateway + filtered env for Cloud Functions |
| `firebase deploy --only hosting` | Deploy built frontend |
| `firebase deploy --only functions` | Deploy the API function |

### 17.2 Key URLs and paths

| Item | Value |
|---|---|
| Custom-domain storefront (intended) | `https://www.thehandle.in/varataaa` |
| Payment return (configured) | Return URL ends with the `#payment-return` fragment |
| Firebase project | `ecommerce-f1448` |
| Function URL (from local log) | `https://us-central1-ecommerce-f1448.cloudfunctions.net/api` |
| API health | `/api/health` |
| Firestore config doc | `_config/collections` |
| TOTD collection | `TOTD` |
| Cart storage key | `cart` (localStorage) |
| Checkout context key | `cashfree_checkout_context` (sessionStorage) |
| Consent cookie | `cookie_consent` |
| Recommendation cookies | `recently_viewed`, `you_may_also_like` |

### 17.3 Branding note

Package names (`metalflux-react`, `metalflux-functions`), alt text, and some UI labels still say **METALFLUX**, while the site title, footer, and about copy say **VARATAAA**, and the TOTD section uses **Thoughts Of The Day**. This is a legacy branding inconsistency, not a functional dependency.

---

*End of PROJECT_CONTEXT.md*
