// ============================================================================
// CASHFREE PAYMENT GATEWAY ADAPTER — SERVER SIDE
// ============================================================================
//
// This adapter integrates with the Cashfree Hosted Checkout (redirect) flow.
//
// createOrder:
//   - Receives items (with Firestore-verified prices), customer info, return URL
//   - Creates a Cashfree order via POST /pg/orders
//   - Returns orderId, amount, currency, and gatewayData (payment_session_id)
//
// verifyPayment:
//   - Receives a Cashfree order_id
//   - Queries Cashfree GET /pg/orders/{order_id} to check payment status
//   - Returns verified status, payment ID, and order ID
//
// Environment variables (read from process.env, NEVER exposed to client):
//   CASHFREE_APP_ID
//   CASHFREE_SECRET_KEY
//   CASHFREE_API_VERSION
//   CASHFREE_API_URL
//
// ============================================================================

const CASHFREE_APP_ID     = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2025-01-01';
const CASHFREE_API_URL    = process.env.CASHFREE_API_URL || 'https://sandbox.cashfree.com/pg';

if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
  console.error('[Cashfree] Missing CASHFREE_APP_ID or CASHFREE_SECRET_KEY in environment.');
}

/**
 * Create a Cashfree order via the hosted checkout API.
 *
 * @param {object} params
 * @param {number} params.amount       — Total amount in INR (e.g. 499.00)
 * @param {string} params.currency     — Currency code (default: INR)
 * @param {string} params.receipt      — Receipt/reference string
 * @param {object} params.customer     — { id, email, phone, name }
 * @param {string} params.returnUrl    — URL Cashfree redirects to after payment
 * @param {object[]} params.items      — Cart items for order notes
 * @returns {Promise<{ orderId, amount, currency, gatewayData }>}
 */
async function createOrder({ amount, currency = 'INR', receipt, customer, returnUrl, items }) {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new Error('Cashfree credentials are not configured on the server.');
  }

  // Generate a unique order ID (Cashfree requires alphanumeric + underscores, max 50 chars)
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const orderPayload = {
    order_id: orderId,
    order_amount: amount,
    order_currency: currency,
    order_note: receipt || `Order for ${(items || []).length} item(s)`,
    customer_details: {
      customer_id: customer?.id || `cust_${Date.now()}`,
      customer_email: customer?.email || 'test@example.com',
      customer_phone: customer?.phone || '9999999999',
      customer_name: customer?.name || 'Customer',
    },
    order_meta: {
      return_url: returnUrl
        ? `${returnUrl}?order_id={order_id}`
        : undefined,
    },
  };

  const response = await fetch(`${CASHFREE_API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-api-version': CASHFREE_API_VERSION,
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
    },
    body: JSON.stringify(orderPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Cashfree] Order creation failed:', JSON.stringify(data));
    throw new Error(
      data.message || data.error?.message || `Cashfree order creation failed (HTTP ${response.status})`
    );
  }

  if (!data.payment_session_id) {
    console.error('[Cashfree] No payment_session_id in response');
    throw new Error('Cashfree did not return a payment session.');
  }

  console.log(`[Cashfree] Order created: ${data.cf_order_id} (${orderId})`);

  return {
    orderId: data.cf_order_id || orderId,
    amount: data.order_amount,
    currency: data.order_currency,
    gatewayData: {
      payment_session_id: data.payment_session_id,
      order_id: orderId,
      cf_order_id: data.cf_order_id,
      order_status: data.order_status,
    },
  };
}

/**
 * Verify a Cashfree payment by querying the order status.
 *
 * @param {object} params
 * @param {string} params.orderId — The Cashfree order_id to verify
 * @returns {Promise<{ verified, gatewayPaymentId, gatewayOrderId, orderAmount, paymentStatus }>}
 */
async function verifyPayment({ orderId }) {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new Error('Cashfree credentials are not configured on the server.');
  }

  if (!orderId) {
    throw new Error('Order ID is required for verification.');
  }

  // Fetch order status from Cashfree
  const orderResponse = await fetch(`${CASHFREE_API_URL}/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-api-version': CASHFREE_API_VERSION,
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
    },
  });

  const orderData = await orderResponse.json();

  if (!orderResponse.ok) {
    console.error('[Cashfree] Order fetch failed:', JSON.stringify(orderData));
    throw new Error(
      orderData.message || `Failed to fetch Cashfree order (HTTP ${orderResponse.status})`
    );
  }

  const orderStatus = orderData.order_status;
  const isPaid = orderStatus === 'PAID';

  // A PAID order is only verified after Cashfree also returns its successful
  // payment record with a non-empty transaction ID. Never trust a client or
  // webhook-provided payment ID as a fallback.
  let transactionId = '';
  if (isPaid) {
    try {
      const paymentsResponse = await fetch(`${CASHFREE_API_URL}/orders/${orderId}/payments`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-version': CASHFREE_API_VERSION,
          'x-client-id': CASHFREE_APP_ID,
          'x-client-secret': CASHFREE_SECRET_KEY,
        },
      });

      if (!paymentsResponse.ok) {
        throw new Error(`Cashfree payment lookup failed (HTTP ${paymentsResponse.status})`);
      }

      const paymentsData = await paymentsResponse.json();
      const successfulPayment = Array.isArray(paymentsData)
        ? paymentsData.find(p => p.payment_status === 'SUCCESS')
        : null;
      const candidateId = successfulPayment?.cf_payment_id || successfulPayment?.payment_id;
      transactionId = typeof candidateId === 'string' ? candidateId.trim() : '';

      if (!transactionId) {
        throw new Error('Cashfree did not return a transaction ID for the successful payment.');
      }
    } catch (err) {
      console.warn('[Cashfree] Could not verify a successful payment transaction:', err.message);
    }
  }

  console.log(`[Cashfree] Order ${orderId} status: ${orderStatus}`);

  return {
    verified: isPaid && Boolean(transactionId),
    gatewayPaymentId: transactionId,
    gatewayOrderId: orderId,
    orderAmount: orderData.order_amount,
    orderCurrency: orderData.order_currency,
    paymentStatus: orderStatus,
  };
}

module.exports = {
  name: 'cashfree',
  createOrder,
  verifyPayment,
};
