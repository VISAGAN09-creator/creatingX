# Architecture and audit scope

VARATAAA is a Firebase-backed ecommerce SPA for anonymous shoppers and authenticated administrators. Shoppers read a public Firestore catalog, keep a cart in browser storage, request server-generated checkout quotes, create Razorpay Checkout orders, return with an order ID, and subscribe email addresses. Administrators authenticate with Firebase email/password and a custom `admin: true` claim, then use bearer-token API routes to manage orders, fulfillment, walk-in sales, and inventory. Operators also have local scripts for bulk catalog uploads and assigning admin claims.

The frontend is React 18 and strict TypeScript built by Vite under the `/varataaa/` base. The backend is CommonJS Express 5 with Helmet, CORS, rate limiting, Firebase Admin, Razorpay REST calls, postal PIN lookup, and Gmail SMTP. Firebase Hosting serves `dist/` and rewrites both API prefixes to the `api` Cloud Function. A predeploy script copies the root server, shipping logic, gateway adapters, and filtered environment material into `functions/`. GitHub workflows build and deploy Hosting live or to preview channels; they do not deploy Functions or Firestore rules.

Trust boundaries:

- Anonymous HTTP callers cross into Firebase Admin authority at public quote, create-order, verify-payment, webhook, PIN, health, and newsletter routes. JSON is limited to 100 KB and routes are IP-rate-limited.
- Admin callers cross into order and catalog write authority only after Firebase ID-token signature/revocation verification and an exact Boolean admin claim.
- The server crosses into Razorpay, Firestore, postal lookup, and SMTP using operator credentials. Razorpay payment status is re-queried server-side before paid-order persistence.
- Public Firestore rules deny all client writes and explicitly deny reads of orders, pending orders, newsletter, mail, and fulfillment mirrors, while allowing reads of other top-level collections.
- Browser URL/hash, localStorage, sessionStorage, Firestore catalog documents, Storage asset paths, and local customizer PNG files are lower-trust inputs rendered or processed in the SPA.
- CI executes repository code and deploys Hosting using a Firebase service-account secret. Branch protection, same-repository contributor authority, environment approvals, and IAM scope are outside source.

The comparable baseline is a conventional public catalog storefront with server-authoritative prices and a hosted payment gateway. Its intentional tradeoff is anonymous checkout; order ownership and payment lifecycle controls therefore have to be enforced with order-bound secrets, provider verification, and durable idempotency rather than user sessions.

Important paths are `server.cjs`, `gateway/`, `src/components/CheckoutPage.tsx`, `src/components/PaymentReturnPage.tsx`, `src/hooks/useAdminAuth.ts`, `src/lib/adminApi.ts`, `src/data/firestoreContent.ts`, `firestore.rules`, `firebase.json`, `functions/`, `.github/workflows/`, `firestore-upload/`, and `tools/`.

This is a standard full-source profile of the current dirty worktree at commit `ed147216e75fb8a45374d9c94d3825f31c241ab5`. The installed audit skill and generated `security-audit/` output are not application runtime surfaces. A prior incomplete run was read; its two confirmations were not carried as confirmed because they lacked bounded local observed results. Its source traces and validation leads remain current work.

Target-controlled execution is blocked: this Windows environment cannot simultaneously provide an empty allowlisted environment, loopback-only network namespace, read-only target/toolchain, scratch-only writes, explicit resource limits, and race-safe artifact promotion. No build, test, server, browser, provider, or deployed endpoint is run. Relevant companions are HTTP/auth, client/browser, cloud/deployment, protocol/webhook, availability, data lifecycle, and supply chain/release.
