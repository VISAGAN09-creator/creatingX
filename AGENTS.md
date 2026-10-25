# AGENTS.md — Coding Agent Instructions

Shared guidance for Cursor Agent, OpenAI Codex, OpenCode, and similar tools working in this repository.

**Read this first for every task.** Open deeper docs only when the task needs them.

| Task type | Read |
|---|---|
| Architecture / data flow / integrations | [docs/architecture.md](docs/architecture.md) |
| Admin panel design or auth | [docs/admin-panel-spec.md](docs/admin-panel-spec.md) |
| Dynamic product collections | [walkthrough.md](walkthrough.md) |
| Long-form inventory (optional) | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) (untracked local audit; may drift) |

Do **not** invent Firestore schemas, API endpoints, or security guarantees. Prefer source under `src/`, `server.cjs`, `gateway/`, `functions/`, and `firestore.rules`.

---

## What this repo is

- **VARATAAA** storefront (with a separate TOTD product section): Vite + React 18 + TypeScript SPA.
- Catalog from **Firestore** (public client reads). Checkout via **Express API** (`server.cjs`) → **Cashfree** hosted checkout.
- API is exposed as Firebase Cloud Function `api` with Hosting rewrite `/api/**`.
- **No Firebase Auth, no Storage usage, no admin UI, no automated tests** in the current codebase.

Base path: Vite `base: '/varataaa/'`. Intended production mount: custom domain path `/varataaa` (external proxy; not in this repo).

Firebase project id (from `.firebaserc`): `ecommerce-f1448`.

---

## Essential architecture

```
Browser SPA (src/)
  ├─ Firestore SDK → catalog / TOTD / _config (reads only)
  ├─ fetch → /api/* (create-order, verify-payment, …)
  └─ Cashfree JS SDK → hosted checkout → #payment-return?order_id=…

Firebase Hosting (dist)
  └─ /api/** → Cloud Function `api` (functions/ wraps server.cjs)
```

| Concern | Location |
|---|---|
| App shell / page switch | `src/App.tsx` |
| Hash router | `src/hooks/useRouter.ts` |
| Cart (localStorage `cart`) | `src/hooks/useCart.ts` |
| Catalog subscriptions | `src/hooks/useCatalog.ts`, `src/data/firestoreContent.ts` |
| Domain types | `src/types.ts` |
| Firebase client init | `src/lib/firebase.ts` |
| Payment client helpers | `src/lib/paymentApi.ts`, `src/lib/paymentGateway.ts` |
| Express API | `server.cjs` |
| Payment adapters | `gateway/*.cjs` |
| Cloud Function entry | `functions/index.js` (needs `npm run copy-server` in `functions/`) |
| Security rules file | `firestore.rules` (not wired in `firebase.json`) |

**Product ID contract (client + server):** `${slugify(collectionName)}-${documentId}`. Cart size variants append `-<SIZE>`. Server strips trailing size when resolving.

**Price authority:** server reads Firestore `price` (numeric). Client amounts are not trusted. The current policy charges no additional tax and shipping is **0**; checkout display and `server.cjs` must remain aligned.

**Paid order doc id** = Cashfree `order_id` (idempotency key).

---

## Coding conventions

- Frontend: TypeScript strict, function components, relative imports, Tailwind + `metal-*` / `font-display` tokens, Framer Motion with reduced-motion respect.
- Backend: CommonJS (`.cjs`), Express 5, gateway adapter pattern (`gateway/index.cjs`).
- Prefer extending existing hooks/components over new global state libraries.
- Do not add client Firestore writes; rules deny all client writes.
- Never put secrets in `VITE_*` vars (they ship in the browser bundle).

---

## Security constraints (non-negotiable)

1. Do not print, commit, or document secret values (`.env`, service accounts, Cashfree secret, private keys, `firebase-debug.log`).
2. Server-only: `CASHFREE_SECRET_KEY`, `FIREBASE_PRIVATE_KEY`, Admin credentials.
3. `firestore.rules` currently allows **public read** of every top-level collection except `orders` and `mail` — including **`pendingOrders` and `newsletter` (PII)**. Treat as a known risk; do not widen reads.
4. There is **no auth**. Any admin surface needs Auth + server-side authorization before privileged APIs or rules.
5. Webhook `/api/cashfree-webhook` does not verify Cashfree signatures; it re-queries Cashfree before writing orders.
6. Edit `server.cjs` / `gateway/`, then run `functions` copy-server before deploying functions. `firebase.json` has **no** functions predeploy hook and **no** `firestore` rules block.

---

## Verification commands

```bash
npm install
npm run build          # tsc -b && vite build
npm run dev            # Vite (expect /varataaa/)
npm run server         # Express on :5000
npm run dev:all        # both
cd functions && npm run copy-server   # before functions deploy
```

CI (Hosting only): `.github/workflows/firebase-hosting-merge.yml` and `firebase-hosting-pull-request.yml` — `npm ci && npm run build` with `VITE_FIREBASE_*` secrets. Functions/rules are not deployed by these workflows.

There is **no** test runner, ESLint, or Prettier config in this repo. `npm run build` is the primary verification gate.

---

## Known constraints that affect new work

- Customizer cart IDs (`custom-…`) are **not** resolvable by `resolveProductFromFirestore` → checkout fails for custom tees.
- Orders store product id/name/price/qty/image; **size/color are not persisted** on the order document.
- Stock is displayed client-side; server does **not** reserve or decrement stock.
- Client Cashfree mode is hardcoded `production`; server API URL defaults to **sandbox** if `CASHFREE_API_URL` unset.
- Local Vite proxies `/api` only; under `/varataaa/` the client may call `/varataaa/api/...` (path mismatch risk).

When proposing an admin panel, follow [docs/admin-panel-spec.md](docs/admin-panel-spec.md) and get explicit approval for decisions marked there.
