# Admin Panel Specification (Proposed)

This document proposes an admin panel that fits the **existing** storefront and payment system. It separates:

1. **Verified facts** — confirmed from current source/config  
2. **Recommendations** — suggested design based on those facts  
3. **Decisions requiring your approval** — choices that should not be assumed

It does **not** invent live Firestore schemas beyond what write/read paths already imply, and it does not claim security guarantees that are not implemented.

Related reading: [architecture.md](architecture.md), [AGENTS.md](../AGENTS.md), [walkthrough.md](../walkthrough.md).

---

## A. Verified facts (current system)

### A.1 What exists today

- Storefront SPA only; **no admin UI** in `src/`.
- Catalog maintained by writing Firestore documents (Firebase Console / scripts). Discovery via `_config/collections` (`productCollections` / `collections` / `names`) plus base collection `products` (or `VITE_FIRESTORE_PRODUCTS_COLLECTION`).
- Fixed separate collection name: `TOTD`.
- Client Firestore: **reads** for catalog/config; **all client writes denied** by `firestore.rules`.
- Orders created only by Admin SDK in `server.cjs` after Cashfree verification (`orders` collection; doc id = Cashfree `order_id`).
- Pending checkout context in `pendingOrders`; newsletter in `newsletter`; confirmation email trigger docs in `mail` (verify path only).
- Public API routes have **no authentication**: `/api/health`, `/api/create-order`, `/api/verify-payment`, `/api/cashfree-webhook`, `/api/subscribe`.
- Firebase Auth and Firebase Storage are **not used** in application code.
- Stock fields are mapped for display; server **does not** check or decrement stock at checkout.
- Order line items store `id`, `name`, `price`, `quantity`, `image` — **not** size/color/custom design.
- Customizer cart lines use ids `custom-…` that **cannot** be resolved by `resolveProductFromFirestore` → cannot complete normal checkout.
- `firestore-upload/upload.js` is a one-off Admin stock merge utility (hardcoded collection); not part of the runtime app.
- CI deploys **Hosting only**; functions/rules are outside those workflows.
- Branch name `feature/admin-auth` does not currently contain an admin auth implementation in app source.

### A.2 Security facts that constrain any admin design

| Fact | Evidence |
|---|---|
| `orders` / `mail` client access denied | `firestore.rules` |
| Wildcard public **read** for other top-level collections | Same file — includes `pendingOrders`, `newsletter` |
| Rules file not referenced in `firebase.json` | Deploy of rules is not automated from this repo |
| No server-side admin role checks | `server.cjs` has no auth middleware |
| PII in `pendingOrders` / `newsletter` if rules are live as written | Server write shapes |

### A.3 Admin-relevant product/order contracts (from code)

**Product identity:** `` `${slugify(collectionName)}-${documentId}` `` must stay consistent on client and server.

**Checkout-critical product fields:** numeric `price` (> 0); size stock via `sizes` / `sizeStock` / `stockBySize` / `stock` or top-level `XXS`…`XXXL` fields.

**Config document:** `_config/collections` must list additional product collections or they will not be discovered (base `products` always included).

**Order statuses observed:** pending (`pendingOrders.status`), paid (`orders.status`). No shipped/refunded/cancelled lifecycle in code.

**Tax/shipping:** 18% tax, free shipping — duplicated in client checkout UI and server.

---

## B. Recommendations (not yet approved)

These are suggested directions that align with the verified architecture. They are **not** implementation tasks until you approve the decisions in §C.

### B.1 Placement and stack

- Prefer a **separate admin entry** (e.g. `/admin` hash route or a second Vite app) so storefront UX and bundle stay customer-focused.
- Prefer **Firebase Authentication** (email link or Google) + **custom claims** (e.g. `admin: true`) for identity.
- Prefer **privileged mutations via new authenticated Cloud Function / Express routes** (Admin SDK), not by opening Firestore client writes for products/orders.
- Keep Cashfree secrets and Admin private keys server-only; never introduce `VITE_` admin secrets.

### B.2 Suggested admin modules (priority order)

| Priority | Module | Why (tied to current gaps) |
|---|---|---|
| P0 | Auth gate + session | No admin exists; all privileged work must be authenticated |
| P0 | Firestore rules harden + deploy wiring | `pendingOrders` / `newsletter` public read; rules not in `firebase.json` |
| P1 | Orders list/detail (read) | Orders are Admin-only today; ops need visibility without Console |
| P1 | Product CRUD + stock edit | Catalog is Console-manual; stock unused at checkout but shown in UI |
| P1 | Collection registry editor | `_config/collections` is the discovery contract (`walkthrough.md`) |
| P2 | TOTD management | Separate collection; same product mapping |
| P2 | Newsletter export / list | Data exists via `/api/subscribe`; no UI |
| P3 | Custom order / design fulfillment | Customizer cannot checkout today |
| P3 | Refunds / status workflow | Not in codebase; needs payment + order model design |
| P3 | Asset uploads via Storage | Images today are URLs in Firestore fields; Storage unused |

### B.3 Suggested order admin capabilities (read-first)

- List `orders` newest-first; filter by date, email, `payment.paymentStatus`, `source`.
- Detail view: customer, shipping, line items, pricing, Cashfree ids, `createdAt`.
- Explicitly surface **missing variant data** (size/color) so operators know fulfillment limits of current records.
- Do **not** allow client SDK reads of `orders` without Auth + rules redesign; use admin API with claim checks.

### B.4 Suggested product admin capabilities

- Create/update/delete documents in a selected collection.
- Edit fields the mapper already understands (name/title, numeric price, images `imgN` / galleries, sizes/stock, hero, latest-drop flags, order fields).
- Validate **numeric `price`** before save (formatted strings break checkout).
- Manage `_config/collections` array with confirmation when removing a collection that still has docs.
- Preview the computed composite product id after save.

### B.5 Suggested server additions (shape only)

New routes under something like `/api/admin/*`, all requiring verified Firebase ID token + `admin` claim:

- `GET /api/admin/orders`, `GET /api/admin/orders/:id`
- `GET|PUT /api/admin/config/collections`
- `GET|POST|PATCH|DELETE /api/admin/products/:collection/:docId`
- Optional later: stock adjust, resend mail trigger, mark fulfillment status

Rate-limit and audit-log admin routes separately from public payment limiters.

### B.6 Prerequisites before building UI

1. Fix rules so `pendingOrders` and `newsletter` are not publicly readable; add `firestore` block to `firebase.json`; deploy and verify.  
2. Decide Auth provider and who receives `admin` claims (manual claim set vs allowlist).  
3. Decide whether admin is same Hosting site or separate project/site.  
4. Align Cashfree mode (client hardcoded `production` vs server `CASHFREE_API_URL`).  
5. Document the external `/varataaa` proxy contract for admin API paths if sharing the storefront origin.

### B.7 Testing / ops recommendations

- Add at least: rules unit tests (or Emulator), admin auth negative tests, and a smoke test that non-admin cannot hit `/api/admin/*`.
- Extend CI to typecheck/build; keep secrets out of PR logs.
- Automate `functions` `copy-server` via `firebase.json` predeploy when functions change.

---

## C. Decisions requiring your approval

Do not implement until you explicitly choose:

| ID | Decision | Options / notes |
|---|---|---|
| D1 | Admin hosting model | Same SPA route vs separate app/site vs Firebase Console-only process |
| D2 | Auth method | Email/password, Google, magic link, or other; MFA required or not |
| D3 | Authorization model | Custom claims only vs Firestore `admins/{uid}` vs allowlist env var |
| D4 | Mutation path | Admin SDK API only vs controlled Firestore rules for authenticated admins |
| D5 | Scope of v1 | Orders read-only first vs products+config in v1 |
| D6 | Inventory policy | Enforce stock on checkout, made-to-order (ignore stock), or reserve-on-pending |
| D7 | Variant persistence | Backfill size into cart/order payloads; required before reliable fulfillment admin |
| D8 | Customizer commerce | Dedicated custom-order API vs disable Add-to-Cart checkout vs Storage-backed designs |
| D9 | Order lifecycle | Only `paid` vs add `processing` / `shipped` / `cancelled` / `refunded` |
| D10 | Refunds | Out of scope vs Cashfree refund API integration |
| D11 | Email | Depend on Trigger Email extension vs other provider; webhook path should also mail? |
| D12 | Branding in admin | VARATAAA vs METALFLUX naming |
| D13 | Who can access production admin | Named UIDs / emails list |
| D14 | Rules deploy ownership | Add to `firebase.json` + CI vs manual Console paste |
| D15 | Admin base URL | Under `/varataaa/admin` vs root `/admin` vs separate subdomain |

---

## D. Proposed v1 scope (pending D1–D5)

**In (recommended default if you accept D5 = “orders + catalog”):**

- Admin login (Firebase Auth) + claim check  
- Orders list/detail (server-mediated)  
- Product list/edit for configured collections + TOTD  
- `_config/collections` editor  
- Rules fix for PII collections + deploy wiring  

**Out of v1 (unless you override):**

- Refunds, shipping carriers, analytics dashboards  
- Customizer design storage  
- Customer accounts on the storefront  
- Opening client write access to `orders`  

---

## E. Risks to address before implementation

| Severity | Risk | Why it blocks or endangers admin work |
|---|---|---|
| Critical | Public read of `pendingOrders` / `newsletter` (if rules match repo) | Admin work expands PII surface; fix rules first |
| Critical | No auth on API today | Any new privileged route must not ship without authz |
| High | Rules not in `firebase.json` | Admin rules changes may never reach production |
| High | Missing size/color on orders | Fulfillment admin cannot trust line items |
| High | No stock enforcement | Inventory admin edits won’t stop oversell |
| Medium | Customizer checkout broken | “Custom orders” admin module premature without commerce fix |
| Medium | Base-path / proxy mismatch | Admin API calls can 404 in local/prod if path logic wrong |
| Medium | Webhook without signature verification | Ops tooling around payments should not worsen trust model |
| Medium | Local secrets / debug logs in working tree | Rotate if exposed; never commit; never paste into admin docs |
| Low | No tests/lint | Admin auth regressions easy without Emulator tests |

---

## F. Acceptance criteria (for a future approved v1)

Only meaningful after §C decisions:

1. Unauthenticated users cannot read orders or mutate catalog via any new surface.  
2. Non-admin authenticated users are denied admin APIs and admin UI routes.  
3. Creating/updating a product with non-numeric `price` is rejected before write.  
4. Adding a collection name to `_config/collections` makes products appear in the storefront without redeploy (existing discovery behavior).  
5. `pendingOrders` and `newsletter` are not publicly readable under deployed rules.  
6. Storefront checkout regression: create-order → Cashfree → verify still works for normal catalog products.  
7. No secrets in client bundle or Git history.

---

## G. Explicit non-goals (unless you approve otherwise)

- Replacing Cashfree  
- Multi-tenant / multi-store admin  
- Full ERP / accounting  
- Assuming Trigger Email or production proxy behavior without verification  
- Documenting or embedding real credentials  

---

*End of proposed admin-panel specification. Update §C answers here when decisions are made so agents do not re-litigate them.*
