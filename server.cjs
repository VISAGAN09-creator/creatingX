const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
require('dotenv').config();

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
 * Receives: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Returns: { success: true/false }
 */
app.post('/api/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Error handling: Missing fields
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Missing order_id, payment_id, or signature.',
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
      return res.status(200).json({
        success: true,
        message: 'Payment signature verified successfully.',
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
