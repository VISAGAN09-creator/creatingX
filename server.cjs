const express = require('express');
const cors = require('cors');
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
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

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

  // Error handling: Missing fields
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderDetails) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Missing order_id, payment_id, signature, or orderDetails.',
    });
  }

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
        // Construct backend order payload
        const finalOrderData = {
          ...orderDetails,
          payment: {
            gateway: 'Razorpay',
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            signature: razorpay_signature,
          },
          status: 'paid',
          createdAt: new Date().toISOString(),
        };

        // 1. Create order document in Firestore using Admin SDK
        const orderRef = await db.collection('orders').add(finalOrderData);
        orderId = orderRef.id;
        console.log(`[Firestore] Order document successfully created with ID: ${orderId}`);

        // 2. Create email document to trigger Firebase trigger-email extension
        const itemsListHtml = orderDetails.items
          .map(
            (line) =>
              `<li>${line.name} x ${line.quantity} - ${new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 2,
              }).format((line.price ?? 0) * line.quantity)}</li>`
          )
          .join('');

        await db.collection('mail').add({
          to: orderDetails.customer.email,
          message: {
            subject: `Order Confirmation - Order #${orderId.slice(0, 8).toUpperCase()}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
                <h2 style="font-size: 24px; font-weight: bold; border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 20px;">
                  Order Confirmed!
                </h2>
                <p>Hi ${orderDetails.customer.firstName},</p>
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
                  }).format(orderDetails.pricing.total)}</p>
                </div>

                <div style="margin: 20px 0;">
                  <h3 style="font-size: 16px;">Delivery Details</h3>
                  <p style="margin: 0; color: #555555;">
                    ${orderDetails.shipping.address}${orderDetails.shipping.apartment ? `, ${orderDetails.shipping.apartment}` : ''}<br>
                    ${orderDetails.shipping.city}, ${orderDetails.shipping.state} ${orderDetails.shipping.pinCode}<br>
                    ${orderDetails.shipping.country}
                  </p>
                </div>

                <p style="font-size: 12px; color: #888888; margin-top: 40px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
                  If you have any questions, reply to this email or contact customer support.
                </p>
              </div>
            `,
          },
        });
        console.log(`[Firestore] Mail trigger document successfully created for: ${orderDetails.customer.email}`);
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
      message: 'Internal verification process error.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Backend running on port ${PORT}`);
});
