const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('node:crypto');
require('dotenv').config();
const admin = require('firebase-admin');
const gateway = require('./gateway/index.cjs');

let db = null;

try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (privateKey && clientEmail && projectId) {
    console.log('[Firebase] Initializing Admin SDK using environment variables.');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // .env files encode literal "\n" as two characters; convert to real newlines.
        privateKey: privateKey.replace(/\\n/g, '\n'),
      })
    });
    db = admin.firestore();
  } else if (process.env.FUNCTION_TARGET || process.env.K_SERVICE) {
    // Running inside Firebase Cloud Functions — use Application Default Credentials
    console.log('[Firebase] Initializing Admin SDK using default credentials (Cloud Functions).');
    admin.initializeApp();
    db = admin.firestore();
  } else {
    const missing = [
      !privateKey && 'FIREBASE_PRIVATE_KEY',
      !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      !projectId && 'FIREBASE_PROJECT_ID',
    ].filter(Boolean);
    console.warn(`[Firebase Warning] Missing environment variables: ${missing.join(', ')}`);
    console.warn('[Firebase Warning] Server-side database writes (orders, emails) will fail.');
    console.warn('[Firebase Warning] Add these variables to your .env file. See .env for instructions.');
  }
} catch (error) {
  console.error('[Firebase Error] Failed to initialize Firebase Admin SDK:', error);
}


const app = express();
const { normalizeState, shippingCharge, lookupPin } = require('./shipping.cjs');
app.use(helmet());
const PORT = process.env.PORT || 5000;

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Builds the amount passed to Razorpay from server-resolved line totals only.
 * Client-request totals are intentionally not part of this contract.
 */
function calculateCheckoutPricing(resolvedItems, shippingAmount = 0) {
  const normalizedShipping = Number(shippingAmount);
  if (!Number.isFinite(normalizedShipping) || normalizedShipping < 0) {
    throw new Error('Shipping amount must be a non-negative number.');
  }

  const subtotalAmount = roundCurrency(
    resolvedItems.reduce((sum, item) => sum + Number(item.lineTotal), 0),
  );
  const taxAmount = 0;
  const roundedShippingAmount = roundCurrency(normalizedShipping);
  const totalAmount = roundCurrency(subtotalAmount + roundedShippingAmount);

  return { subtotalAmount, taxAmount, shippingAmount: roundedShippingAmount, totalAmount };
}

/** Firestore rejects undefined values, so optional order-item fields are omitted. */
function withoutUndefinedProperties(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function pendingOrderItem(item) {
  return withoutUndefinedProperties({
    productId: item.productId,
    firestoreDocId: item.firestoreDocId,
    collectionName: item.collectionName,
    couple: item.couple,
    independentCoupleStock: item.independentCoupleStock,
    selectedSize: item.selectedSize,
    selectedMensSize: item.selectedMensSize,
    selectedWomensSize: item.selectedWomensSize,
    selectedColor: item.selectedColor,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    image: item.image,
  });
}

function paidOrderItem(item) {
  const selectedSize = normalizeSize(item.selectedSize);
  const mensSize = normalizeSize(item.selectedMensSize);
  const womensSize = normalizeSize(item.selectedWomensSize);
  const color = sanitizeString(item.selectedColor, 100);

  return withoutUndefinedProperties({
    id: sanitizeString(item.productId || item.id, 100),
    name: sanitizeString(item.name, 200),
    ...(selectedSize ? { size: selectedSize } : {}),
    ...(item.couple === true ? { couple: true } : {}),
    ...(mensSize ? { mensSize } : {}),
    ...(womensSize ? { womensSize } : {}),
    ...(color ? { color } : {}),
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
    image: sanitizeString(item.image, 2000),
  });
}

function walkInOrderId(clientRequestId) {
  return `walkin-${crypto.createHash('sha256').update(clientRequestId).digest('hex').slice(0, 32)}`;
}

function walkInCustomer(value) {
  const name = sanitizeString(value?.name, 200).replace(/\s+/g, ' ');
  const email = sanitizeString(value?.email, 254).toLowerCase();
  const phone = typeof value?.phone === 'string' ? value.phone.trim() : '';
  if (!name) return { valid: false, message: 'Customer name is required.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, message: 'Provide a valid customer email address.' };
  if (phone && !/^\d{10}$/.test(phone)) return { valid: false, message: 'Customer phone must contain exactly 10 digits.' };
  return {
    valid: true,
    customer: {
      name,
      email,
      phone,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' '),
    },
  };
}

function walkInShipping(value) {
  const delivery = sanitizeString(value?.delivery ?? value?.address, 1000).replace(/\s+/g, ' ').trim();
  if (!delivery) return { valid: false, message: 'Complete delivery address is required.' };
  return { valid: true, shipping: { address: delivery } };
  /*
  const fields = ['doorNo', 'addressLine1', 'addressLine2', 'city', 'state', 'pinCode', 'country'];
  const shipping = Object.fromEntries(fields
    .map((field) => [field, sanitizeString(value[field], 200)])
    .filter(([, fieldValue]) => fieldValue));
  const required = ['doorNo', 'addressLine1', 'city', 'state', 'pinCode', 'country'];
  if (required.some((field) => !shipping[field])) return { valid: false, message: 'Door number, address line, city, state, PIN code, and country are required.' };
  if (!/^\d{6}$/.test(shipping.pinCode)) return { valid: false, message: 'PIN code must contain exactly 6 digits.' };
  return { valid: true, shipping };
  */
}

function walkInPayment(value) {
  const method = value?.method === 'other' ? 'other' : value?.method === 'cash' ? 'cash' : '';
  const status = 'paid';
  const otherMethod = sanitizeString(value?.otherMethod, 100);
  if (!method) return { valid: false, message: 'Choose Cash or Other as the payment method.' };
  if (method === 'other' && !otherMethod) return { valid: false, message: 'Enter the actual payment method.' };
  if (value?.received !== true) return { valid: false, message: 'Confirm that payment has been received before creating the order.' };
  return { valid: true, method, otherMethod: method === 'other' ? otherMethod : '', status };
}

// ============================================================================
// CORS CONFIGURATION — SECURITY HARDENED
// ============================================================================
// IMPORTANT: When you deploy to production, set the CORS_ALLOWED_ORIGINS
// environment variable to your real domain(s), comma-separated. Example:
//   CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
//
// For local development, localhost origins on Vite's default ports are allowed.
// ============================================================================

const ALLOWED_ORIGINS = (() => {
  // --- PRODUCTION: set this env var with your real hosted URL(s) ---
  // e.g. CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;

  // Default localhost origins for development (Vite dev server ports)
  const devOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
  ];

  if (envOrigins) {
    // Merge production origins with dev origins (dev origins are harmless in prod)
    const prodOrigins = envOrigins.split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean);
    return [...new Set([...prodOrigins, ...devOrigins])];
  }

  return devOrigins;
})();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked request from disallowed origin: ${origin}`);
    return callback(new Error(`CORS policy: Origin '${origin}' is not allowed.`));
  },
  methods: ['GET', 'POST'],           // Only methods your API actually uses
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,                  // Set to true if you add cookie-based auth later
  maxAge: 86400,                       // Cache preflight for 24h to reduce OPTIONS calls
}));
// Razorpay signs the exact webhook bytes. Parse this route as a Buffer before
// the JSON middleware; the handler verifies the signature before decoding it.
app.use(['/api/razorpay-webhook', '/varataaa/api/razorpay-webhook'], express.raw({ type: 'application/json', limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

// The storefront is also served behind a /varataaa reverse-proxy mount. The
// Firebase Hosting rewrite forwards that mounted path unchanged to this
// function, while the application routes are defined under /api. Normalize
// the prefix before rate limiting and route matching so both public URLs share
// the same authentication and handlers.
app.use((req, res, next) => {
  req.url = req.url.replace(/^\/varataaa(?=\/|$)/, '');
  next();
});

// ============================================================================
// RATE LIMITING — ABUSE PREVENTION
// ============================================================================
// Prevents:
//  • Spamming order creations (exhausts API quota / incurs costs)
//  • Brute-forcing payment verification
//  • Firestore write-cost spikes from repeated verify calls
// ============================================================================

// General API rate limit: 100 requests per 15-minute window per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,    // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,     // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

// Strict payment endpoint limit: 10 requests per 15-minute window per IP
// This is intentionally aggressive — a legitimate user makes at most
// 1-2 order+verify calls per checkout session.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Payment request limit exceeded. Please try again after 15 minutes.',
  },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Administrator request limit exceeded. Please try again later.',
  },
});

// Apply general limiter to all /api/ routes
app.use('/api/', apiLimiter);

// Apply stricter limiter specifically to payment-sensitive endpoints
app.use('/api/create-order', paymentLimiter);
app.use('/api/verify-payment', paymentLimiter);
// Keep all current and future administrator endpoints behind the same token
// and role verification boundary.
app.use('/api/admin', adminLimiter, requireAdmin);

/**
 * Verify a Firebase ID token and the server-authoritative custom admin claim.
 * Every future /api/admin route must keep this middleware before its handler.
 */
async function requireAdmin(req, res, next) {
  const authorization = req.get('authorization');
  const match = authorization && authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ success: false, message: 'Administrator authentication is required.' });
  }

  if (!admin.apps.length) {
    return res.status(503).json({ success: false, message: 'Administrator authentication is not configured on this server.' });
  }

  try {
    // checkRevoked=true rejects expired and revoked sessions even if a client
    // still presents an otherwise correctly signed token.
    const decodedToken = await admin.auth().verifyIdToken(match[1], true);
    if (decodedToken.admin !== true) {
      return res.status(403).json({ success: false, message: 'Administrator access is required.' });
    }

    req.adminUser = decodedToken;
    return next();
  } catch (error) {
    const code = error && error.code;
    console.warn(`[Admin Auth] Rejected administrator token${code ? ` (${code})` : ''}.`);
    return res.status(401).json({ success: false, message: 'Administrator session is invalid or has expired.' });
  }
}

const FULFILLMENT_STATUSES = Object.freeze(['production', 'out_for_delivery', 'delivered']);
const FULFILLMENT_COLLECTIONS = Object.freeze({
  production: 'orders_production',
  out_for_delivery: 'orders_out_for_delivery',
  delivered: 'orders_delivered',
});

// These are the storefront's supported garment sizes. Inventory never creates
// one of these fields implicitly: a size is editable only when it is already
// configured in the product document's existing stock representation.
const SUPPORTED_SIZES = Object.freeze(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']);

function normalizeSize(value) {
  const size = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return SUPPORTED_SIZES.includes(size) ? size : null;
}

function isCoupleProduct(data) {
  if (data?.couple === true || data?.couple === 1) return true;
  return typeof data?.couple === 'string' && ['yes', 'true', '1'].includes(data.couple.trim().toLowerCase());
}

function inventoryQuantity(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value !== 'string') return 0;
  const normalized = value.trim().toLowerCase();
  if (['out', 'out of stock', 'sold out', 'unavailable'].includes(normalized)) return 0;
  const parsed = Number(normalized.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function recordValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function documentVersion(snapshot) {
  const updateTime = snapshot?.updateTime;
  if (!updateTime) return null;
  return `${updateTime.seconds}.${String(updateTime.nanoseconds).padStart(9, '0')}`;
}

/**
 * Maps the stock shapes already accepted by the storefront to a safe, minimal
 * update operation. String-only size lists are intentionally read-only: they
 * declare variants but provide no unambiguous field in which to store stock.
 */
function stockAdapter(data, fields = ['sizes', 'sizeStock', 'stockBySize', 'stock']) {
  const empty = { quantities: {}, configured: new Set(), editable: false, kind: 'none', field: null };

  for (const field of fields) {
    const value = data?.[field];
    if (Array.isArray(value)) {
      const entries = [];
      const quantities = {};
      const configured = new Set();
      let editable = true;

      value.forEach((entry, index) => {
        const item = recordValue(entry);
        const size = normalizeSize(item?.name ?? item?.size ?? item?.label ?? entry);
        if (!size) return;
        if (!item) {
          configured.add(size);
          quantities[size] = 0;
          editable = false;
          return;
        }
        const quantityKey = ['stock', 'quantity', 'qty', 'available'].find((key) => Object.prototype.hasOwnProperty.call(item, key));
        configured.add(size);
        quantities[size] = inventoryQuantity(quantityKey ? item[quantityKey] : 0);
        if (!quantityKey) editable = false;
        entries.push({ index, size, quantityKey });
      });

      if (configured.size > 0) return { quantities, configured, editable, kind: 'array', field, entries };
    }

    const map = recordValue(value);
    if (map) {
      const quantities = {};
      const configured = new Set();
      const entries = {};
      let editable = true;

      Object.entries(map).forEach(([key, entry]) => {
        const size = normalizeSize(key);
        if (!size) return;
        const nested = recordValue(entry);
        const quantityKey = nested && ['stock', 'quantity', 'qty', 'available'].find((name) => Object.prototype.hasOwnProperty.call(nested, name));
        configured.add(size);
        quantities[size] = inventoryQuantity(quantityKey ? nested[quantityKey] : entry);
        if (nested && !quantityKey) editable = false;
        entries[size] = { key, quantityKey };
      });

      if (configured.size > 0) return { quantities, configured, editable, kind: 'map', field, entries };
    }

    if (typeof value === 'string') {
      const configured = new Set(value.split(/[,|/;]+/).map(normalizeSize).filter(Boolean));
      if (configured.size > 0) return { ...empty, configured, kind: 'declared-only', field };
    }
  }

  // Top-level fields are part of the legacy standard-product schema only.
  if (fields[0] !== 'sizes') return empty;
  const quantities = {};
  const configured = new Set();
  SUPPORTED_SIZES.forEach((size) => {
    if (Object.prototype.hasOwnProperty.call(data || {}, size)) {
      configured.add(size);
      quantities[size] = inventoryQuantity(data[size]);
    }
  });
  if (configured.size > 0) return { quantities, configured, editable: true, kind: 'top-level', field: null };
  return empty;
}

function stockSummary(data) {
  return stockSummaryFor(data, ['sizes', 'sizeStock', 'stockBySize', 'stock']);
}

function stockSummaryFor(data, fields) {
  const adapter = stockAdapter(data, fields);
  return {
    schema: adapter.kind,
    editable: adapter.editable,
    sizes: Object.fromEntries(SUPPORTED_SIZES.map((size) => [size, adapter.configured.has(size) ? adapter.quantities[size] ?? 0 : null])),
  };
}

function coupleStockAdapters(data) {
  const standard = stockAdapter(data);
  return {
    mens: stockAdapter(data, ['mensSizes', 'mensSizeStock']),
    womens: stockAdapter(data, ['womensSizes', 'womensSizeStock']),
    // Existing couple documents use one shared inventory map and retain their
    // current behaviour until they are explicitly migrated.
    legacy: !data?.mensSizes && !data?.womensSizes ? standard : null,
  };
}

function applyStockChanges(data, adapter, changes) {
  if (!adapter.editable) {
    const error = new Error('This product declares sizes but has no editable stock field.');
    error.code = 'stock-schema-readonly';
    throw error;
  }

  for (const size of Object.keys(changes)) {
    if (!adapter.configured.has(size)) {
      const error = new Error(`${size} is not configured for this product.`);
      error.code = 'size-not-configured';
      throw error;
    }
  }

  if (adapter.kind === 'top-level') return { ...changes };
  if (adapter.kind === 'map') {
    const next = { ...data[adapter.field] };
    Object.entries(changes).forEach(([size, quantity]) => {
      const entry = adapter.entries[size];
      const current = next[entry.key];
      next[entry.key] = entry.quantityKey ? { ...current, [entry.quantityKey]: quantity } : quantity;
    });
    return { [adapter.field]: next };
  }
  if (adapter.kind === 'array') {
    const next = [...data[adapter.field]];
    Object.entries(changes).forEach(([size, quantity]) => {
      const entry = adapter.entries.find((candidate) => candidate.size === size);
      next[entry.index] = { ...next[entry.index], [entry.quantityKey]: quantity };
    });
    return { [adapter.field]: next };
  }

  const error = new Error('This product has no editable stock field.');
  error.code = 'stock-schema-readonly';
  throw error;
}

function isFulfillmentStatus(value) {
  return typeof value === 'string' && FULFILLMENT_STATUSES.includes(value);
}

function fulfillmentStatusFromOrder(order) {
  // Paid orders written before fulfillment tracking are safely treated as
  // production orders. Their canonical payment record remains unchanged.
  return isFulfillmentStatus(order?.fulfillmentStatus) ? order.fulfillmentStatus : 'production';
}

function fulfillmentOrderRef(status, orderId, database = db) {
  return database.collection(FULFILLMENT_COLLECTIONS[status]).doc(orderId);
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
}

function timestampSortValue(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  return 0;
}

function adminOrderResponse(orderId, order) {
  return {
    orderId,
    orderType: order.orderType || 'online',
    customer: order.customer || {},
    shipping: order.shipping || {},
    items: Array.isArray(order.items) ? order.items : [],
    pricing: order.pricing || {},
    payment: order.payment || {},
    paymentStatus: order.payment?.paymentStatus || order.status || null,
    fulfillmentStatus: fulfillmentStatusFromOrder(order),
    createdAt: timestampToIso(order.createdAt),
  };
}

/**
 * Canonical paid orders must remain in /orders because payment return-page
 * verification and webhooks use that document ID as their idempotency key.
 * The three fulfillment collections are server-managed mirrors. A transaction
 * keeps exactly one current mirror while preserving the canonical order.
 */
function inventoryGroups(items) {
  const groups = new Map();
  for (const item of items || []) {
    const collectionName = typeof item?.collectionName === 'string' ? item.collectionName : '';
    const documentId = typeof item?.firestoreDocId === 'string' ? item.firestoreDocId : '';
    const quantity = Number(item?.quantity);
    const selections = item?.couple
      ? [
          { role: 'mens', size: normalizeSize(item?.selectedMensSize) },
          { role: 'womens', size: normalizeSize(item?.selectedWomensSize) },
        ]
      : [{ role: 'standard', size: normalizeSize(item?.selectedSize) }];
    if (!collectionName || !documentId || selections.some(({ size }) => !size) || !Number.isSafeInteger(quantity) || quantity < 1) {
      const error = new Error('Order inventory details are incomplete.');
      error.code = 'inventory-invalid-order';
      throw error;
    }
    const key = `${collectionName}\u0000${documentId}`;
    const group = groups.get(key) || { collectionName, documentId, quantities: { standard: {}, mens: {}, womens: {} } };
    for (const { role, size } of selections) {
      group.quantities[role][size] = (group.quantities[role][size] || 0) + quantity;
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

async function createPaidOrderWithFulfillment(orderId, orderData, inventoryItems = [], database = db) {
  const orderRef = database.collection('orders').doc(orderId);
  const now = new Date().toISOString();
  const completedOrder = {
    ...orderData,
    fulfillmentStatus: 'production',
    fulfillmentUpdatedAt: now,
  };

  return database.runTransaction(async (transaction) => {
    const existing = await transaction.get(orderRef);
    if (existing.exists) {
      return { created: false, order: existing.data() };
    }

    const groups = inventoryGroups(inventoryItems);
    const stockDocuments = await Promise.all(groups.map(async (group) => ({
      group,
      ref: database.collection(group.collectionName).doc(group.documentId),
      snapshot: await transaction.get(database.collection(group.collectionName).doc(group.documentId)),
    })));

    for (const stockDocument of stockDocuments) {
      if (!stockDocument.snapshot.exists) {
        const error = new Error('A purchased product no longer exists.');
        error.code = 'inventory-insufficient';
        throw error;
      }
      const data = stockDocument.snapshot.data();
      const adapters = coupleStockAdapters(data);
      const legacyCoupleChanges = Object.entries(stockDocument.group.quantities.mens)
        .concat(Object.entries(stockDocument.group.quantities.womens))
        .reduce((combined, [size, quantity]) => ({ ...combined, [size]: (combined[size] || 0) + quantity }), {});
      const roles = adapters.legacy
        ? [
            { adapter: stockAdapter(data), changes: stockDocument.group.quantities.standard },
            { adapter: adapters.legacy, changes: legacyCoupleChanges },
          ]
        : [
            { adapter: stockAdapter(data), changes: stockDocument.group.quantities.standard },
            { adapter: adapters.mens, changes: stockDocument.group.quantities.mens },
            { adapter: adapters.womens, changes: stockDocument.group.quantities.womens },
          ];
      const patch = {};
      for (const { adapter, changes } of roles) {
        if (!Object.keys(changes).length) continue;
        const nextQuantities = {};
        for (const [size, requested] of Object.entries(changes)) {
          const available = adapter?.configured.has(size) ? adapter.quantities[size] ?? 0 : 0;
          if (!adapter?.editable || available < requested) {
            const error = new Error(`${data.name || data.title || stockDocument.group.documentId} (${size}) is no longer in stock.`);
            error.code = 'inventory-insufficient';
            throw error;
          }
          nextQuantities[size] = available - requested;
        }
        Object.assign(patch, applyStockChanges(data, adapter, nextQuantities));
      }
      transaction.update(stockDocument.ref, patch);
    }

    transaction.create(orderRef, completedOrder);
    transaction.set(fulfillmentOrderRef('production', orderId, database), completedOrder);
    return { created: true, order: completedOrder };
  });
}

async function transitionOrderFulfillment(orderId, nextStatus, adminUid) {
  const orderRef = db.collection('orders').doc(orderId);

  return db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) {
      const error = new Error('Order not found.');
      error.code = 'order-not-found';
      throw error;
    }

    const currentOrder = orderSnapshot.data();
    const previousStatus = fulfillmentStatusFromOrder(currentOrder);
    const updatedOrder = {
      ...currentOrder,
      fulfillmentStatus: nextStatus,
      fulfillmentUpdatedAt: new Date().toISOString(),
      fulfillmentUpdatedBy: adminUid,
    };

    transaction.update(orderRef, {
      fulfillmentStatus: updatedOrder.fulfillmentStatus,
      fulfillmentUpdatedAt: updatedOrder.fulfillmentUpdatedAt,
      fulfillmentUpdatedBy: updatedOrder.fulfillmentUpdatedBy,
    });
    transaction.set(fulfillmentOrderRef(nextStatus, orderId), updatedOrder);

    for (const status of FULFILLMENT_STATUSES) {
      if (status !== nextStatus) transaction.delete(fulfillmentOrderRef(status, orderId));
    }

    return { previousStatus, order: updatedOrder };
  });
}

// A protected session check used by the admin landing page. It deliberately
// returns no operational data; it proves the API boundary verifies the claim.
app.get('/api/admin/session', (req, res) => {
  return res.status(200).json({ success: true });
});

/**
 * Create a server-authoritative in-person order. This never calls an online gateway;
 * it uses the same transaction that allocates stock for verified online orders.
 */
app.post('/api/admin/orders/walk-in', async (req, res) => {
  if (!db) return res.status(503).json({ success: false, message: 'Orders are unavailable because the database is not configured.' });

  const clientRequestId = typeof req.body?.clientRequestId === 'string' ? req.body.clientRequestId.trim() : '';
  const items = req.body?.items;
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(clientRequestId)) {
    return res.status(400).json({ success: false, message: 'A valid order request identifier is required.' });
  }

  const orderId = walkInOrderId(clientRequestId);
  const orderRef = db.collection('orders').doc(orderId);
  const existing = await orderRef.get();
  if (existing.exists) {
    const existingOrder = existing.data();
    return res.status(200).json({ success: true, duplicate: true, orderId, order: existingOrder });
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ success: false, message: 'Add between 1 and 50 products.' });
  }

  const customerResult = walkInCustomer(req.body?.customer);
  if (!customerResult.valid) return res.status(400).json({ success: false, message: customerResult.message });
  const paymentResult = walkInPayment(req.body?.payment);
  if (!paymentResult.valid) return res.status(400).json({ success: false, message: paymentResult.message });

  try {
    const resolvedItems = [];
    for (const item of items) {
      const productId = typeof item?.id === 'string' ? item.id.trim() : '';
      const quantity = Number(item?.quantity);
      if (!productId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ success: false, message: 'Each product needs a valid quantity between 1 and 100.' });
      }

      const product = await resolveProductFromFirestore(productId);
      if (!product) return res.status(404).json({ success: false, message: `Product not found: "${productId}".` });

      const couple = isCoupleProduct(product.data);
      const selectedMensSize = couple ? normalizeSize(item.mensSize ?? item.selectedMensSize) : null;
      const selectedWomensSize = couple ? normalizeSize(item.womensSize ?? item.selectedWomensSize) : null;
      const selectedSize = !couple ? normalizeSize(item.size ?? item.selectedSize) : null;
      if (couple && (!selectedMensSize || !selectedWomensSize)) {
        return res.status(400).json({ success: false, message: `Select both men's and women's sizes for ${product.data.name || product.docId}.` });
      }
      if (!couple && !selectedSize) {
        return res.status(400).json({ success: false, message: `Select a size for ${product.data.name || product.docId}.` });
      }

      const price = Number(product.data.price);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success: false, message: `Product ${product.data.name || product.docId} has an invalid price.` });
      }

      const submittedColor = sanitizeString(item.color ?? item.selectedColor, 100);
      const configuredColors = configuredColorLabels(product.data);
      let selectedColor;
      if (configuredColors.length > 0) {
        selectedColor = configuredColors.find((color) => color.toLocaleLowerCase() === submittedColor.toLocaleLowerCase());
        if (!selectedColor) return res.status(400).json({ success: false, message: `Select an available color for ${product.data.name || product.docId}.` });
      } else if (submittedColor) {
        return res.status(400).json({ success: false, message: `Product ${product.data.name || product.docId} has no configurable colors.` });
      }

      resolvedItems.push({
        productId,
        firestoreDocId: product.docId,
        collectionName: product.collectionName,
        couple,
        independentCoupleStock: couple && Boolean(product.data.mensSizes || product.data.womensSizes),
        ...(couple ? { selectedMensSize, selectedWomensSize } : { selectedSize }),
        ...(selectedColor ? { selectedColor } : {}),
        name: product.data.name || product.data.title || product.docId,
        price,
        quantity,
        lineTotal: price * quantity,
        image: product.data.img1 || product.data.image || '',
      });
    }

    const shippingResult = walkInShipping(req.body?.shipping);
    if (!shippingResult.valid) return res.status(400).json({ success: false, message: shippingResult.message });
    const pricing = calculateCheckoutPricing(resolvedItems, 0);
    const orderData = {
      orderType: 'walk-in',
      source: 'admin',
      customer: customerResult.customer,
      shipping: shippingResult.shipping,
      items: resolvedItems.map(paidOrderItem),
      pricing: {
        subtotal: pricing.subtotalAmount,
        tax: pricing.taxAmount,
        shipping: pricing.shippingAmount,
        total: pricing.totalAmount,
      },
      payment: {
        gateway: 'walk-in',
        method: paymentResult.method,
        ...(paymentResult.otherMethod ? { otherMethod: paymentResult.otherMethod } : {}),
        paymentStatus: paymentResult.status,
      },
      status: paymentResult.status,
      createdAt: new Date().toISOString(),
      createdBy: req.adminUser.uid,
    };

    const result = await createPaidOrderWithFulfillment(orderId, orderData, resolvedItems);
    return res.status(result.created ? 201 : 200).json({ success: true, duplicate: !result.created, orderId, order: result.order });
  } catch (error) {
    if (error.code === 'inventory-insufficient' || error.code === 'inventory-invalid-order') {
      return res.status(409).json({ success: false, message: error.message || 'One or more selected products are out of stock.' });
    }
    console.error('[Walk-in Order] Failed to create order:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to create walk-in order.' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  const selectedStatus = typeof req.query.status === 'string' ? req.query.status : null;
  if (selectedStatus && !isFulfillmentStatus(selectedStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid fulfillment status filter.' });
  }

  if (!db) {
    return res.status(503).json({ success: false, message: 'Orders are unavailable because the database is not configured.' });
  }

  try {
    const snapshot = await db.collection('orders').get();
    const orders = snapshot.docs
      .map((document) => ({ raw: document.data(), response: adminOrderResponse(document.id, document.data()) }))
      .filter(({ response }) => !selectedStatus || response.fulfillmentStatus === selectedStatus)
      .sort((a, b) => timestampSortValue(b.raw.createdAt) - timestampSortValue(a.raw.createdAt))
      .map(({ response }) => response);

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('[Admin Orders] Failed to list orders:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load orders.' });
  }
});

app.delete('/api/admin/orders/:orderId', async (req, res) => {
  if (!db) return res.status(503).json({ success: false, message: 'Orders are unavailable because the database is not configured.' });
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(orderId)) return res.status(400).json({ success: false, message: 'Invalid order identifier.' });

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const snapshot = await orderRef.get();
    if (!snapshot.exists) return res.status(404).json({ success: false, message: 'Order no longer exists.' });
    // Deletion intentionally does not restore stock or imply a refund. Inventory
    // effects and payment records cannot be safely reversed from an admin delete.
    const batch = db.batch();
    batch.delete(orderRef);
    for (const status of FULFILLMENT_STATUSES) batch.delete(fulfillmentOrderRef(status, orderId));
    await batch.commit();
    return res.status(200).json({ success: true, orderId });
  } catch (error) {
    console.error(`[Admin Orders] Failed to delete ${orderId}:`, error.message);
    return res.status(500).json({ success: false, message: 'Unable to delete this order.' });
  }
});

app.post('/api/admin/orders/fulfillment-status', async (req, res) => {
  const updates = req.body?.updates;
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 50) {
    return res.status(400).json({ success: false, message: 'Provide between 1 and 50 fulfillment updates.' });
  }

  const seenOrderIds = new Set();
  const successful = [];
  const failed = [];

  for (const update of updates) {
    const orderId = typeof update?.orderId === 'string' ? update.orderId.trim() : '';
    const fulfillmentStatus = update?.fulfillmentStatus;

    if (!orderId || !isFulfillmentStatus(fulfillmentStatus) || seenOrderIds.has(orderId)) {
      failed.push({ orderId: orderId || null, message: 'Invalid or duplicate order update.' });
      continue;
    }
    seenOrderIds.add(orderId);

    try {
      const result = await transitionOrderFulfillment(orderId, fulfillmentStatus, req.adminUser.uid);
      successful.push({ orderId, fulfillmentStatus, previousStatus: result.previousStatus });
    } catch (error) {
      console.error(`[Admin Orders] Failed to update fulfillment for ${orderId}:`, error.message);
      failed.push({
        orderId,
        message: error.code === 'order-not-found' ? 'Order no longer exists.' : 'Unable to save this order status.',
      });
    }
  }

  return res.status(failed.length ? 207 : 200).json({
    success: failed.length === 0,
    successful,
    failed,
  });
});

console.log(`[Payment Gateway] Active gateway: ${gateway.gatewayName}`);

// ============================================================================
// HELPER: Parse compound product ID back to collection + document ID
// ============================================================================
// React product IDs are formatted as "<slugified-collection>-<docId>"
// e.g. "products-Connar McGregor", "fight-UFC x Venam"
// We need to reverse this to find the Firestore document.
// ============================================================================

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function colorLabelsFromValue(value) {
  if (Array.isArray(value)) return value.flatMap(colorLabelsFromValue);
  if (typeof value === 'string') return value.split(/[,|/;]+/).map((entry) => entry.trim()).filter(Boolean);
  if (!value || typeof value !== 'object') return [];

  const record = value;
  const label = typeof record.name === 'string' ? record.name : typeof record.label === 'string' ? record.label : '';
  if (label.trim()) return [label.trim()];

  return Object.values(record).flatMap(colorLabelsFromValue);
}

/** Returns only labels explicitly configured in the product document. */
function configuredColorLabels(data) {
  const numberedFields = Object.keys(data)
    .map((key) => ({ key, match: /^color(\d+)$/i.exec(key) }))
    .filter((entry) => entry.match)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .flatMap((entry) => colorLabelsFromValue(data[entry.key]));
  const namedFields = colorLabelsFromValue(data.colors ?? data.colorOptions ?? data.color);
  const seen = new Set();

  return [...namedFields, ...numberedFields].filter((label) => {
    const normalized = label.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Resolve a compound React product ID to a Firestore collection + doc.
 * Tries all known collections and returns the first match.
 *
 * @param {string} productId — Compound ID like "products-Connar McGregor"
 * @returns {Promise<{ collectionName: string, docId: string, data: object, selectedSize: string | null } | null>}
 */
async function resolveProductFromFirestore(productId) {
  if (!db) return null;

  // Strategy: try to discover collections, then for each collection,
  // check if the product ID starts with the slugified collection name.
  let collectionNames = ['products'];
  try {
    const configSnap = await db.doc('_config/collections').get();
    if (configSnap.exists) {
      const configData = configSnap.data();
      const names = configData.productCollections || configData.collections || configData.names;
      if (Array.isArray(names)) {
        collectionNames = [...new Set([...names.map(n => String(n).trim()).filter(Boolean), 'products'])];
      }
    }
  } catch (e) {
    // Fall back to default
  }

  // Also try TOTD collection
  collectionNames.push('TOTD');

  for (const colName of collectionNames) {
    const prefix = slugify(colName) + '-';
    if (productId.startsWith(prefix)) {
      const docId = productId.slice(prefix.length);
      if (!docId) continue;

      try {
        let docSnap = await db.collection(colName).doc(docId).get();
        if (docSnap.exists) {
          return { collectionName: colName, docId, data: docSnap.data(), selectedSize: null };
        }
        
        // If not found, try removing the appended size (e.g., "-S", "-XXL")
        const lastDashIndex = docId.lastIndexOf('-');
        const selectedSize = normalizeSize(docId.slice(lastDashIndex + 1));
        if (lastDashIndex > 0 && selectedSize) {
          const docIdWithoutSize = docId.substring(0, lastDashIndex);
          docSnap = await db.collection(colName).doc(docIdWithoutSize).get();
          if (docSnap.exists) {
            return { collectionName: colName, docId: docIdWithoutSize, data: docSnap.data(), selectedSize };
          }
        }
      } catch (e) {
        console.warn(`[Firestore] Error reading ${colName}/${docId}:`, e.message);
      }
    }
  }

  return null;
}

function checkoutValidationError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function productName(data, fallback) {
  return typeof data?.name === 'string' && data.name.trim()
    ? data.name.trim()
    : typeof data?.title === 'string' && data.title.trim()
      ? data.title.trim()
      : fallback;
}

function productImage(data) {
  return [data?.img1, data?.image, data?.imageUrl, data?.imageAddress]
    .find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

/**
 * Resolve cart lines using only current Firestore product data.
 * Client prices are deliberately not read or copied here.
 */
async function resolveCheckoutItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw checkoutValidationError(400, 'Validation Error: items must be a non-empty array of { id, quantity }.');
  }
  if (items.length > 50) {
    throw checkoutValidationError(400, 'Validation Error: Too many items (max 50).');
  }

  const resolvedItems = [];
  for (const item of items) {
    const productId = typeof item?.id === 'string' ? item.id.trim() : '';
    const quantity = Number(item?.quantity);

    if (!productId) {
      throw checkoutValidationError(400, 'Validation Error: Each item must have a non-empty id.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw checkoutValidationError(400, `Validation Error: Quantity for "${productId}" must be an integer between 1 and 100.`);
    }

    const product = await resolveProductFromFirestore(productId);
    if (!product) {
      throw checkoutValidationError(404, `Product not found: "${productId}".`);
    }

    const couple = isCoupleProduct(product.data);
    const selectedMensSize = couple ? normalizeSize(item.mensSize ?? item.selectedMensSize) : null;
    const selectedWomensSize = couple ? normalizeSize(item.womensSize ?? item.selectedWomensSize) : null;
    const submittedStandardSize = !couple ? normalizeSize(item.size ?? item.selectedSize) : null;
    const selectedSize = !couple ? product.selectedSize || submittedStandardSize : null;

    if (couple && (!selectedMensSize || !selectedWomensSize)) {
      throw checkoutValidationError(400, `Select both men's and women's sizes for "${productId}" before checkout.`);
    }
    if (!couple && product.selectedSize && submittedStandardSize && product.selectedSize !== submittedStandardSize) {
      throw checkoutValidationError(400, `Selected size for "${productId}" does not match the product variant.`);
    }
    if (!couple && !selectedSize) {
      throw checkoutValidationError(400, `Select an in-stock size for "${productId}" before checkout.`);
    }

    const price = Number(product.data.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw checkoutValidationError(400, `Product "${productId}" does not have a valid price.`);
    }

    const configuredColors = configuredColorLabels(product.data);
    const submittedColor = sanitizeString(item.color ?? item.selectedColor, 100);
    let selectedColor;
    if (configuredColors.length > 0) {
      if (!submittedColor) {
        throw checkoutValidationError(400, `Select a color for "${productId}" before checkout.`);
      }
      selectedColor = configuredColors.find(
        (color) => color.toLocaleLowerCase() === submittedColor.toLocaleLowerCase(),
      );
      if (!selectedColor) {
        throw checkoutValidationError(400, `Selected color for "${productId}" is unavailable.`);
      }
    } else if (submittedColor) {
      throw checkoutValidationError(400, `Product "${productId}" does not have configurable colors.`);
    }

    resolvedItems.push({
      productId,
      firestoreDocId: product.docId,
      collectionName: product.collectionName,
      couple,
      independentCoupleStock: couple && Boolean(product.data.mensSizes || product.data.womensSizes),
      ...(couple ? { selectedMensSize, selectedWomensSize } : { selectedSize }),
      ...(selectedColor ? { selectedColor } : {}),
      name: productName(product.data, product.docId),
      price,
      quantity,
      lineTotal: price * quantity,
      image: productImage(product.data),
      alt: typeof product.data.alt === 'string' && product.data.alt.trim()
        ? product.data.alt.trim()
        : productName(product.data, product.docId),
      model: typeof product.data.model === 'string' ? product.data.model.trim() : '',
      theme: product.collectionName,
    });
  }

  return resolvedItems;
}

/** Validate current stock for the resolved variants without reserving it. */
async function validateCheckoutInventory(resolvedItems) {
  const requestedByVariant = new Map();
  for (const item of resolvedItems) {
    const selections = item.couple
      ? [
          { role: item.independentCoupleStock ? 'mens' : 'legacy', size: item.selectedMensSize },
          { role: item.independentCoupleStock ? 'womens' : 'legacy', size: item.selectedWomensSize },
        ]
      : [{ role: 'standard', size: item.selectedSize }];
    for (const selection of selections) {
      const key = `${item.collectionName}\u0000${item.firestoreDocId}\u0000${selection.role}\u0000${selection.size}`;
      const current = requestedByVariant.get(key) || { item, role: selection.role, size: selection.size, quantity: 0 };
      requestedByVariant.set(key, { ...current, quantity: current.quantity + item.quantity });
    }
  }

  for (const request of requestedByVariant.values()) {
    const snapshot = await db.collection(request.item.collectionName).doc(request.item.firestoreDocId).get();
    const productData = snapshot.exists ? snapshot.data() : null;
    if (!productData) {
      throw checkoutValidationError(409, `${request.item.name} is no longer available.`);
    }
    const adapters = request.item.couple ? coupleStockAdapters(productData) : null;
    const adapter = request.role === 'mens'
      ? (adapters.mens.configured.size ? adapters.mens : adapters.legacy)
      : request.role === 'womens'
        ? (adapters.womens.configured.size ? adapters.womens : adapters.legacy)
        : request.role === 'legacy'
          ? adapters.legacy
          : stockAdapter(productData);
    const available = adapter.configured.has(request.size) ? adapter.quantities[request.size] ?? 0 : 0;
    if (!adapter.editable || available < request.quantity) {
      throw checkoutValidationError(409, `${request.item.name} (${request.size}) is out of stock or has insufficient stock.`);
    }
  }
}

function checkoutPreviewItem(item, cartId) {
  return withoutUndefinedProperties({
    cartId: typeof cartId === 'string' ? cartId.slice(0, 300) : undefined,
    productId: item.productId,
    name: item.name,
    image: item.image,
    alt: item.alt,
    model: item.model,
    theme: item.theme,
    price: item.price,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    couple: item.couple,
    selectedSize: item.selectedSize,
    selectedMensSize: item.selectedMensSize,
    selectedWomensSize: item.selectedWomensSize,
    selectedColor: item.selectedColor,
  });
}

async function inventoryCollectionNames() {
  const names = ['products', 'TOTD'];
  const configSnap = await db.doc('_config/collections').get();
  if (configSnap.exists) {
    const config = configSnap.data();
    const configured = config.productCollections || config.collections || config.names;
    if (Array.isArray(configured)) {
      configured.forEach((name) => {
        const normalized = typeof name === 'string' ? name.trim() : '';
        if (normalized) names.push(normalized);
      });
    }
  }
  return [...new Set(names)];
}

function inventoryProductResponse(collectionName, document) {
  const data = document.data();
  const couple = adminYesNoValue(data.couple);
  const mensSummary = couple ? stockSummaryFor(data, ['mensSizes', 'mensSizeStock']) : null;
  const womensSummary = couple ? stockSummaryFor(data, ['womensSizes', 'womensSizeStock']) : null;
  const hasName = typeof data.name === 'string';
  const hasTitle = typeof data.title === 'string';
  return {
    productId: `${slugify(collectionName)}-${document.id}`,
    collectionName,
    documentId: document.id,
    name: hasName && data.name.trim() ? data.name.trim()
      : hasTitle && data.title.trim() ? data.title.trim()
        : document.id,
    nameField: hasName ? 'name' : hasTitle ? 'title' : null,
    image: typeof data.img1 === 'string' ? data.img1.trim() : '',
    price: typeof data.price === 'number' && Number.isFinite(data.price)
      ? data.price
      : typeof data.price === 'string' && data.price.trim() && Number.isFinite(Number(data.price))
        ? Number(data.price)
        : null,
    flags: {
      latest: adminYesNoValue(data.latest),
      hero: adminYesNoValue(data.hero),
      couple,
    },
    version: documentVersion(document),
    ...stockSummary(data),
    ...(couple && mensSummary && Object.values(mensSummary.sizes).some((value) => value !== null) ? { mensSizes: mensSummary.sizes } : {}),
    ...(couple && womensSummary && Object.values(womensSummary.sizes).some((value) => value !== null) ? { womensSizes: womensSummary.sizes } : {}),
  };
}

app.get('/api/admin/inventory', async (req, res) => {
  if (!db) return res.status(503).json({ success: false, message: 'Inventory is unavailable because the database is not configured.' });

  try {
    const collectionNames = await inventoryCollectionNames();
    const snapshots = await Promise.all(collectionNames.map((name) => db.collection(name).get()));
    const products = snapshots
      .flatMap((snapshot, index) => snapshot.docs.map((document) => inventoryProductResponse(collectionNames[index], document)))
      .sort((a, b) => a.name.localeCompare(b.name) || a.productId.localeCompare(b.productId));
    return res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('[Admin Inventory] Failed to list products:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load inventory.' });
  }
});

function parseInventoryChanges(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const changes = {};
  for (const [rawSize, rawQuantity] of Object.entries(value)) {
    const size = normalizeSize(rawSize);
    if (!size || !Number.isSafeInteger(rawQuantity) || rawQuantity < 0) return null;
    changes[size] = rawQuantity;
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

function adminYesNoValue(value) {
  if (value === true || value === 1) return true;
  if (typeof value !== 'string') return false;
  return ['yes', 'true', '1', 'latest'].includes(value.trim().toLowerCase());
}

function persistedFlagValue(currentValue, nextValue, field) {
  if (field === 'hero') return nextValue ? 'yes' : 'no';
  if (typeof currentValue === 'boolean') return nextValue;
  if (typeof currentValue === 'number') return nextValue ? 1 : 0;
  if (typeof currentValue === 'string') {
    const normalized = currentValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'false') return String(nextValue);
    if (normalized === '1' || normalized === '0') return nextValue ? '1' : '0';
    if (field === 'latest' && normalized === 'latest' && nextValue) return 'latest';
  }
  return nextValue ? 'yes' : 'no';
}

function parseInventoryMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const metadata = {};

  if (Object.prototype.hasOwnProperty.call(value, 'name')) {
    const name = sanitizeString(value.name, 200).replace(/\s+/g, ' ');
    if (!name) return null;
    metadata.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'price')) {
    const price = value.price;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
    metadata.price = price;
  }
  for (const field of ['latest', 'hero', 'couple']) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) continue;
    if (typeof value[field] !== 'boolean') return null;
    metadata[field] = value[field];
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

function inventoryMetadataPatch(data, metadata) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(metadata, 'name')) {
    const nameField = typeof data.name === 'string' ? 'name' : typeof data.title === 'string' ? 'title' : null;
    if (!nameField) {
      const error = new Error('This product has no editable name field.');
      error.code = 'name-field-not-configured';
      throw error;
    }
    patch[nameField] = metadata.name;
  }
  if (Object.prototype.hasOwnProperty.call(metadata, 'price')) {
    patch.price = typeof data.price === 'string' ? String(metadata.price) : metadata.price;
  }
  for (const field of ['latest', 'hero', 'couple']) {
    if (Object.prototype.hasOwnProperty.call(metadata, field)) {
      patch[field] = persistedFlagValue(data[field], metadata[field], field);
    }
  }
  return patch;
}

async function updateInventoryProduct(update, adminUid) {
  const productId = typeof update?.productId === 'string' ? update.productId.trim() : '';
  const expectedVersion = typeof update?.version === 'string' ? update.version : '';
  const changes = parseInventoryChanges(update?.changes);
  const metadata = parseInventoryMetadata(update?.metadata);
  if (!productId || !expectedVersion || (!changes && !metadata)) {
    const error = new Error('Invalid inventory update.');
    error.code = 'invalid-inventory-update';
    throw error;
  }

  const product = await resolveProductFromFirestore(productId);
  if (!product || product.selectedSize) {
    const error = new Error('Product no longer exists.');
    error.code = 'product-not-found';
    throw error;
  }
  const reference = db.collection(product.collectionName).doc(product.docId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) {
      const error = new Error('Product no longer exists.');
      error.code = 'product-not-found';
      throw error;
    }
    if (documentVersion(snapshot) !== expectedVersion) {
      const error = new Error('This product changed after you loaded it. Refresh before saving your stock changes.');
      error.code = 'inventory-conflict';
      throw error;
    }

    const data = snapshot.data();
    const adapter = stockAdapter(data);
    const patch = {
      ...(changes ? applyStockChanges(data, adapter, changes) : {}),
      ...(metadata ? inventoryMetadataPatch(data, metadata) : {}),
    };
    transaction.update(reference, patch);
    return { productId, changes: changes || {}, metadata: metadata || {}, previous: stockSummary(data), adminUid };
  });
}

app.post('/api/admin/inventory', async (req, res) => {
  const updates = req.body?.updates;
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 50) {
    return res.status(400).json({ success: false, message: 'Provide between 1 and 50 inventory updates.' });
  }

  const successful = [];
  const failed = [];
  const seenProducts = new Set();
  for (const update of updates) {
    const productId = typeof update?.productId === 'string' ? update.productId.trim() : '';
    if (!productId || seenProducts.has(productId)) {
      failed.push({ productId: productId || null, message: 'Invalid or duplicate product update.' });
      continue;
    }
    seenProducts.add(productId);
    try {
      const result = await updateInventoryProduct(update, req.adminUser.uid);
      successful.push({ productId: result.productId, changes: result.changes, metadata: result.metadata });
    } catch (error) {
      console.error(`[Admin Inventory] Failed to update ${productId}:`, error.message);
      const message = error.code === 'inventory-conflict'
        ? error.message
        : error.code === 'size-not-configured' || error.code === 'stock-schema-readonly'
          ? error.message
        : error.code === 'product-not-found'
          ? 'Product no longer exists.'
          : error.code === 'name-field-not-configured'
            ? error.message
            : 'Unable to save this product inventory.';
      failed.push({ productId, message, code: error.code || 'inventory-save-failed' });
    }
  }

  return res.status(failed.length ? 207 : 200).json({ success: failed.length === 0, successful, failed });
});

function parseNewProductSizes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const sizes = {};
  for (const [rawSize, rawQuantity] of Object.entries(value)) {
    const size = normalizeSize(rawSize);
    if (!size || !Number.isSafeInteger(rawQuantity) || rawQuantity < 0) return null;
    sizes[size] = rawQuantity;
  }
  return Object.keys(sizes).length ? sizes : null;
}

function storageDownloadUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com' ? url.toString() : null;
  } catch {
    return null;
  }
}

app.get('/api/admin/product-collections', async (req, res) => {
  if (!db) return res.status(503).json({ success: false, message: 'Product collections are unavailable because the database is not configured.' });
  try {
    return res.status(200).json({ success: true, collections: await inventoryCollectionNames() });
  } catch (error) {
    console.error('[Admin Products] Failed to list collections:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load product collections.' });
  }
});

app.post('/api/admin/products', async (req, res) => {
  if (!db) return res.status(503).json({ success: false, message: 'Product creation is unavailable because the database is not configured.' });

  const name = sanitizeString(req.body?.name, 200).replace(/\s+/g, ' ');
  const price = req.body?.price;
  const collectionName = sanitizeString(req.body?.collectionName, 200);
  const documentId = sanitizeString(req.body?.documentId, 160);
  const latest = req.body?.latest === true;
  const hero = req.body?.hero === true;
  const couple = req.body?.couple === true;
  const imageUrls = Array.isArray(req.body?.imageUrls) ? req.body.imageUrls.map(storageDownloadUrl) : [];
  const standardSizes = parseNewProductSizes(req.body?.sizes);
  const mensSizes = parseNewProductSizes(req.body?.mensSizes);
  const womensSizes = parseNewProductSizes(req.body?.womensSizes);

  if (!name || typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || !collectionName || !documentId || !/^[a-z0-9][a-z0-9-]{2,159}$/i.test(documentId)) {
    return res.status(400).json({ success: false, message: 'Enter a name, a positive numeric price, a valid collection, and a valid product identifier.' });
  }
  if (!imageUrls.length || imageUrls.some((url) => !url)) {
    return res.status(400).json({ success: false, message: 'Upload at least one valid Firebase Storage image before saving the product.' });
  }
  if ((couple && (!mensSizes || !womensSizes)) || (!couple && !standardSizes)) {
    return res.status(400).json({ success: false, message: couple ? "Configure at least one men's and one women's size." : 'Configure at least one size.' });
  }

  try {
    const collectionNames = await inventoryCollectionNames();
    if (!collectionNames.includes(collectionName)) {
      return res.status(400).json({ success: false, message: 'Choose one existing product collection.' });
    }
    const reference = db.collection(collectionName).doc(documentId);
    const existing = await reference.get();
    if (existing.exists) return res.status(409).json({ success: false, message: 'A product with this identifier already exists. Rename the product and try again.' });

    const data = {
      name,
      price,
      latest: latest ? 'yes' : 'no',
      hero: hero ? 'yes' : 'no',
      couple: couple ? 'yes' : 'no',
      img1: imageUrls[0],
      images: imageUrls,
      ...(couple ? { mensSizes, womensSizes } : { sizes: standardSizes }),
      createdAt: new Date().toISOString(),
      createdBy: req.adminUser.uid,
    };
    await reference.create(data);
    return res.status(201).json({ success: true, productId: `${slugify(collectionName)}-${documentId}`, collectionName, documentId });
  } catch (error) {
    console.error('[Admin Products] Failed to create product:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to save the product.' });
  }
});

// Health check endpoint to verify backend status
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    message: 'Backend server is running',
    gateway: gateway.gatewayName,
    time: new Date().toISOString(),
  });
});

/**
 * STEP 1: CREATE ORDER ENDPOINT
 * POST /api/create-order
 * Receives: { items: [{ id, quantity }], customer: { email, phone, name }, shipping }
 * Returns: { success, orderId, amount, currency, gatewayData }
 *
 * SECURITY: The server reads product prices from Firestore.
 * The client-supplied amount is NEVER trusted.
 */
app.get('/api/pin-state/:pin', async (req, res) => {
  try {
    res.json({ success: true, state: await lookupPin(req.params.pin) });
  } catch (error) {
    res.status(/valid six-digit|could not be verified/.test(error.message) ? 400 : 503)
      .json({ success: false, message: error.message });
  }
});

/**
 * POST /api/checkout-preview
 * Resolve the browser cart against current Firestore records for checkout UI.
 * This is a display/validation quote only; create-order repeats the lookup.
 */
app.post('/api/checkout-preview', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, message: 'Server database is not initialized.' });
  }

  try {
    const resolvedItems = await resolveCheckoutItems(req.body?.items);
    await validateCheckoutInventory(resolvedItems);
    const pricing = calculateCheckoutPricing(resolvedItems, 0);

    return res.status(200).json({
      success: true,
      items: resolvedItems.map((item, index) => checkoutPreviewItem(item, req.body.items[index]?.cartId)),
      pricing,
    });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode >= 500) console.error('[Checkout Preview] Failed to refresh cart:', error);
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Unable to refresh checkout products.',
    });
  }
});

app.post('/api/create-order', async (req, res) => {
  const { items, customer, shipping } = req.body;

  // --- Validate items array ---
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: items must be a non-empty array of { id, quantity }.',
    });
  }

  if (items.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Too many items (max 50).',
    });
  }

  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Server database is not initialized.',
    });
  }

  const checkoutDetails = validateCheckoutDetails(customer, shipping);
  if (!checkoutDetails.valid) {
    return res.status(400).json({ success: false, message: `Validation Error: ${checkoutDetails.message}` });
  }

  try {
    // Resolve and validate again here. The payment amount is never taken from
    // the checkout preview or any browser-supplied price.
    const resolvedItems = await resolveCheckoutItems(items);
    await validateCheckoutInventory(resolvedItems);
    let totalAmount = resolvedItems.reduce((sum, item) => sum + item.lineTotal, 0);

    for (const item of items) {
      const productId = typeof item.id === 'string' ? item.id.trim() : '';
      const quantity = Number(item.quantity);

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Validation Error: Each item must have a non-empty id.',
        });
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({
          success: false,
          message: `Validation Error: Quantity for "${productId}" must be an integer between 1 and 100.`,
        });
      }

      const product = await resolveProductFromFirestore(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: "${productId}".`,
        });
      }

      const couple = isCoupleProduct(product.data);
      const selectedMensSize = couple ? normalizeSize(item.mensSize ?? item.selectedMensSize) : null;
      const selectedWomensSize = couple ? normalizeSize(item.womensSize ?? item.selectedWomensSize) : null;
      const submittedStandardSize = !couple ? normalizeSize(item.size ?? item.selectedSize) : null;
      const selectedSize = !couple ? product.selectedSize || submittedStandardSize : null;

      if (couple && (!selectedMensSize || !selectedWomensSize)) {
        return res.status(400).json({
          success: false,
          message: `Select both men's and women's sizes for "${productId}" before checkout.`,
        });
      }

      if (!couple && product.selectedSize && submittedStandardSize && product.selectedSize !== submittedStandardSize) {
        return res.status(400).json({
          success: false,
          message: `Selected size for "${productId}" does not match the product variant.`,
        });
      }

      if (!couple && !selectedSize) {
        return res.status(400).json({
          success: false,
          message: `Select an in-stock size for "${productId}" before checkout.`,
        });
      }

      // Extract price from Firestore document (server-authoritative)
      const firestorePrice = Number(product.data.price);
      if (!Number.isFinite(firestorePrice) || firestorePrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Product "${productId}" does not have a valid price.`,
        });
      }

      const configuredColors = configuredColorLabels(product.data);
      const submittedColor = sanitizeString(item.color ?? item.selectedColor, 100);
      let selectedColor;

      if (configuredColors.length > 0) {
        if (!submittedColor) {
          return res.status(400).json({
            success: false,
            message: `Select a color for "${productId}" before checkout.`,
          });
        }

        selectedColor = configuredColors.find(
          (color) => color.toLocaleLowerCase() === submittedColor.toLocaleLowerCase(),
        );
        if (!selectedColor) {
          return res.status(400).json({
            success: false,
            message: `Selected color for "${productId}" is unavailable.`,
          });
        }
      } else if (submittedColor) {
        return res.status(400).json({
          success: false,
          message: `Product "${productId}" does not have configurable colors.`,
        });
      }

      const lineTotal = firestorePrice * quantity;
      totalAmount += lineTotal;

      resolvedItems.push({
        productId,
        firestoreDocId: product.docId,
        collectionName: product.collectionName,
        couple,
        // New couple products use independent stock maps. Existing documents
        // have one shared map, which must keep counting both garments together.
        independentCoupleStock: couple && Boolean(product.data.mensSizes || product.data.womensSizes),
        ...(couple
          ? { selectedMensSize, selectedWomensSize }
          : { selectedSize }),
        ...(selectedColor ? { selectedColor } : {}),
        name: product.data.name || product.data.title || product.docId,
        price: firestorePrice,
        quantity,
        lineTotal,
        image: product.data.img1 || product.data.image || '',
      });
    }

    // This is a checkout-time validation only; inventory is deducted atomically
    // after Cashfree confirms payment. The paid-order transaction repeats this
    // check so concurrent shoppers cannot oversell a size.
    const requestedByVariant = new Map();
    for (const item of resolvedItems) {
      const selections = item.couple
        ? [
            { role: item.independentCoupleStock ? 'mens' : 'legacy', size: item.selectedMensSize },
            { role: item.independentCoupleStock ? 'womens' : 'legacy', size: item.selectedWomensSize },
          ]
        : [{ role: 'standard', size: item.selectedSize }];
      for (const selection of selections) {
        const key = `${item.collectionName}\u0000${item.firestoreDocId}\u0000${selection.role}\u0000${selection.size}`;
        const current = requestedByVariant.get(key) || { item, role: selection.role, size: selection.size, quantity: 0 };
        requestedByVariant.set(key, { ...current, quantity: current.quantity + item.quantity });
      }
    }
    for (const request of requestedByVariant.values()) {
      const productData = (await db.collection(request.item.collectionName).doc(request.item.firestoreDocId).get()).data();
      const coupleAdapters = request.item.couple ? coupleStockAdapters(productData) : null;
      const adapter = request.role === 'mens'
        ? (coupleAdapters.mens.configured.size ? coupleAdapters.mens : coupleAdapters.legacy)
        : request.role === 'womens'
          ? (coupleAdapters.womens.configured.size ? coupleAdapters.womens : coupleAdapters.legacy)
          : request.role === 'legacy'
            ? coupleAdapters.legacy
            : stockAdapter(productData);
      const available = adapter.configured.has(request.size) ? adapter.quantities[request.size] ?? 0 : 0;
      if (!adapter.editable || available < request.quantity) {
        return res.status(409).json({ success: false, message: `${request.item.name} (${request.size}) is out of stock or has insufficient stock.` });
      }
    }

    // Catalog prices are the intended payable prices. Shipping is currently
    // free and no additional tax is charged at checkout.
    const pricing = calculateCheckoutPricing(resolvedItems, 0);
    const { subtotalAmount, taxAmount, shippingAmount } = pricing;
    totalAmount = pricing.totalAmount;

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must be greater than zero.',
      });
    }

    // --- Build customer info ---
    const customerName = checkoutDetails.customer.name;
    const customerEmail = checkoutDetails.customer.email;
    const customerPhone = checkoutDetails.customer.phone;

    console.log(`[Payment] Creating order: ${resolvedItems.length} item(s), total: ${totalAmount} INR`);

    // --- Store pending order context in Firestore for later verification ---
    const pendingOrderData = {
      items: resolvedItems.map(pendingOrderItem),
      subtotalAmount,
      taxAmount,
      shippingAmount,
      totalAmount,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      shipping: checkoutDetails.shipping,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const order = await gateway.createOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      items: resolvedItems,
    });

    // The Razorpay order ID is the single idempotency key used by checkout,
    // callback verification, webhooks, and the final Firestore order document.
    if (db && order.orderId) {
      pendingOrderData.razorpayOrderId = order.orderId;
      await db.collection('pendingOrders').doc(order.orderId).set(pendingOrderData);
    }

    return res.status(200).json({
      success: true,
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      gatewayData: order.gatewayData || {},
    });
  } catch (error) {
    console.error('[Payment Error] Failed to create order:', error);

    return res.status(Number.isInteger(error.statusCode) ? error.statusCode : 500).json({
      success: false,
      message: error.message || 'Failed to create payment order.',
    });
  }
});

// ============================================================================
// SHARED HELPERS
// ============================================================================

function sanitizeString(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
}

function validateCheckoutDetails(customer, shipping) {
  const name = sanitizeString(customer?.name, 200).replace(/\s+/g, ' ');
  const email = sanitizeString(customer?.email, 254).toLowerCase();
  const phone = typeof customer?.phone === 'string' ? customer.phone.trim() : '';
  const country = sanitizeString(shipping?.country, 5).toUpperCase();
  const doorNo = sanitizeString(shipping?.doorNo, 100);
  const addressLine1 = sanitizeString(shipping?.addressLine1, 500);
  const addressLine2 = sanitizeString(shipping?.addressLine2, 500);
  const city = sanitizeString(shipping?.city, 100);
  const state = sanitizeString(shipping?.state, 100);
  const pinCode = typeof shipping?.pinCode === 'string' ? shipping.pinCode.trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, message: 'Provide a valid email address.' };
  if (!name) return { valid: false, message: 'Name is required.' };
  if (!doorNo) return { valid: false, message: 'Door No. is required.' };
  if (!addressLine1) return { valid: false, message: 'Address Line 1 is required.' };
  if (!city) return { valid: false, message: 'City is required.' };
  if (!normalizeState(state)) return { valid: false, message: 'Select a valid Indian state or Union Territory.' };
  if (country !== 'IN') return { valid: false, message: 'Delivery is available in India only.' };
  if (!/^\d{10}$/.test(phone)) return { valid: false, message: 'Phone number must contain exactly 10 digits.' };
  if (!/^[1-9]\d{5}$/.test(pinCode)) return { valid: false, message: 'Indian PIN code must contain exactly 6 digits.' };
  if (!pinCode) return { valid: false, message: 'Pincode is required.' };

  return {
    valid: true,
    customer: { name, email, phone },
    shipping: {
      country,
      doorNo,
      addressLine1,
      addressLine2,
      city,
      state: normalizeState(state),
      pinCode,
      // Retain aliases while downstream readers migrate to the explicit fields.
      address: addressLine1,
      apartment: addressLine2,
    },
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ORDER_EMAIL_STATUS_FIELD = 'emailDelivery';
let gmailTransporter = null;
const SAFE_EMAIL_RETRY_REASONS = new Set(['smtp_not_configured']);

function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function smtpErrorCategory(error) {
  const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
  return ['EAUTH', 'ECONNECTION', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ETLS'].includes(code)
    ? code.toLowerCase()
    : 'unknown';
}

function orderConfirmationMessage(orderId, order, logoUrl = null) {
  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemRows = items.map((item) => {
    const safeItem = item && typeof item === 'object' ? item : {};
    const productId = escapeHtml(safeItem.id || 'Product ID unavailable');
    const name = escapeHtml(safeItem.name || 'Product');
    const quantity = Number(safeItem.quantity) || 0;
    const lineTotal = formatter.format((Number(safeItem.price) || 0) * quantity);
    const image = typeof safeItem.image === 'string' && /^https?:\/\//i.test(safeItem.image)
      ? `<img src="${escapeHtml(safeItem.image)}" alt="${name}" width="96" style="display:block;width:96px;height:auto;border:0;">`
      : '';
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;vertical-align:top;">${image}</td><td style="padding:12px 0 12px 14px;border-bottom:1px solid #e5e5e5;vertical-align:top;"><strong>${name}</strong><br><span style="color:#666;font-size:12px;">Product ID: ${productId}</span><br><span style="color:#666;font-size:12px;">Quantity: ${quantity}</span></td><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;vertical-align:top;">${lineTotal}</td></tr>`;
  }).join('');
  const textItems = items.map((item) => {
    const safeItem = item && typeof item === 'object' ? item : {};
    return `- ${safeItem.name || 'Product'} (Product ID: ${safeItem.id || 'unavailable'}) x ${safeItem.quantity || 0}`;
  }).join('\n');
  const total = formatter.format(Number(order?.pricing?.total) || 0);
  const customerName = escapeHtml(order?.customer?.firstName || order?.customer?.name || 'Customer');
  // Keep a real text wordmark visible below the optional image. Email clients
  // do not reliably render image alt text when remote images are blocked.
  const logo = typeof logoUrl === 'string' && /^https:\/\//i.test(logoUrl)
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tr><td align="center" style="padding:0;"><img src="${escapeHtml(logoUrl)}" alt="VARATAAA" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"></td></tr><tr><td align="center" style="padding:8px 0 0;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;color:#171717;">VARATAAA</td></tr></table>`
    : '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;"><tr><td align="center" style="padding:0;font-family:Arial,sans-serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#171717;">VARATAAA</td></tr></table>';
  return {
    subject: `VARATAAA order confirmation — ${orderId}`,
    text: `Hi ${order?.customer?.firstName || order?.customer?.name || 'Customer'},\n\nYour payment has been confirmed.\nOrder ID: ${orderId}\n\n${textItems}\n\nTotal paid: ${total}\nDispatch estimate: 7 Days to dispatch\n\nQuestions? handle2227@gmail.com or varataaah@gmail.com`,
    html: `<div style="margin:0 auto;max-width:600px;padding:24px;font-family:Arial,sans-serif;color:#171717;"><div style="margin:0 0 18px;">${logo}</div><h2 style="margin:0 0 16px;font-size:20px;">Order confirmed</h2><p>Hi ${customerName},</p><p>Your payment has been confirmed. We are preparing your order.</p><p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:20px 0;">${itemRows}</table><p style="font-size:18px;"><strong>Total paid:</strong> ${total}</p><p><strong>Dispatch estimate:</strong> 7 Days to dispatch</p><p style="margin-top:32px;color:#555;font-size:13px;">Need help? Contact <a href="mailto:handle2227@gmail.com" style="color:#171717;">handle2227@gmail.com</a> or <a href="mailto:varataaah@gmail.com" style="color:#171717;">varataaah@gmail.com</a></p></div>`,
  };
}

function websiteLogoStoragePath(value) {
  const candidate = typeof value === 'string'
    ? value
    : value && typeof value === 'object' && typeof value.storagePath === 'string'
      ? value.storagePath
      : '';
  const path = candidate.trim().replace(/^\/+/, '');
  return path || null;
}

/** Resolves the same assets/website logo used by the storefront into an HTTPS email URL. */
async function resolveWebsiteLogoUrl(database = db) {
  if (!database) return null;
  try {
    const snapshot = await database.collection('assets').doc('website').get();
    if (!snapshot.exists) return null;
    const storagePath = websiteLogoStoragePath(snapshot.data()?.logo);
    if (!storagePath) return null;

    const bucket = admin.storage().bucket();
    if (!bucket.name) return null;
    const file = bucket.file(storagePath);
    const [metadata] = await file.getMetadata();
    const token = metadata?.metadata?.firebaseStorageDownloadTokens?.split(',')[0]?.trim();
    if (token) {
      return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(token)}`;
    }

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + (6 * 24 * 60 * 60 * 1000),
    });
    return /^https:\/\//i.test(signedUrl) ? signedUrl : null;
  } catch {
    return null;
  }
}

async function sendOrderConfirmationEmail(orderId, _order, dependencies = {}) {
  const database = dependencies.db || db;
  if (!database) return { status: 'unavailable' };
  const orderRef = database.collection('orders').doc(orderId);
  const now = new Date().toISOString();
  const attemptId = crypto.randomUUID();

  const claim = await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) return { claimed: false };
    const persistedOrder = snapshot.data() || {};
    const existing = persistedOrder[ORDER_EMAIL_STATUS_FIELD];
    const safelyRetryable = existing?.status === 'failed'
      && SAFE_EMAIL_RETRY_REASONS.has(existing?.reason);
    if (existing?.status === 'sent' || existing?.status === 'sending' || existing?.status === 'skipped' || (existing?.status === 'failed' && !safelyRetryable)) return { claimed: false };
    const recipient = persistedOrder?.customer?.email;
    if (!validEmail(recipient)) {
      transaction.update(orderRef, { [ORDER_EMAIL_STATUS_FIELD]: { status: 'skipped', updatedAt: now, reason: 'missing_or_invalid_recipient' } });
      return { claimed: false };
    }
    transaction.update(orderRef, { [ORDER_EMAIL_STATUS_FIELD]: { status: 'sending', attemptId, updatedAt: now } });
    return { claimed: true, order: persistedOrder, recipient };
  });

  if (!claim.claimed) return { status: 'skipped' };
  try {
    let transporter = dependencies.transporter;
    if (!transporter && (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)) throw new Error('smtp_not_configured');
    if (!transporter && !gmailTransporter) {
      const nodemailer = require('nodemailer');
      gmailTransporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    }
    transporter = transporter || gmailTransporter;
    const logoUrl = await resolveWebsiteLogoUrl(database);
    const message = orderConfirmationMessage(orderId, claim.order, logoUrl);
    const result = await transporter.sendMail({ from: process.env.GMAIL_USER || 'VARATAAA', to: claim.recipient, ...message });
    await orderRef.update({ [ORDER_EMAIL_STATUS_FIELD]: { status: 'sent', attemptId, sentAt: new Date().toISOString(), messageId: result.messageId || null } });
    return { status: 'sent' };
  } catch (error) {
    const reason = error.message === 'smtp_not_configured' ? 'smtp_not_configured' : 'smtp_delivery_failed';
    const providerCategory = reason === 'smtp_not_configured' ? 'not_configured' : smtpErrorCategory(error);
    console.warn(`[Email] Order confirmation delivery failed for ${orderId}: ${reason} (${providerCategory})`);
    try { await orderRef.update({ [ORDER_EMAIL_STATUS_FIELD]: { status: 'failed', attemptId, updatedAt: new Date().toISOString(), reason, providerCategory } }); } catch (_) { /* order payment remains successful */ }
    return { status: 'failed' };
  }
}

function paymentResponse(orderId, order) {
  return {
    success: true,
    orderId,
    paymentStatus: order.status,
    order: {
      items: order.items || [],
      totalAmount: order.pricing?.total || 0,
      customer: order.customer || {},
    },
  };
}

function capturedInventoryConflictError() {
  const error = new Error('Payment was captured, but your order needs manual review. Do not pay again. Contact support with your order ID.');
  error.code = 'captured-inventory-conflict';
  error.statusCode = 409;
  return error;
}

function assertRecordedRazorpayPayment(orderId, order, paymentId) {
  if (order?.payment?.gateway !== 'razorpay'
    || order.payment.razorpayOrderId !== orderId
    || order.payment.razorpayPaymentId !== paymentId) {
    const error = new Error('Captured payment does not match the recorded order payment. Contact support with your order ID.');
    error.statusCode = 409;
    throw error;
  }
}

async function recordCapturedInventoryConflict(database, pendingRef, verification, source, reason) {
  const now = new Date().toISOString();
  await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(pendingRef);
    if (!snapshot.exists) throw new Error('Captured payment context is missing.');
    const previous = snapshot.data() || {};
    const capturedPaymentIds = [...new Set([
      ...(Array.isArray(previous.capturedPaymentIds) ? previous.capturedPaymentIds : []),
      verification.gatewayPaymentId,
    ])];
    transaction.set(pendingRef, {
      status: 'captured_inventory_conflict',
      paymentStatus: 'captured',
      capturedPaymentIds,
      paymentException: {
        reason,
        razorpayOrderId: verification.gatewayOrderId,
        razorpayPaymentId: verification.gatewayPaymentId,
        source,
        detectedAt: previous.paymentException?.detectedAt || now,
      },
      updatedAt: now,
    }, { merge: true });
  });
  console.error(`[Payment Review] Captured payment requires manual inventory reconciliation for ${pendingRef.id}.`);
}

async function createRazorpayPaidOrder(orderId, verification, source, dependencies = {}) {
  const database = dependencies.database || db;
  const finalize = dependencies.finalize || createPaidOrderWithFulfillment;
  const sendConfirmation = dependencies.sendConfirmation || sendOrderConfirmationEmail;
  const paidOrderRef = database.collection('orders').doc(orderId);
  const existing = await paidOrderRef.get();
  if (existing.exists) {
    const recorded = existing.data();
    assertRecordedRazorpayPayment(orderId, recorded, verification.gatewayPaymentId);
    return { created: false, order: recorded };
  }

  const pendingRef = database.collection('pendingOrders').doc(orderId);
  const pendingSnap = await pendingRef.get();
  const pending = pendingSnap.exists ? pendingSnap.data() : null;
  if (!pending || pending.razorpayOrderId !== orderId) {
    const error = new Error('Payment order context is missing. Please contact support with your order ID.');
    error.statusCode = 409;
    throw error;
  }

  const items = Array.isArray(pending.items) ? pending.items : [];
  const subtotal = roundCurrency(items.reduce((total, item) => total + Number(item.price) * Number(item.quantity), 0));
  const tax = Number.isFinite(Number(pending.taxAmount)) ? Number(pending.taxAmount) : 0;
  const shippingAmount = Number(pending.shippingAmount) || 0;
  const expectedTotal = Number.isFinite(Number(pending.totalAmount))
    ? Number(pending.totalAmount)
    : roundCurrency(subtotal + tax + shippingAmount);
  const amount = Number(verification.orderAmount);
  if (verification.gatewayOrderId !== orderId || verification.orderCurrency !== 'INR'
    || !Number.isFinite(amount) || Math.round(amount * 100) !== Math.round(expectedTotal * 100)) {
    throw new Error('Razorpay amount does not match the server-calculated order total.');
  }

  // A captured payment that could not allocate stock needs an explicit human
  // decision. A repeated callback or webhook must not silently create an order
  // after a refund or other manual reconciliation has begun.
  if (pending.status === 'captured_inventory_conflict') {
    await recordCapturedInventoryConflict(database, pendingRef, verification, source, pending.paymentException?.reason || 'inventory-insufficient');
    throw capturedInventoryConflictError();
  }

  const customer = pending.customer || {};
  const shipping = pending.shipping || {};
  const order = {
    customer: {
      email: sanitizeString(customer.email, 254),
      name: sanitizeString(customer.name, 200),
      firstName: sanitizeString(customer.name?.split(' ')[0] || customer.firstName || '', 100),
      lastName: sanitizeString(customer.name?.split(' ').slice(1).join(' ') || customer.lastName || '', 100),
      phone: sanitizeString(customer.phone, 20),
    },
    shipping: {
      country: sanitizeString(shipping.country, 5), doorNo: sanitizeString(shipping.doorNo, 100),
      addressLine1: sanitizeString(shipping.addressLine1 ?? shipping.address, 500),
      addressLine2: sanitizeString(shipping.addressLine2 ?? shipping.apartment, 500),
      address: sanitizeString(shipping.addressLine1 ?? shipping.address, 500),
      apartment: sanitizeString(shipping.addressLine2 ?? shipping.apartment, 500),
      city: sanitizeString(shipping.city, 100), state: sanitizeString(shipping.state, 100),
      pinCode: sanitizeString(shipping.pinCode, 10),
    },
    items: items.map(paidOrderItem),
    pricing: { subtotal, tax, shipping: shippingAmount, total: amount },
    payment: {
      gateway: 'razorpay',
      razorpayOrderId: orderId,
      razorpayPaymentId: verification.gatewayPaymentId,
      transactionId: verification.gatewayPaymentId,
      paymentStatus: verification.paymentStatus,
    },
    status: 'paid',
    createdAt: new Date().toISOString(),
    ...(source === 'webhook' ? { source } : {}),
  };
  let result;
  try {
    result = await finalize(orderId, order, items, database);
  } catch (error) {
    if (error.code !== 'inventory-insufficient' && error.code !== 'inventory-invalid-order') throw error;
    await recordCapturedInventoryConflict(database, pendingRef, verification, source, error.code);
    throw capturedInventoryConflictError();
  }
  assertRecordedRazorpayPayment(orderId, result.order, verification.gatewayPaymentId);
  if (result.created) {
    try { await pendingRef.delete(); } catch (_) { /* paid order remains authoritative */ }
  }
  // The helper's claim is the sole duplicate-email guard. Calling it for an
  // idempotent paid-order result lets a fixed missing-configuration failure
  // retry safely, while ambiguous SMTP failures remain protected.
  await sendConfirmation(orderId, result.order, { db: database });
  return result;
}

async function claimRazorpayEvent(database, eventId, eventType, orderId) {
  const ref = database.collection('paymentWebhookEvents')
    .doc(crypto.createHash('sha256').update(eventId).digest('hex'));
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists && snapshot.data()?.status === 'processed') return { duplicate: true, ref };
    transaction.set(ref, { eventId, eventType, orderId, status: 'processing', updatedAt: new Date().toISOString() }, { merge: true });
    return { duplicate: false, ref };
  });
}

/**
 * Razorpay posts an HMAC over the exact request bytes. This route receives a
 * Buffer via the route-specific express.raw middleware above; it never signs a
 * parsed or re-serialised body.
 */
async function handleRazorpayWebhookRequest(req, res, dependencies = {}) {
  const database = dependencies.database || db;
  const paymentGateway = dependencies.paymentGateway || gateway;
  const finalize = dependencies.finalize || createRazorpayPaidOrder;
  if (!paymentGateway.verifyWebhookSignature(req.body, req.get('x-razorpay-signature'))) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
  }
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch (_) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload.' });
  }
  const eventId = req.get('x-razorpay-event-id');
  const eventType = event?.event;
  const payment = event?.payload?.payment?.entity;
  const orderId = payment?.order_id;
  if (!database) return res.status(503).json({ success: false, message: 'Server database is not initialized.' });
  if (!eventId || !eventType || !orderId) {
    return res.status(400).json({ success: false, message: 'Webhook payload is incomplete.' });
  }

  try {
    const claim = await claimRazorpayEvent(database, eventId, eventType, orderId);
    if (claim.duplicate) return res.status(200).json({ success: true, message: 'Already processed.' });
    if (eventType === 'payment.failed') {
      const failureOutcome = await database.runTransaction(async (transaction) => {
        const paidOrder = await transaction.get(database.collection('orders').doc(orderId));
        const pendingRef = database.collection('pendingOrders').doc(orderId);
        const pending = await transaction.get(pendingRef);
        if (paidOrder.exists || pending.data()?.paymentStatus === 'captured') return 'ignored_after_capture';
        if (!pending.exists) return 'missing_context';
        transaction.set(pendingRef, {
          status: 'payment_failed', paymentStatus: 'failed', updatedAt: new Date().toISOString(),
        }, { merge: true });
        return 'failed';
      });
      await claim.ref.set({ status: 'processed', outcome: failureOutcome, processedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ success: true, message: failureOutcome === 'failed' ? 'Payment failure recorded.' : 'Payment failure acknowledged.' });
    }
    if (eventType !== 'payment.captured' || !payment?.id) {
      await claim.ref.set({ status: 'processed', outcome: 'ignored', processedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ success: true, message: 'Event ignored.' });
    }
    const verification = await paymentGateway.verifyWebhookPayment({ orderId, paymentId: payment.id });
    if (!verification.verified) {
      await claim.ref.set({ status: 'pending_confirmation', updatedAt: new Date().toISOString() }, { merge: true });
      return res.status(503).json({ success: false, message: 'Payment is not captured yet.' });
    }
    let result;
    try {
      result = await finalize(orderId, verification, 'webhook');
    } catch (error) {
      if (error.code !== 'captured-inventory-conflict') throw error;
      await claim.ref.set({ status: 'processed', outcome: 'manual_review', processedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ success: true, message: 'Captured payment recorded for manual review.' });
    }
    await claim.ref.set({ status: 'processed', outcome: result.created ? 'created' : 'already_paid', processedAt: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ success: true, message: result.created ? 'Order processed.' : 'Already processed.' });
  } catch (error) {
    console.error('[Razorpay Webhook Error]', error.message);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Webhook processing error.' });
  }
}

app.post('/api/razorpay-webhook', (req, res) => handleRazorpayWebhookRequest(req, res));

async function verifyRazorpayPaymentRequest(req, res, dependencies = {}) {
  const database = dependencies.database || db;
  const paymentGateway = dependencies.paymentGateway || gateway;
  const finalize = dependencies.finalize || createRazorpayPaidOrder;
  const { orderId, payment } = req.body || {};
  if (!database) return res.status(500).json({ success: false, message: 'Server database is not initialized.' });
  if (!orderId || typeof orderId !== 'string' || !payment || typeof payment !== 'object') {
    return res.status(400).json({ success: false, message: 'Validation Error: payment verification details are required.' });
  }
  try {
    const pending = await database.collection('pendingOrders').doc(orderId).get();
    if (!pending.exists || pending.data()?.razorpayOrderId !== orderId) {
      // A captured webhook may have finalized and deleted pending context before
      // the browser returns. Authenticate the original callback and match the
      // recorded payment before releasing any protected order details.
      const paidSnapshot = await database.collection('orders').doc(orderId).get();
      const paidOrder = paidSnapshot.exists ? paidSnapshot.data() : null;
      const paidTotal = Number(paidOrder?.pricing?.total);
      if (paidOrder?.status !== 'paid' || paidOrder?.payment?.gateway !== 'razorpay'
        || paidOrder?.payment?.razorpayOrderId !== orderId || !Number.isFinite(paidTotal) || paidTotal <= 0) {
        return res.status(409).json({ success: false, message: 'Payment order context is missing. Please contact support with your order ID.' });
      }
      const verification = await paymentGateway.verifyPayment({
        orderId, paymentData: payment, orderDetails: { totalAmount: paidTotal },
      });
      if (!verification.verified || verification.gatewayPaymentId !== paidOrder.payment.razorpayPaymentId
        || verification.gatewayOrderId !== orderId || verification.orderCurrency !== 'INR'
        || Math.round(Number(verification.orderAmount) * 100) !== Math.round(paidTotal * 100)) {
        return res.status(401).json({ success: false, paymentStatus: 'unverified', message: 'Payment could not be verified for this order.' });
      }
      return res.status(200).json(paymentResponse(orderId, paidOrder));
    }
    const verification = await paymentGateway.verifyPayment({ orderId, paymentData: payment, orderDetails: pending.data() });
    if (!verification.verified) {
      await database.runTransaction(async (transaction) => {
        const current = await transaction.get(pending.ref);
        if (!current.exists || current.data()?.paymentStatus === 'captured') return;
        transaction.set(pending.ref, { paymentStatus: verification.paymentStatus || 'pending', updatedAt: new Date().toISOString() }, { merge: true });
      });
      return res.status(200).json({
        success: false,
        paymentStatus: verification.paymentStatus || 'pending',
        message: verification.paymentStatus === 'failed' ? 'Payment failed. Please try again.' : 'Payment is still pending confirmation.',
      });
    }
    const result = await finalize(orderId, verification, 'checkout', { database });
    return res.status(200).json(paymentResponse(orderId, result.order));
  } catch (error) {
    if (error.code === 'captured-inventory-conflict') {
      return res.status(409).json({
        success: false, orderId, orderStatus: 'requires_review', paymentStatus: 'captured',
        message: error.message,
      });
    }
    console.error('[Razorpay Verification Error]', error.message);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Payment verification failed.' });
  }
}

app.post('/api/verify-payment', (req, res) => verifyRazorpayPaymentRequest(req, res));

/**
 * NEWSLETTER SUBSCRIPTION ENDPOINT
 * POST /api/subscribe
 * Receives: { email }
 * Returns: { success: true/false, message }
 */
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Please provide a valid email address.',
    });
  }

  try {
    const sanitizedEmail = email.trim().toLowerCase().slice(0, 254);

    if (db) {
      // Check if already subscribed to avoid duplicates
      const snapshot = await db
        .collection('newsletter')
        .where('email', '==', sanitizedEmail)
        .limit(1)
        .get();

      if (snapshot.empty) {
        await db.collection('newsletter').add({
          email: sanitizedEmail,
          subscribedAt: new Date().toISOString(),
        });
        console.log(`[Newsletter] New subscription: ${sanitizedEmail}`);
      } else {
        console.log(`[Newsletter] Already subscribed: ${sanitizedEmail}`);
      }
    } else {
      console.warn('[Firebase Warn] Firestore DB is not initialized. Subscription was not saved.');
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you for subscribing!',
    });
  } catch (error) {
    console.error('[Newsletter Error] Subscription failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete subscription. Please try again later.',
    });
  }
});

// ============================================================================
// EXPORT FOR FIREBASE CLOUD FUNCTIONS + LOCAL DEV
// ============================================================================
// When running locally via `node server.cjs`, start the Express server.
// When deployed as a Cloud Function, the function wrapper imports `app`.
// ============================================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Server] Backend running on port ${PORT}`);
  });
}

module.exports = { app, calculateCheckoutPricing, pendingOrderItem, paidOrderItem, parseNewProductSizes, coupleStockAdapters };
