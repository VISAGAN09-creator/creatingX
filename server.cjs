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
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];

  if (envOrigins) {
    // Merge production origins with dev origins (dev origins are harmless in prod)
    const prodOrigins = envOrigins.split(',').map(o => o.trim()).filter(Boolean);
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

/**
 * STEP 1: CREATE ORDER ENDPOINT
 * POST /api/create-order
 * Receives: { amount (smallest currency unit), currency, receipt }
 * Returns: { success, orderId, amount, currency, gatewayData }
 *
 * This endpoint is gateway-agnostic. The actual order creation is
 * delegated to the gateway adapter in gateway/index.cjs.
 */
app.post('/api/create-order', async (req, res) => {
  const { amount, currency = 'INR', receipt = 'receipt_order_' + Date.now() } = req.body;

  // Error handling: Validate amount >= 100 (smallest currency unit)
  if (!amount || typeof amount !== 'number' || amount < 100) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Amount must be a number and at least 100 (smallest currency unit).',
    });
  }

  try {
    console.log(`[Payment] Creating order for amount: ${amount} (${amount / 100} ${currency})`);
    const order = await gateway.createOrder({ amount, currency, receipt });

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

/**
 * STEP 2: VERIFY PAYMENT ENDPOINT
 * POST /api/verify-payment
 * Receives: { paymentData, orderDetails }
 *   - paymentData:   Gateway-specific data from the client checkout callback
 *   - orderDetails:  Customer, shipping, items, pricing from the checkout form
 * Returns: { success: true/false, orderId }
 *
 * This endpoint is gateway-agnostic. Signature/hash verification is delegated
 * to the gateway adapter. All validation, Firestore writes, and email logic
 * remain here in the server.
 */
app.post('/api/verify-payment', async (req, res) => {
  const { paymentData, orderDetails } = req.body;

  // Error handling: Missing top-level fields
  if (!paymentData || !orderDetails) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Missing paymentData or orderDetails.',
    });
  }

  // ============================================================================
  // INPUT SANITIZATION & VALIDATION HELPERS
  // ============================================================================

  /**
   * Strip HTML tags and trim whitespace to prevent XSS payloads from being
   * stored in Firestore and rendered in admin dashboards or confirmation emails.
   */
  function sanitizeString(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    return value.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
  }

  /**
   * HTML-entity-encode special characters for safe embedding in HTML email.
   * Defense-in-depth: even if sanitizeString misses something, this ensures
   * the value is rendered as text, not interpreted as HTML/script.
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isPositiveNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  // ============================================================================
  // EXTRACT & VALIDATE — only the fields the server expects
  // ============================================================================

  const { customer, shipping, items, pricing } = orderDetails || {};

  // --- Customer validation ---
  if (!customer || typeof customer !== 'object') {
    return res.status(400).json({ success: false, message: 'Validation Error: Missing customer details.' });
  }

  const validatedCustomer = {
    email:     sanitizeString(customer.email, 254),
    firstName: sanitizeString(customer.firstName, 100),
    lastName:  sanitizeString(customer.lastName, 100),
    phone:     sanitizeString(customer.phone, 20),
  };

  if (!validatedCustomer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(validatedCustomer.email)) {
    return res.status(400).json({ success: false, message: 'Validation Error: Invalid customer email.' });
  }
  if (!validatedCustomer.firstName) {
    return res.status(400).json({ success: false, message: 'Validation Error: Customer first name is required.' });
  }

  // --- Shipping validation ---
  if (!shipping || typeof shipping !== 'object') {
    return res.status(400).json({ success: false, message: 'Validation Error: Missing shipping details.' });
  }

  const validatedShipping = {
    country:   sanitizeString(shipping.country, 5),
    address:   sanitizeString(shipping.address, 500),
    apartment: sanitizeString(shipping.apartment, 200),
    city:      sanitizeString(shipping.city, 100),
    state:     sanitizeString(shipping.state, 100),
    pinCode:   sanitizeString(shipping.pinCode, 10),
  };

  if (!validatedShipping.address || !validatedShipping.city || !validatedShipping.pinCode) {
    return res.status(400).json({ success: false, message: 'Validation Error: Incomplete shipping address.' });
  }

  // --- Items validation ---
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ success: false, message: 'Validation Error: Items must be a non-empty array (max 50).' });
  }

  const validatedItems = items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Item at index ${index} is not a valid object.`);
    }
    const name     = sanitizeString(item.name, 200);
    const price    = Number(item.price);
    const quantity = Number(item.quantity);

    if (!name) throw new Error(`Item at index ${index} is missing a name.`);
    if (!isPositiveNumber(price) || price > 10000000) throw new Error(`Item at index ${index} has an invalid price.`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error(`Item at index ${index} has an invalid quantity.`);

    return {
      id:       sanitizeString(item.id, 100),
      name,
      price,
      quantity,
      image:    sanitizeString(item.image, 2000),
    };
  });

  // --- Pricing validation ---
  // Server recomputes totals from validated items to prevent price tampering.
  if (!pricing || typeof pricing !== 'object') {
    return res.status(400).json({ success: false, message: 'Validation Error: Missing pricing details.' });
  }

  const serverSubtotal = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const serverTax      = Math.round(serverSubtotal * 0.18 * 100) / 100;
  const serverShipping = (validatedShipping.address.length > 5 && validatedShipping.pinCode.length === 6) ? 0 : 150;
  const serverTotal    = serverSubtotal + serverTax + serverShipping;

  const validatedPricing = {
    subtotal: serverSubtotal,
    tax:      serverTax,
    shipping: serverShipping,
    total:    serverTotal,
  };

  // ============================================================================
  // PAYMENT VERIFICATION — delegated to gateway adapter
  // ============================================================================

  try {
    const verification = await gateway.verifyPayment({ paymentData, orderDetails });

    if (verification.verified) {
      console.log(`[Payment] Verification successful for gateway order: ${verification.gatewayOrderId}`);

      let orderId = '';

      if (db) {
        // ================================================================
        // Construct order document from VALIDATED data only.
        // Server controls status, payment, and createdAt — never the client.
        // ================================================================
        const finalOrderData = {
          customer: validatedCustomer,
          shipping: validatedShipping,
          items:    validatedItems,
          pricing:  validatedPricing,
          payment: {
            gateway:   gateway.gatewayName,
            paymentId: verification.gatewayPaymentId,
            orderId:   verification.gatewayOrderId,
          },
          status:    'paid',
          createdAt: new Date().toISOString(),
        };

        // 1. Create order document in Firestore using Admin SDK
        const orderRef = await db.collection('orders').add(finalOrderData);
        orderId = orderRef.id;
        console.log(`[Firestore] Order document successfully created with ID: ${orderId}`);

        // 2. Create email document to trigger Firebase trigger-email extension
        //    Uses SANITIZED data throughout to prevent XSS in email content.
        const itemsListHtml = validatedItems
          .map(
            (line) =>
              `<li>${escapeHtml(line.name)} x ${line.quantity} - ${new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 2,
              }).format(line.price * line.quantity)}</li>`
          )
          .join('');

        await db.collection('mail').add({
          to: validatedCustomer.email,
          message: {
            subject: `Order Confirmation - Order #${orderId.slice(0, 8).toUpperCase()}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
                <h2 style="font-size: 24px; font-weight: bold; border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 20px;">
                  Order Confirmed!
                </h2>
                <p>Hi ${escapeHtml(validatedCustomer.firstName)},</p>
                <p>Thank you for shopping with us! Your payment was successful, and we are preparing your order.</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; font-size: 16px;">Order Summary</h3>
                  <ul>
                    ${itemsListHtml}
                  </ul>
                  <p style="margin-bottom: 0; font-weight: bold;">Total Paid: ${new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 2,
                  }).format(validatedPricing.total)}</p>
                </div>

                <div style="margin: 20px 0;">
                  <h3 style="font-size: 16px;">Delivery Details</h3>
                  <p style="margin: 0; color: #555555;">
                    ${escapeHtml(validatedShipping.address)}${validatedShipping.apartment ? `, ${escapeHtml(validatedShipping.apartment)}` : ''}<br>
                    ${escapeHtml(validatedShipping.city)}, ${escapeHtml(validatedShipping.state)} ${escapeHtml(validatedShipping.pinCode)}<br>
                    ${escapeHtml(validatedShipping.country)}
                  </p>
                </div>

                <p style="font-size: 12px; color: #888888; margin-top: 40px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                  If you have any questions, reply to this email or contact customer support.
                </p>
              </div>
            `,
          },
        });
        console.log(`[Firestore] Mail trigger document successfully created for: ${validatedCustomer.email}`);
      } else {
        console.warn('[Firebase Warn] Firestore DB is not initialized. Order was not saved to database.');
        // In local dev/testing without firebase config, return a mock order ID
        orderId = 'dev_mock_id_' + Math.random().toString(36).substr(2, 9);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified and order stored successfully.',
        orderId,
      });
    } else {
      console.warn(`[Payment Warn] Verification failed for gateway order: ${verification.gatewayOrderId}`);
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed.',
      });
    }
  } catch (error) {
    console.error('[Verification Error] Payment verification failed:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal verification process error.',
    });
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

app.listen(PORT, () => {
  console.log(`[Server] Backend running on port ${PORT}`);
});
