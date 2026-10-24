const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
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
app.use(helmet());
const PORT = process.env.PORT || 5000;

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
function stockAdapter(data) {
  const empty = { quantities: {}, configured: new Set(), editable: false, kind: 'none', field: null };

  for (const field of ['sizes', 'sizeStock', 'stockBySize', 'stock']) {
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
  const adapter = stockAdapter(data);
  return {
    schema: adapter.kind,
    editable: adapter.editable,
    sizes: Object.fromEntries(SUPPORTED_SIZES.map((size) => [size, adapter.configured.has(size) ? adapter.quantities[size] ?? 0 : null])),
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

function fulfillmentOrderRef(status, orderId) {
  return db.collection(FULFILLMENT_COLLECTIONS[status]).doc(orderId);
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
 * Canonical paid orders must remain in /orders because Cashfree return-page
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
    const sizes = item?.couple
      ? [normalizeSize(item?.selectedMensSize), normalizeSize(item?.selectedWomensSize)]
      : [normalizeSize(item?.selectedSize)];
    if (!collectionName || !documentId || sizes.some((size) => !size) || !Number.isSafeInteger(quantity) || quantity < 1) {
      const error = new Error('Order inventory details are incomplete.');
      error.code = 'inventory-invalid-order';
      throw error;
    }
    const key = `${collectionName}\u0000${documentId}`;
    const group = groups.get(key) || { collectionName, documentId, quantities: {} };
    for (const size of sizes) {
      group.quantities[size] = (group.quantities[size] || 0) + quantity;
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

async function createPaidOrderWithFulfillment(orderId, orderData, inventoryItems = []) {
  const orderRef = db.collection('orders').doc(orderId);
  const now = new Date().toISOString();
  const completedOrder = {
    ...orderData,
    fulfillmentStatus: 'production',
    fulfillmentUpdatedAt: now,
  };

  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(orderRef);
    if (existing.exists) {
      return { created: false, order: existing.data() };
    }

    const groups = inventoryGroups(inventoryItems);
    const stockDocuments = await Promise.all(groups.map(async (group) => ({
      group,
      ref: db.collection(group.collectionName).doc(group.documentId),
      snapshot: await transaction.get(db.collection(group.collectionName).doc(group.documentId)),
    })));

    for (const stockDocument of stockDocuments) {
      if (!stockDocument.snapshot.exists) {
        const error = new Error('A purchased product no longer exists.');
        error.code = 'inventory-insufficient';
        throw error;
      }
      const data = stockDocument.snapshot.data();
      const adapter = stockAdapter(data);
      const nextQuantities = {};
      for (const [size, requested] of Object.entries(stockDocument.group.quantities)) {
        const available = adapter.configured.has(size) ? adapter.quantities[size] ?? 0 : 0;
        if (!adapter.editable || available < requested) {
          const error = new Error(`${data.name || data.title || stockDocument.group.documentId} (${size}) is no longer in stock.`);
          error.code = 'inventory-insufficient';
          throw error;
        }
        nextQuantities[size] = available - requested;
      }
      transaction.update(stockDocument.ref, applyStockChanges(data, adapter, nextQuantities));
    }

    transaction.create(orderRef, completedOrder);
    transaction.set(fulfillmentOrderRef('production', orderId), completedOrder);
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
  return {
    productId: `${slugify(collectionName)}-${document.id}`,
    collectionName,
    documentId: document.id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim()
      : typeof data.title === 'string' && data.title.trim() ? data.title.trim()
        : document.id,
    version: documentVersion(document),
    ...stockSummary(data),
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

async function updateInventoryProduct(update, adminUid) {
  const productId = typeof update?.productId === 'string' ? update.productId.trim() : '';
  const expectedVersion = typeof update?.version === 'string' ? update.version : '';
  const changes = parseInventoryChanges(update?.changes);
  if (!productId || !expectedVersion || !changes) {
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
    const patch = applyStockChanges(data, adapter, changes);
    transaction.update(reference, patch);
    return { productId, changes, previous: stockSummary(data), adminUid };
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
      successful.push({ productId: result.productId, changes: result.changes });
    } catch (error) {
      console.error(`[Admin Inventory] Failed to update ${productId}:`, error.message);
      const message = error.code === 'inventory-conflict'
        ? error.message
        : error.code === 'size-not-configured' || error.code === 'stock-schema-readonly'
          ? error.message
          : error.code === 'product-not-found'
            ? 'Product no longer exists.'
            : 'Unable to save this product inventory.';
      failed.push({ productId, message, code: error.code || 'inventory-save-failed' });
    }
  }

  return res.status(failed.length ? 207 : 200).json({ success: failed.length === 0, successful, failed });
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

  try {
    // --- Resolve each item from Firestore and compute authoritative prices ---
    const resolvedItems = [];
    let totalAmount = 0;

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

      if (couple && (!selectedMensSize || !selectedWomensSize)) {
        return res.status(400).json({
          success: false,
          message: `Select both men's and women's sizes for "${productId}" before checkout.`,
        });
      }

      if (!couple && !product.selectedSize) {
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
        selectedSize: couple ? undefined : product.selectedSize,
        selectedMensSize: selectedMensSize || undefined,
        selectedWomensSize: selectedWomensSize || undefined,
        selectedColor,
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
      const selectedSizes = item.couple
        ? [item.selectedMensSize, item.selectedWomensSize]
        : [item.selectedSize];
      for (const size of selectedSizes) {
        const key = `${item.collectionName}\u0000${item.firestoreDocId}\u0000${size}`;
        requestedByVariant.set(key, (requestedByVariant.get(key) || 0) + item.quantity);
      }
    }
    for (const [key, requested] of requestedByVariant) {
      const [, , size] = key.split('\u0000');
      const item = resolvedItems.find((candidate) =>
        candidate.collectionName === key.split('\u0000')[0] &&
        candidate.firestoreDocId === key.split('\u0000')[1],
      );
      const adapter = stockAdapter(item && (await db.collection(item.collectionName).doc(item.firestoreDocId).get()).data());
      const available = adapter.configured.has(size) ? adapter.quantities[size] ?? 0 : 0;
      if (!adapter.editable || available < requested) {
        return res.status(409).json({ success: false, message: `${item.name} (${size}) is out of stock or has insufficient stock.` });
      }
    }

    // Catalog prices are the intended payable prices. Shipping is currently
    // free and no additional tax is charged at checkout.
    const subtotalAmount = Math.round(totalAmount * 100) / 100;
    const taxAmount = 0;
    const shippingAmount = 0;
    totalAmount = Math.round((subtotalAmount + shippingAmount) * 100) / 100;

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must be greater than zero.',
      });
    }

    // --- Build return URL ---
    // A reverse-proxied storefront can live below a path (for example,
    // /varataaa). Origin headers never include that path, so Production uses
    // an explicit server-side return URL when configured.
    const configuredReturnUrl = process.env.PAYMENT_RETURN_URL?.trim();
    const origin = req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, '') || 'https://ecommerce-f1448.web.app';
    const returnUrl = configuredReturnUrl || `${origin}/#payment-return`;

    // --- Build customer info ---
    const customerName = typeof customer?.name === 'string' ? customer.name.trim() : 'Customer';
    const customerEmail = typeof customer?.email === 'string' ? customer.email.trim() : '';
    const customerPhone = typeof customer?.phone === 'string' ? customer.phone.replace(/[^0-9+]/g, '') : '';

    console.log(`[Payment] Creating order: ${resolvedItems.length} item(s), total: ${totalAmount} INR`);

    // --- Store pending order context in Firestore for later verification ---
    const pendingOrderData = {
      items: resolvedItems.map(i => ({
        productId: i.productId,
        firestoreDocId: i.firestoreDocId,
        collectionName: i.collectionName,
        couple: i.couple,
        selectedSize: i.selectedSize,
        selectedMensSize: i.selectedMensSize,
        selectedWomensSize: i.selectedWomensSize,
        selectedColor: i.selectedColor,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        image: i.image,
      })),
      subtotalAmount,
      taxAmount,
      totalAmount,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      shipping: shipping || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const order = await gateway.createOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      customer: {
        id: `cust_${Date.now()}`,
        email: customerEmail || 'test@cashfree.com',
        phone: customerPhone || '9999999999',
        name: customerName,
      },
      returnUrl,
      items: resolvedItems,
    });

    // Store pending order data keyed by Cashfree order_id for verification later
    if (db && order.gatewayData?.order_id) {
      pendingOrderData.cashfreeOrderId = order.gatewayData.order_id;
      pendingOrderData.cfOrderId = order.gatewayData.cf_order_id || '';
      await db.collection('pendingOrders').doc(order.gatewayData.order_id).set(pendingOrderData);
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

    return res.status(500).json({
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * STEP 2: VERIFY PAYMENT ENDPOINT
 * POST /api/verify-payment
 * Receives: { orderId } — the Cashfree order_id returned in the redirect URL
 * Returns: { success, orderId, paymentStatus, order }
 *
 * This endpoint verifies the payment with Cashfree's API (server-to-server),
 * then writes the order to Firestore ONLY if the payment is genuinely PAID.
 * The operation is idempotent: refreshing the return page won't create duplicates.
 */
app.post('/api/verify-payment', async (req, res) => {
  const { orderId: cashfreeOrderId } = req.body;

  if (!cashfreeOrderId || typeof cashfreeOrderId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: orderId is required.',
    });
  }

  try {
    // --- Idempotency check: the Cashfree order ID is the Firestore document ID. ---
    // A deterministic document lets return-page verification and the webhook
    // converge on the same record.
    const paidOrderRef = db ? db.collection('orders').doc(cashfreeOrderId) : null;
    if (db) {
      const existingDoc = await paidOrderRef.get();
      if (existingDoc.exists) {
        const existingData = existingDoc.data();
        console.log(`[Payment] Order ${cashfreeOrderId} already verified (idempotent).`);
        return res.status(200).json({
          success: true,
          message: 'Payment already verified.',
          orderId: cashfreeOrderId,
          paymentStatus: existingData.status,
          order: {
            items: existingData.items,
            totalAmount: existingData.pricing?.total,
            customer: existingData.customer,
          },
        });
      }
    }

    // --- Verify with Cashfree API ---
    const verification = await gateway.verifyPayment({ orderId: cashfreeOrderId });

    if (verification.verified) {
      console.log(`[Payment] Verification successful for Cashfree order: ${cashfreeOrderId}`);

      let firestoreOrderId = '';
      let orderDetails = null;

      if (db) {
        // Retrieve the pending order context we saved during create-order
        const pendingSnap = await db.collection('pendingOrders').doc(cashfreeOrderId).get();
        const pendingData = pendingSnap.exists ? pendingSnap.data() : null;

        if (!pendingData) {
          console.warn(`[Payment] No pending order found for ${cashfreeOrderId}; refusing to persist it.`);
          return res.status(409).json({
            success: false,
            message: 'Payment order context is missing. Please contact support with your order ID.',
            orderId: cashfreeOrderId,
            paymentStatus: verification.paymentStatus,
          });
        }

        const items = pendingData?.items || [];
        const customer = pendingData?.customer || {};
        const shipping = pendingData?.shipping || {};
        // New orders have zero additional tax. Legacy pending orders retain
        // their stored amount so a previously created Cashfree order can still
        // be verified accurately.
        const serverSubtotal = Math.round(items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 100) / 100;
        const cashfreeTotal = Number(verification.orderAmount);
        const storedTax = Number(pendingData?.taxAmount);
        // Legacy pending orders predate tax-inclusive Cashfree charges. Preserve
        // their actual Cashfree amount instead of recording a different total.
        const serverTax = Number.isFinite(storedTax)
          ? storedTax
          : Math.max(0, Math.round((cashfreeTotal - serverSubtotal) * 100) / 100);
        const serverShipping = 0;
        const expectedTotal = Number.isFinite(Number(pendingData?.totalAmount))
          ? Number(pendingData.totalAmount)
          : serverSubtotal + serverTax + serverShipping;

        if (verification.orderCurrency !== 'INR' || !Number.isFinite(cashfreeTotal) || cashfreeTotal <= 0 ||
          Math.round(cashfreeTotal * 100) !== Math.round(expectedTotal * 100)) {
          throw new Error('Cashfree amount does not match the server-calculated order total.');
        }

        const finalOrderData = {
          customer: {
            email: sanitizeString(customer.email, 254),
            firstName: sanitizeString(customer.name?.split(' ')[0] || customer.firstName || '', 100),
            lastName: sanitizeString(customer.name?.split(' ').slice(1).join(' ') || customer.lastName || '', 100),
            phone: sanitizeString(customer.phone, 20),
          },
          shipping: {
            country: sanitizeString(shipping.country, 5),
            address: sanitizeString(shipping.address, 500),
            apartment: sanitizeString(shipping.apartment, 200),
            city: sanitizeString(shipping.city, 100),
            state: sanitizeString(shipping.state, 100),
            pinCode: sanitizeString(shipping.pinCode, 10),
          },
          items: items.map(item => ({
            id: sanitizeString(item.productId || item.id, 100),
            name: sanitizeString(item.name, 200),
            size: normalizeSize(item.selectedSize) || undefined,
            couple: item.couple === true || undefined,
            mensSize: normalizeSize(item.selectedMensSize) || undefined,
            womensSize: normalizeSize(item.selectedWomensSize) || undefined,
            color: sanitizeString(item.selectedColor, 100) || undefined,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            image: sanitizeString(item.image, 2000),
          })),
          pricing: {
            subtotal: serverSubtotal,
            tax: serverTax,
            shipping: serverShipping,
            total: cashfreeTotal,
          },
          payment: {
            gateway: gateway.gatewayName,
            cashfreeOrderId: cashfreeOrderId,
            transactionId: verification.gatewayPaymentId,
            paymentStatus: verification.paymentStatus,
          },
          status: 'paid',
          createdAt: new Date().toISOString(),
        };

        let orderWrite;
        try {
          orderWrite = await createPaidOrderWithFulfillment(cashfreeOrderId, finalOrderData, items);
        } catch (inventoryError) {
          if (inventoryError.code === 'inventory-insufficient' || inventoryError.code === 'inventory-invalid-order') {
            console.error(`[Inventory] Paid order ${cashfreeOrderId} requires manual resolution:`, inventoryError.message);
            return res.status(409).json({
              success: false,
              message: `Payment was confirmed, but inventory could not be allocated. Please contact support with order ${cashfreeOrderId}.`,
              orderId: cashfreeOrderId,
              paymentStatus: 'paid',
              inventoryConflict: true,
            });
          }
          throw inventoryError;
        }
        if (!orderWrite.created) {
          const existingData = orderWrite.order;
          return res.status(200).json({
            success: true,
            message: 'Payment already verified.',
            orderId: cashfreeOrderId,
            paymentStatus: existingData?.status || 'paid',
            order: {
              items: existingData?.items || [],
              totalAmount: existingData?.pricing?.total || 0,
              customer: existingData?.customer || {},
            },
          });
        }

        firestoreOrderId = cashfreeOrderId;
        orderDetails = { items: finalOrderData.items, totalAmount: finalOrderData.pricing.total, customer: finalOrderData.customer };
        console.log(`[Firestore] Order document created: ${firestoreOrderId}`);

        // Send confirmation email
        try {
          const itemsListHtml = finalOrderData.items
            .map(line => `<li>${escapeHtml(line.name)} x ${line.quantity} - ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(line.price * line.quantity)}</li>`)
            .join('');

          if (finalOrderData.customer.email) {
            await db.collection('mail').add({
              to: finalOrderData.customer.email,
              message: {
                subject: `Order Confirmation - Order #${firestoreOrderId.slice(0, 8).toUpperCase()}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
                    <h2 style="font-size: 24px; font-weight: bold; border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 20px;">Order Confirmed!</h2>
                    <p>Hi ${escapeHtml(finalOrderData.customer.firstName)},</p>
                    <p>Thank you for shopping with us! Your payment was successful.</p>
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; font-size: 16px;">Order Summary</h3>
                      <ul>${itemsListHtml}</ul>
                      <p style="margin-bottom: 0; font-weight: bold;">Total Paid: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(finalOrderData.pricing.total)}</p>
                    </div>
                    <p style="font-size: 12px; color: #888888; margin-top: 40px; border-top: 1px solid #e0e0e0; padding-top: 15px;">If you have any questions, contact customer support.</p>
                  </div>
                `,
              },
            });
          }
        } catch (emailErr) {
          console.warn('[Email] Failed to create mail trigger:', emailErr.message);
        }

        // Clean up pending order
        try {
          await db.collection('pendingOrders').doc(cashfreeOrderId).delete();
        } catch (e) { /* ignore */ }
      } else {
        firestoreOrderId = 'dev_mock_' + Math.random().toString(36).substr(2, 9);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified and order stored successfully.',
        orderId: firestoreOrderId,
        paymentStatus: 'paid',
        order: orderDetails,
      });
    } else {
      // Payment not successful
      console.warn(`[Payment] Order ${cashfreeOrderId} not paid. Status: ${verification.paymentStatus}`);
      return res.status(200).json({
        success: false,
        message: `Payment not completed. Status: ${verification.paymentStatus || 'UNKNOWN'}`,
        paymentStatus: verification.paymentStatus || 'UNKNOWN',
      });
    }
  } catch (error) {
    console.error('[Verification Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal verification process error.',
    });
  }
});

/**
 * CASHFREE WEBHOOK ENDPOINT
 * POST /api/cashfree-webhook
 * Receives Cashfree webhook notifications for payment events.
 * Idempotent: if order already processed, skips.
 */
app.post('/api/cashfree-webhook', async (req, res) => {
  try {
    const { data, type, event_time } = req.body || {};

    // Cashfree sends different event types; we care about payment success
    if (!data || !data.order) {
      return res.status(200).json({ success: true, message: 'Ignored: no order data.' });
    }

    const cashfreeOrderId = data.order.order_id;
    const paymentStatus = data.payment?.payment_status || data.order.order_status;

    console.log(`[Webhook] Received ${type || 'event'} for order ${cashfreeOrderId}, status: ${paymentStatus}`);

    if (paymentStatus !== 'SUCCESS' && paymentStatus !== 'PAID') {
      console.log(`[Webhook] Ignoring non-success status: ${paymentStatus}`);
      return res.status(200).json({ success: true, message: 'Acknowledged.' });
    }

    if (!db) {
      console.warn('[Webhook] Firestore not initialized, cannot process webhook.');
      return res.status(200).json({ success: true, message: 'Acknowledged (no DB).' });
    }

    // Idempotency: return-page verification and webhooks share this one
    // deterministic document, keyed by Cashfree order ID.
    const paidOrderRef = db.collection('orders').doc(cashfreeOrderId);
    const existing = await paidOrderRef.get();

    if (existing.exists) {
      console.log(`[Webhook] Order ${cashfreeOrderId} already processed. Skipping.`);
      return res.status(200).json({ success: true, message: 'Already processed.' });
    }

    // Verify with Cashfree API (don't trust webhook data alone)
    const verification = await gateway.verifyPayment({ orderId: cashfreeOrderId });

    if (!verification.verified) {
      console.warn(`[Webhook] Server-side verification failed for ${cashfreeOrderId}`);
      return res.status(200).json({ success: true, message: 'Verification failed.' });
    }

    // Retrieve pending order
    const pendingSnap = await db.collection('pendingOrders').doc(cashfreeOrderId).get();
    const pendingData = pendingSnap.exists ? pendingSnap.data() : null;

    if (!pendingData) {
      console.warn(`[Webhook] No pending order for ${cashfreeOrderId}`);
      return res.status(200).json({ success: true, message: 'No pending order found.' });
    }

    const items = pendingData.items || [];
    const customer = pendingData.customer || {};
    const shipping = pendingData.shipping || {};
    const serverSubtotal = Math.round(items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 100) / 100;
    const cashfreeTotal = Number(verification.orderAmount);
    const storedTax = Number(pendingData?.taxAmount);
    const serverTax = Number.isFinite(storedTax)
      ? storedTax
      : Math.max(0, Math.round((cashfreeTotal - serverSubtotal) * 100) / 100);
    const serverShipping = 0;
    const expectedTotal = Number.isFinite(Number(pendingData?.totalAmount))
      ? Number(pendingData.totalAmount)
      : serverSubtotal + serverTax + serverShipping;

    if (verification.orderCurrency !== 'INR' || !Number.isFinite(cashfreeTotal) || cashfreeTotal <= 0 ||
      Math.round(cashfreeTotal * 100) !== Math.round(expectedTotal * 100)) {
      throw new Error('Cashfree amount does not match the server-calculated order total.');
    }

    const finalOrderData = {
      customer: {
        email: sanitizeString(customer.email, 254),
        firstName: sanitizeString(customer.name?.split(' ')[0] || '', 100),
        lastName: sanitizeString(customer.name?.split(' ').slice(1).join(' ') || '', 100),
        phone: sanitizeString(customer.phone, 20),
      },
      shipping: {
        country: sanitizeString(shipping.country, 5),
        address: sanitizeString(shipping.address, 500),
        apartment: sanitizeString(shipping.apartment, 200),
        city: sanitizeString(shipping.city, 100),
        state: sanitizeString(shipping.state, 100),
        pinCode: sanitizeString(shipping.pinCode, 10),
      },
      items: items.map(item => ({
        id: sanitizeString(item.productId || item.id, 100),
        name: sanitizeString(item.name, 200),
        size: normalizeSize(item.selectedSize) || undefined,
        couple: item.couple === true || undefined,
        mensSize: normalizeSize(item.selectedMensSize) || undefined,
        womensSize: normalizeSize(item.selectedWomensSize) || undefined,
        color: sanitizeString(item.selectedColor, 100) || undefined,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        image: sanitizeString(item.image, 2000),
      })),
      pricing: { subtotal: serverSubtotal, tax: serverTax, shipping: serverShipping, total: cashfreeTotal },
      payment: {
        gateway: gateway.gatewayName,
        cashfreeOrderId,
        transactionId: verification.gatewayPaymentId,
        paymentStatus: verification.paymentStatus,
      },
      status: 'paid',
      createdAt: new Date().toISOString(),
      source: 'webhook',
    };

    const orderWrite = await createPaidOrderWithFulfillment(cashfreeOrderId, finalOrderData, items);
    if (!orderWrite.created) {
      return res.status(200).json({ success: true, message: 'Already processed.' });
    }

    console.log(`[Webhook] Order created for ${cashfreeOrderId}`);

    // Clean up pending order
    try { await db.collection('pendingOrders').doc(cashfreeOrderId).delete(); } catch (e) { /* ignore */ }

    return res.status(200).json({ success: true, message: 'Order processed via webhook.' });
  } catch (error) {
    console.error('[Webhook Error]', error);
    // Always return 200 to Cashfree so they don't retry indefinitely
    return res.status(200).json({ success: false, message: 'Webhook processing error.' });
  }
});
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

module.exports = { app };
