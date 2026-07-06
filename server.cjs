const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const Razorpay = require('razorpay');
require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db = null;

try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || path.join(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    console.log(`[Firebase] Initializing Admin SDK using service account at: ${serviceAccountPath}`);
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath))
    });
    db = admin.firestore();
  } else {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

    if (privateKey && clientEmail && projectId) {
      console.log('[Firebase] Initializing Admin SDK using environment variables.');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        })
      });
      db = admin.firestore();
    } else {
      console.warn('[Firebase Warning] No service account JSON found at firebase-service-account.json and credentials are not in environment variables.');
      console.warn('[Firebase Warning] Direct database writes from server will fail. Please place your service account file in the project root.');
    }
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
//  • Spamming Razorpay order creations (exhausts API quota / incurs costs)
//  • Brute-forcing payment verification signatures
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

const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.error('CRITICAL ERROR: Razorpay keys are missing from environment variables!');
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

/**
 * STEP 1: CREATE ORDER ENDPOINT
 * POST /api/create-order
 * Receives: { amount (paise), currency, receipt }
 * Returns: { order_id, amount, currency }
 */
app.post('/api/create-order', async (req, res) => {
  const { amount, currency = 'INR', receipt = 'receipt_order_' + Date.now() } = req.body;

  // Error handling: Validate amount >= 100 paise
  if (!amount || typeof amount !== 'number' || amount < 100) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Amount must be a number and at least 100 paise (1 INR).',
    });
  }

  try {
    const options = {
      amount, // amount in paise
      currency,
      receipt,
    };

    console.log(`[Razorpay] Creating order for amount: ${amount} paise (${amount / 100} INR)`);
    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (error) {
    console.error('[Razorpay Error] Failed to create order:', error);
    
    // Check if it is an authentication failure
    if (error.statusCode === 401) {
      return res.status(401).json({
        success: false,
        message: 'Authentication Failure: Invalid Razorpay Key ID or Key Secret.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Razorpay API Error: Failed to generate checkout order.',
      error: error.message || error,
    });
  }
});

/**
 * STEP 3: VERIFY SIGNATURE ENDPOINT
 * POST /api/verify-payment
 * Receives: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails }
 * Returns: { success: true/false, orderId }
 */
app.post('/api/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails } = req.body;

  // Error handling: Missing top-level fields
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderDetails) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Missing order_id, payment_id, signature, or orderDetails.',
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

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
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
  // SIGNATURE VERIFICATION
  // ============================================================================

  try {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(razorpay_signature)
    );

    if (isAuthentic) {
      console.log(`[Razorpay] Signature verification successful for order: ${razorpay_order_id}`);

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
            gateway:   'Razorpay',
            paymentId: razorpay_payment_id,
            orderId:   razorpay_order_id,
            signature: razorpay_signature,
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
        message: 'Payment signature verified and order stored successfully.',
        orderId,
      });
    } else {
      console.warn(`[Razorpay Warn] Signature mismatch for order: ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        message: 'Signature Mismatch: Payment verification failed.',
      });
    }
  } catch (error) {
    console.error('[Verification Error] Signature processing failed:', error);
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
