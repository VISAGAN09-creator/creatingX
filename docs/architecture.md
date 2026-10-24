# Architecture Overview (Verified)

Evidence basis: source and Git-tracked config inspected on branch `feature/admin-auth` (HEAD `ea29abf`, 2026-10-20). Items not confirmed from this repository are marked **UNVERIFIED**.

No secret values are documented here—only variable **names**.

---

## 1. System summary

This repository is a single-package e-commerce **storefront SPA** plus an Express payment API deployed as a Firebase HTTPS Cloud Function.

| Layer | Stack (verified) |
|---|---|
| UI | React 18.3, TypeScript 5.7 (`strict`), Vite 5.4, Tailwind 3.4, Framer Motion 11, lucide-react |
| Routing | Custom hash router (`src/hooks/useRouter.ts`) — **not** React Router |
| Client data | Firebase JS SDK → Firestore `onSnapshot` / `getDoc` |
| Cart | React state + `localStorage` key `cart` |
| API | Express 5 in `server.cjs` (helmet, cors, express-rate-limit) |
| Payments | Cashfree REST + Cashfree JS SDK v3 CDN; adapter in `gateway/cashfree.cjs` |
| Hosting | Firebase Hosting (`dist`), rewrite `/api/**` → function `api` |
| Functions | `firebase-functions` v1 style `functions.https.onRequest` in `functions/index.js`, Node 20 |

**Absent from application code (confirmed by search):** Firebase Auth imports, Firebase Storage usage, React Context/Redux/Zustand store, test runner, ESLint/Prettier, admin UI.

Branding is inconsistent: site title/copy **VARATAAA**, packages/alt text often **METALFLUX**, section **Thoughts Of The Day (TOTD)**.

---

## 2. Topology

```text
Browser (Vite SPA, base '/varataaa/')
  │
  ├── firebase Web SDK ──► Firestore (catalog / TOTD / _config reads)
  │
  ├── fetch paymentApiPath('/create-order'|'/verify-payment'|…)
  │         │
  │         ▼
  │   Hosting rewrite /api/** ──► Cloud Function `api`
  │                                  └── Express app (server.cjs)
  │                                        ├── Admin SDK → Firestore writes
  │                                        └── gateway → Cashfree REST
  │
  └── Cashfree JS SDK ──► hosted checkout ──► return URL …#payment-return?order_id=…
```

Production comments and `paymentApi.ts` describe a custom-domain mount at `/varataaa` (referred to as a Vercel proxy for `thehandle.in`). That proxy configuration is **not in this repository** → behavior **UNVERIFIED**.

---

## 3. Important file locations

### 3.1 Frontend (`src/`)

| Path | Role |
|---|---|
| `main.tsx` | React root |
| `App.tsx` | Composition shell: `useCart` + `useCatalog` + `useRouter` → pages |
| `types.ts` | Shared `Product`, `CartLine`, `DataStatus`, etc. |
| `hooks/useRouter.ts` | Hash routes and navigation |
| `hooks/useCart.ts` | Cart mutations + localStorage |
| `hooks/useCatalog.ts` | Catalog + TOTD subscription status |
| `data/firestoreContent.ts` | Collection discovery, `toProduct`, live listeners |
| `data/siteData.ts` | Static nav/footer/features; static products are **not** the live catalog source |
| `lib/firebase.ts` | App + Firestore + Analytics init |
| `lib/paymentApi.ts` | Chooses `/api` vs `/varataaa/api` from pathname |
| `lib/paymentGateway.ts` | Load Cashfree SDK; `openCheckout` (mode `'production'`) |
| `components/*` | Storefront UI (home sections, drawers, product pages, checkout, payment return) |
| `features/tshirt-customizer/*` | Custom tee mockup studio |
| `styles/globals.css` | Tailwind entry + design tokens |
| `utils/*` | cookies, format (INR), slugify, scroll |

### 3.2 Backend / platform (repo root)

| Path | Role |
|---|---|
| `server.cjs` | Full Express API (source of truth for local + functions copy) |
| `gateway/index.cjs` | Adapter registry (`PAYMENT_GATEWAY`); only `cashfree` registered |
| `gateway/cashfree.cjs` | Create/verify Cashfree orders |
| `functions/index.js` | `exports.api = functions.https.onRequest(app)` |
| `functions/copy-server.js` | Copies `server.cjs`, `gateway/`, filtered `.env` into `functions/` |
| `firebase.json` | Hosting + functions; **no** `firestore` block; **no** predeploy |
| `firestore.rules` | Client rules file (deploy wiring missing — see §7) |
| `.firebaserc` | Default project `ecommerce-f1448` |
| `.github/workflows/firebase-hosting-*.yml` | Hosting build/deploy only |
| `firestore-upload/` | Standalone Admin script (not runtime); hardcodes a collection name |
| `walkthrough.md` | `_config/collections` admin setup notes |

---

## 4. Frontend architecture

### 4.1 Composition

`App` wires three hooks and selects a page from `router.activePage`. No global store. Cross-page persistence:

- `localStorage['cart']`
- cookies: consent / recommendations (`cookie_consent`, `recently_viewed`, `you_may_also_like`)
- `sessionStorage['cashfree_checkout_context']` (checkout display after redirect)
- URL hash for navigation

**Doc inconsistency:** `App.tsx` comments claim `useCart` has “cookie persistence, Firestore sync”. Implementation uses **localStorage only** and does not sync the cart to Firestore.

### 4.2 Routing (hash)

| Hash | `activePage` | UI |
|---|---|---|
| (default / other) | `home` | Hero, LatestDrop, Collections, Lookbook, Customize teaser, About |
| `#products` | `products` | `ProductViewingPage` |
| `#product-<id>` | `productDetail` | `ProductDetailsPage` or `TOTDProductDetailsPage` |
| `#totd` | `totd` | `TOTD` |
| `#customize` | `customize` | `TShirtCustomizer` |
| `#checkout` | `checkout` | `CheckoutPage` (navbar/footer hidden) |
| `#payment-return?order_id=…` | `paymentReturn` | `PaymentReturnPage` |

`productReturnPage` is in-memory only (not encoded in the URL).

### 4.3 Catalog data flow

1. `discoverCollectionNames()` reads `_config/collections` fields `productCollections` | `collections` | `names`.
2. Always appends `VITE_FIRESTORE_PRODUCTS_COLLECTION` (default `products`).
3. `subscribeToProducts` attaches `onSnapshot` per collection, merges, sorts by `order`.
4. `subscribeToTOTD` listens to fixed collection name `TOTD` separately.
5. Product id: `` `${slugify(collectionName)}-${documentId}` `` (`src/utils/string.ts` / server mirror in `server.cjs`).

Product field mapping is intentionally alias-rich in `toProduct()` (see `firestoreContent.ts`). Notable rules:

- `theme` / collection label is derived from the **Firestore collection name**, not a `theme` field.
- `price` may display via `priceLabel` / string `price`, but checkout server requires `Number(price)` finite and > 0.
- If no size data exists, `sizeFields()` still yields eight sizes at stock `0` (product appears out of stock).

`VITE_FIRESTORE_LOOKBOOK_COLLECTION` is declared; lookbook mapping helpers exist, but the live Lookbook UI uses catalog products — lookbook subscription path is effectively unused for the main UI.

### 4.4 Cart

- Add merges by line `id`; size variants use ids like `{productId}-{SIZE}`.
- Customizer creates `custom-{style}-{color}-{garmentSize}-{timestamp}`.
- No stock checks, no server cart, no price revalidation until checkout API.

### 4.5 Customizer

Browser-only designs (`URL.createObjectURL`); presets are inline SVG data URIs. Pricing UI uses base 599 INR + 150 acid wash. Export downloads SVG from the mockup DOM. The “3D” viewer is SVG/CSS, not WebGL/Three.js.

---

## 5. Backend API and payment flow

### 5.1 Endpoints (`server.cjs`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Status + active gateway name |
| `POST` | `/api/create-order` | Validate items, resolve products/prices from Firestore, create Cashfree order, write `pendingOrders` |
| `POST` | `/api/verify-payment` | Body `{ orderId }`; verify with Cashfree; write `orders`; enqueue `mail`; delete pending |
| `POST` | `/api/cashfree-webhook` | Alternate paid-order path; re-verifies with Cashfree; **no** mail enqueue |
| `POST` | `/api/subscribe` | Newsletter email → `newsletter` (no frontend caller found) |

Middleware: `helmet()`, CORS allowlist (`CORS_ALLOWED_ORIGINS` + localhost Vite ports), JSON 100kb, general rate limit 100/15min/IP on `/api/`, stricter 10/15min on create/verify.

**No authentication middleware** on any route.

### 5.2 Create → pay → verify

1. Client posts `{ items: [{id, quantity}], customer, shipping }` (no client amount).
2. Server `resolveProductFromFirestore` (config collections + `products` + `TOTD`, strip trailing size).
3. Charge the authoritative product subtotal; additional tax and shipping are currently 0.
4. Cashfree order created; pending doc id = Cashfree `order_id`.
5. Client `cashfree.checkout({ paymentSessionId, redirectTarget: '_self' })`.
6. Return to `#payment-return?order_id=…`; `PaymentReturnPage` posts verify.
7. Server requires Cashfree status `PAID` + non-empty transaction id; amount must match pending total; `orders/{order_id}.create()` for idempotency.

Webhook path: ignores non-success; does not check webhook signature; still calls `gateway.verifyPayment`; writes order with `source: 'webhook'`; returns HTTP 200 even on processing errors (to limit Cashfree retries).

### 5.3 Firestore collections touched by code

| Collection | Client read | Client write | Server write | Purpose |
|---|---|---|---|---|
| `_config` (`collections` doc) | Yes | No | No (manual) | Product collection list |
| Configured product collections + `products` | Yes | No | No | Catalog |
| `TOTD` | Yes | No | No | TOTD catalog |
| `pendingOrders` | Allowed by rules file (see §7) | No | Yes | Checkout context |
| `orders` | Denied | Denied | Yes | Paid orders |
| `mail` | Denied | Denied | Yes | Email trigger docs (verify path) |
| `newsletter` | Allowed by rules file | No | Yes | Subscribers |

Actual live document contents in the Firebase project are **UNVERIFIED** from this repo alone.

### 5.4 Order document shapes (from write paths)

**`pendingOrders/{cashfreeOrderId}`** includes: items (`productId`, `name`, `price`, `quantity`, `lineTotal`, `image`), `subtotalAmount`, `taxAmount` (0 for current orders; retained for historical compatibility), `totalAmount`, `customer`, `shipping`, `status: 'pending'`, `createdAt`, Cashfree ids.

**`orders/{cashfreeOrderId}`** includes: `customer` (email, first/last name, phone), `shipping`, `items` (id, name, price, quantity, image), `pricing`, `payment`, `status: 'paid'`, `createdAt`, optional `source: 'webhook'`.

Size/color/custom design metadata are **not** written on these documents.

---

## 6. Authentication and authorization

| Mechanism | Status |
|---|---|
| Firebase Auth (client) | Not imported / not used |
| Server auth (JWT, API keys for clients, session cookies) | Not implemented |
| Admin role / custom claims | Not implemented |
| Checkout “Sign in” | UI toast: “Sign in modal coming soon” |
| Firestore client writes | Denied (`allow write: if false`) |
| Privileged writes | Firebase Admin SDK in `server.cjs` only |

Branch name `feature/admin-auth` does not, by itself, imply admin auth code exists; verify against diffs when implementing.

---

## 7. Firestore security rules

File: `firestore.rules`.

Effective pattern:

- Wildcard: read allowed if collection ≠ `orders` and ≠ `mail`; write always false.
- Explicit blocks also deny all on `orders` and `mail`.
- `_config` explicitly readable.

**Consequence:** `pendingOrders` and `newsletter` are **readable by any client** under this file (PII exposure). Nested subcollections are not matched by this wildcard and would deny by default.

**Deploy gap:** `firebase.json` has no `"firestore": { "rules": "firestore.rules" }`. A normal `firebase deploy` from this config will **not** publish these rules. Whether production matches this file is **UNVERIFIED**.

---

## 8. Deployment, env vars, CI

### 8.1 Commands

```bash
npm install
npm run build          # tsc -b && vite build → dist/
npm run dev            # Vite; base /varataaa/
npm run server         # node server.cjs; PORT default 5000
npm run dev:all
cd functions && npm install && npm run copy-server
firebase deploy --only hosting    # after build
firebase deploy --only functions  # after copy-server
```

`functions/index.js` comments refer to a predeploy copy; **`firebase.json` does not define a predeploy hook** — copy is manual.

### 8.2 Client / build env (`VITE_*`)

Embedded in the browser bundle:

- `VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`, `MEASUREMENT_ID`
- `VITE_FIRESTORE_PRODUCTS_COLLECTION` (optional, default `products`)
- `VITE_FIRESTORE_LOOKBOOK_COLLECTION` (optional; unused by live Lookbook UI)
- `VITE_HERO_POSTER_URL`, `VITE_HERO_VIDEO_URL` (optional overrides)

### 8.3 Server / function env

- `FIREBASE_PROJECT_ID` (or `VITE_FIREBASE_PROJECT_ID`), `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — local Admin init
- Cloud Functions: Application Default Credentials when `FUNCTION_TARGET` or `K_SERVICE` set
- `PAYMENT_GATEWAY` (expected `cashfree`)
- `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_API_VERSION` (default `2025-01-01`), `CASHFREE_API_URL` (default **sandbox** URL)
- `CORS_ALLOWED_ORIGINS`, `PAYMENT_RETURN_URL`, `PORT`

`functions/copy-server.js` filters out lines starting with `FIREBASE_` when copying `.env`.

### 8.4 GitHub Actions

- Push `main` → build with seven `VITE_FIREBASE_*` secrets → Hosting live (`FIREBASE_SERVICE_ACCOUNT_ECOMMERCE_F1448`)
- PR → preview channel deploy (same build secrets)

Neither workflow deploys Cloud Functions or Firestore rules, nor injects Cashfree/Admin secrets.

### 8.5 Base-path / proxy coupling

- Built assets referenced under `/varataaa/…`.
- `paymentApiPath()` uses `/varataaa/api` when pathname is under `/varataaa`.
- Hosting rewrite is `/api/**` only (not `/varataaa/api/**`).
- Vite dev proxy is `/api` → `:5000` only.

Implication: production payments likely depend on an external path strip; Firebase default hosting URL and local checkout paths may break without matching proxy/proxy rules. Runtime confirmation **UNVERIFIED**.

---

## 9. UI conventions, errors, testing

### 9.1 UI

- Fonts: Space Grotesk + Syne (Google Fonts in `index.html`).
- Tokens: `metal.*` colors, `max-w-shell`, high-contrast black/white aesthetic.
- Motion: Framer Motion; globals.css reduces motion when preferred.
- Reusable pieces: `Reveal`, `Magnetic`, `SmartImage`, `SectionHeader`, drawers, toast patterns on checkout/footer.
- Status model: `DataStatus = 'loading' | 'ready' | 'error'` for catalog surfaces.

### 9.2 Error handling

- Catalog: first-snapshot resilience (errors after a successful snapshot do not wipe UI).
- Checkout/payment: try/catch + toast; API responses must be JSON.
- Server: JSON `{ success, message, … }`; webhook always 200.
- No React error boundary found.

### 9.3 Testing

No `*.test.*` / `*.spec.*` files, no Vitest/Jest/Playwright/Cypress dependencies, no lint script. Primary gate: `npm run build`.

---

## 10. External integrations

| Integration | Verified usage |
|---|---|
| Cloud Firestore | Catalog reads; server order/mail/newsletter writes |
| Firebase Hosting | Serves `dist` |
| Cloud Functions | Hosts Express `api` |
| Firebase Analytics | `getAnalytics` initialized; no explicit event logging found |
| Cashfree | Order create, verify, webhook, client checkout |
| Email | Writes to `mail` collection; Trigger Email extension install **UNVERIFIED** |
| Google Fonts / Unsplash / Wikimedia / Maps / Instagram | Static/marketing assets and footer |

Firebase Auth / Storage: **not integrated** in app code (Storage packages may exist transitively via `firebase`).

---

## 11. Documentation inconsistencies

| Claim / location | Actual code |
|---|---|
| `App.tsx` comment: cart “cookie persistence, Firestore sync” | `useCart` uses localStorage only |
| `functions/index.js`: “predeploy script copies…” | No `predeploy` in `firebase.json`; manual `copy-server` |
| `firestore.rules` comments: “catalog collections” public read | Wildcard allows **all** non-`orders`/`mail` collections |
| Package/UI “METALFLUX” vs title “VARATAAA” | Branding mismatch, not a functional split |
| `walkthrough.md` env cleanup | Matches current discovery via `_config/collections` |
| Empty tracked stubs | `README.md`, `docs/data-model.md`, `docs/implementation-plan.md`, `.cursor/rules/*.mdc` were empty at audit time |
| Branch `feature/admin-auth` | No Auth/admin implementation found in app source |

---

## 12. Explicitly unverified

1. Deployed Firestore rules vs `firestore.rules`.
2. Whether Firebase Trigger Email (or equivalent) consumes `mail`.
3. External `/varataaa` reverse-proxy behavior.
4. Whether live Cloud Function matches current `server.cjs`.
5. Whether `https://ecommerce-f1448.web.app/` works with asset base `/varataaa/`.
6. Local checkout under Vite `/varataaa/` + `/varataaa/api` proxy gap.
7. Production vs sandbox Cashfree mode actually configured at runtime.
8. Live inventory documents and collection names in the Firebase project.
9. Admin tooling outside this repository.

For agent operating rules and verification commands, see [AGENTS.md](../AGENTS.md). For a proposed admin surface grounded in this architecture, see [admin-panel-spec.md](admin-panel-spec.md).
