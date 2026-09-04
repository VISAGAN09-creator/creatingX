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
  allowedHeaders: ['Content-Type'],    // Only headers your API actually needs
  credentials: false,                  // Set to true if you add cookie-based auth later
  maxAge: 86400,                       // Cache preflight for 24h to reduce OPTIONS calls
}));
app.use(express.json({ limit: '100kb' }));

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

// Apply general limiter to all /api/ routes
app.use('/api/', apiLimiter);

// Apply stricter limiter specifically to payment-sensitive endpoints
app.use('/api/create-order', paymentLimiter);
app.use('/api/verify-payment', paymentLimiter);

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

/**
 * Resolve a compound React product ID to a Firestore collection + doc.
 * Tries all known collections and returns the first match.
 *
 * @param {string} productId — Compound ID like "products-Connar McGregor"
 * @returns {Promise<{ collectionName: string, docId: string, data: object } | null>}
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
          return { collectionName: colName, docId, data: docSnap.data() };
        }
        
        // If not found, try removing the appended size (e.g., "-S", "-XXL")
        const lastDashIndex = docId.lastIndexOf('-');
        if (lastDashIndex > 0) {
          const docIdWithoutSize = docId.substring(0, lastDashIndex);
          docSnap = await db.collection(colName).doc(docIdWithoutSize).get();
          if (docSnap.exists) {
            return { collectionName: colName, docId: docIdWithoutSize, data: docSnap.data() };
          }
        }
      } catch (e) {
        console.warn(`[Firestore] Error reading ${colName}/${docId}:`, e.message);
      }
    }
  }

  return null;
}

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

      // Extract price from Firestore document (server-authoritative)
      const firestorePrice = Number(product.data.price);
      if (!Number.isFinite(firestorePrice) || firestorePrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Product "${productId}" does not have a valid price.`,
        });
      }

      const lineTotal = firestorePrice * quantity;
      totalAmount += lineTotal;

      resolvedItems.push({
        productId,
        firestoreDocId: product.docId,
        collectionName: product.collectionName,
        name: product.data.name || product.data.title || product.docId,
        price: firestorePrice,
        quantity,
        lineTotal,
        image: product.data.img1 || product.data.image || '',
      });
    }

    // Round to 2 decimal places
    totalAmount = Math.round(totalAmount * 100) / 100;

    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must be greater than zero.',
      });
    }

    // --- Build return URL ---
    // Detect the request origin for the return URL
    const origin = req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, '') || 'https://ecommerce-f1448.web.app';
    const returnUrl = `${origin}/#payment-return`;

    // --- Build customer info ---
    const customerName = typeof customer?.name === 'string' ? customer.name.trim() : 'Customer';
    const customerEmail = typeof customer?.email === 'string' ? customer.email.trim() : '';
    const customerPhone = typeof customer?.phone === 'string' ? customer.phone.replace(/[^0-9+]/g, '') : '';

    console.log(`[Payment] Creating order: ${resolvedItems.length} item(s), total: ${totalAmount} INR`);

    // --- Store pending order context in Firestore for later verification ---
    const pendingOrderData = {
      items: resolvedItems.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        image: i.image,
      })),
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
    // --- Idempotency check: has this order already been processed? ---
    if (db) {
      const existingOrders = await db.collection('orders')
        .where('payment.cashfreeOrderId', '==', cashfreeOrderId)
        .limit(1)
        .get();

      if (!existingOrders.empty) {
        const existingDoc = existingOrders.docs[0];
        const existingData = existingDoc.data();
        console.log(`[Payment] Order ${cashfreeOrderId} already verified (idempotent). Doc: ${existingDoc.id}`);
        return res.status(200).json({
          success: true,
          message: 'Payment already verified.',
          orderId: existingDoc.id,
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
          console.warn(`[Payment] No pending order found for ${cashfreeOrderId}, creating minimal record.`);
        }

        const items = pendingData?.items || [];
        const customer = pendingData?.customer || {};
        const shipping = pendingData?.shipping || {};
        const totalAmount = pendingData?.totalAmount || verification.orderAmount || 0;

        // Server recomputes pricing from stored authoritative data
        const serverSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const serverTax = Math.round(serverSubtotal * 0.18 * 100) / 100;
        const serverShipping = 0;
        const serverTotal = serverSubtotal + serverTax + serverShipping;

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
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            image: sanitizeString(item.image, 2000),
          })),
          pricing: {
            subtotal: serverSubtotal || totalAmount,
            tax: serverTax,
            shipping: serverShipping,
            total: serverTotal || totalAmount,
          },
          payment: {
            gateway: gateway.gatewayName,
            cashfreeOrderId: cashfreeOrderId,
            transactionId: verification.gatewayPaymentId || '',
            paymentStatus: verification.paymentStatus || 'PAID',
          },
          status: 'paid',
          createdAt: new Date().toISOString(),
        };

        // Double-check idempotency one more time (race condition guard)
        const doubleCheck = await db.collection('orders')
          .where('payment.cashfreeOrderId', '==', cashfreeOrderId)
          .limit(1)
          .get();

        if (!doubleCheck.empty) {
          const doc = doubleCheck.docs[0];
          return res.status(200).json({
            success: true,
            message: 'Payment already verified (race condition guard).',
            orderId: doc.id,
            paymentStatus: 'paid',
            order: { items: finalOrderData.items, totalAmount: finalOrderData.pricing.total, customer: finalOrderData.customer },
          });
        }

        const orderRef = await db.collection('orders').add(finalOrderData);
        firestoreOrderId = orderRef.id;
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

    // Idempotency: check if already processed
    const existing = await db.collection('orders')
      .where('payment.cashfreeOrderId', '==', cashfreeOrderId)
      .limit(1)
      .get();

    if (!existing.empty) {
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
    const serverSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const serverTax = Math.round(serverSubtotal * 0.18 * 100) / 100;
    const serverShipping = 0;
    const serverTotal = serverSubtotal + serverTax + serverShipping;

    // Final idempotency guard
    const doubleCheck = await db.collection('orders')
      .where('payment.cashfreeOrderId', '==', cashfreeOrderId)
      .limit(1)
      .get();

    if (!doubleCheck.empty) {
      return res.status(200).json({ success: true, message: 'Already processed (race guard).' });
    }

    await db.collection('orders').add({
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
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        image: sanitizeString(item.image, 2000),
      })),
      pricing: { subtotal: serverSubtotal, tax: serverTax, shipping: serverShipping, total: serverTotal },
      payment: {
        gateway: gateway.gatewayName,
        cashfreeOrderId,
        transactionId: verification.gatewayPaymentId || data.payment?.cf_payment_id || '',
        paymentStatus: 'PAID',
      },
      status: 'paid',
      createdAt: new Date().toISOString(),
      source: 'webhook',
    });

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
