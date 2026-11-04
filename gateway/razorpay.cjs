// Razorpay server adapter. All calls requiring the key secret remain here.
const crypto = require('node:crypto');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

function credentialsConfigured() {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

function authorizationHeader() {
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;
}

function secureEqual(expected, received) {
  if (typeof received !== 'string') return false;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!RAZORPAY_KEY_SECRET || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return secureEqual(expected, signature);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!RAZORPAY_WEBHOOK_SECRET || !Buffer.isBuffer(rawBody) || !signature) return false;
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return secureEqual(expected, signature);
}

async function razorpayRequest(path, options = {}) {
  if (!credentialsConfigured()) throw new Error('Razorpay credentials are not configured on the server.');
  const response = await fetch(`${RAZORPAY_API_URL}${path}`, {
    ...options,
    headers: { Accept: 'application/json', Authorization: authorizationHeader(), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.description || `Razorpay request failed (HTTP ${response.status}).`);
  return data;
}

async function createOrder({ amount, currency = 'INR', receipt, items }) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('A positive payment amount is required.');
  const amountInPaise = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountInPaise)) throw new Error('Payment amount is invalid.');
  const order = await razorpayRequest('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      receipt: String(receipt || `varataaa_${Date.now()}`).slice(0, 40),
      notes: { item_count: String(Array.isArray(items) ? items.length : 0) },
    }),
  });
  if (typeof order.id !== 'string' || order.currency !== currency || order.amount !== amountInPaise) {
    throw new Error('Razorpay returned an invalid order.');
  }
  return {
    orderId: order.id,
    amount: order.amount / 100,
    currency: order.currency,
    gatewayData: { keyId: RAZORPAY_KEY_ID, razorpayOrderId: order.id, amount: order.amount },
  };
}

async function verifyPayment({ orderId, paymentData, orderDetails }) {
  const paymentId = typeof paymentData?.razorpay_payment_id === 'string' ? paymentData.razorpay_payment_id.trim() : '';
  const paymentOrderId = typeof paymentData?.razorpay_order_id === 'string' ? paymentData.razorpay_order_id.trim() : '';
  const signature = typeof paymentData?.razorpay_signature === 'string' ? paymentData.razorpay_signature.trim() : '';
  if (paymentOrderId !== orderId || !verifyPaymentSignature({ orderId, paymentId, signature })) {
    return { verified: false, paymentStatus: 'signature_invalid' };
  }
  const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  const expectedAmount = Math.round(Number(orderDetails?.totalAmount) * 100);
  const verified = payment.order_id === orderId && payment.status === 'captured'
    && payment.currency === 'INR' && (!Number.isFinite(expectedAmount) || payment.amount === expectedAmount);
  return {
    verified,
    gatewayPaymentId: payment.id || paymentId,
    gatewayOrderId: payment.order_id || paymentOrderId,
    orderAmount: Number(payment.amount) / 100,
    orderCurrency: payment.currency,
    paymentStatus: payment.status || 'unknown',
  };
}

async function verifyWebhookPayment({ orderId, paymentId }) {
  if (!orderId || !paymentId) return { verified: false, paymentStatus: 'invalid_webhook' };
  const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  return {
    verified: payment.order_id === orderId && payment.status === 'captured' && payment.currency === 'INR',
    gatewayPaymentId: payment.id || paymentId,
    gatewayOrderId: payment.order_id || orderId,
    orderAmount: Number(payment.amount) / 100,
    orderCurrency: payment.currency,
    paymentStatus: payment.status || 'unknown',
  };
}

module.exports = {
  name: 'razorpay',
  gatewayName: 'razorpay',
  createOrder,
  verifyPayment,
  verifyWebhookPayment,
  verifyWebhookSignature,
};
