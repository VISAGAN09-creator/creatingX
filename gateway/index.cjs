// ============================================================================
// PAYMENT GATEWAY ADAPTER — SERVER SIDE
// ============================================================================
//
// This module provides a gateway-agnostic interface for payment operations.
// The server endpoints (/api/create-order, /api/verify-payment) call these
// functions instead of any specific payment SDK.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  HOW TO ADD A NEW PAYMENT GATEWAY (e.g. Stripe, PayU, Cashfree)       │
// │                                                                       │
// │  1. Create a new file: gateway/<name>.cjs                             │
// │     (e.g. gateway/stripe.cjs or gateway/payu.cjs)                     │
// │                                                                       │
// │  2. Export two functions from that file:                               │
// │                                                                       │
// │     async function createOrder({ amount, currency, receipt })          │
// │       → Must return: { orderId, amount, currency, gatewayData }       │
// │         • orderId:     The gateway's order/session ID                  │
// │         • amount:      The confirmed amount (in smallest unit)         │
// │         • currency:    The confirmed currency code                    │
// │         • gatewayData: Any extra data the client needs to open        │
// │                        the checkout (public key, session token, etc.)  │
// │                                                                       │
// │     async function verifyPayment({ paymentData, orderDetails })       │
// │       → Must return: { verified, gatewayPaymentId, gatewayOrderId }   │
// │         • verified:          Boolean — did the signature/hash check   │
// │                              pass?                                    │
// │         • gatewayPaymentId:  The gateway's payment/transaction ID     │
// │         • gatewayOrderId:    The gateway's order/session ID           │
// │                                                                       │
// │  3. Set PAYMENT_GATEWAY=<name> in your .env file                      │
// │     (e.g. PAYMENT_GATEWAY=stripe)                                     │
// │                                                                       │
// │  4. Add any gateway-specific env vars (API keys, secrets, etc.)       │
// │     to .env and read them inside your adapter file.                   │
// │                                                                       │
// │  5. Register your adapter in the `adapters` map below.                │
// │                                                                       │
// │  That's it. No changes to server.cjs endpoints are needed.            │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ============================================================================

/**
 * Placeholder adapter — used when no gateway is configured.
 * Returns clear error messages so developers know what to set up.
 */
const placeholderAdapter = {
  name: 'placeholder',

  async createOrder(/* { amount, currency, receipt } */) {
    throw new Error(
      'No payment gateway configured. Set PAYMENT_GATEWAY in your .env file and add the matching adapter. See gateway/index.cjs for instructions.'
    );
  },

  async verifyPayment(/* { paymentData, orderDetails } */) {
    throw new Error(
      'No payment gateway configured. Set PAYMENT_GATEWAY in your .env file and add the matching adapter. See gateway/index.cjs for instructions.'
    );
  },
};

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================
// Add your gateway adapters here. The key must match the PAYMENT_GATEWAY env var.
//
// Example:
//   const stripeAdapter = require('./stripe.cjs');
//   const adapters = { stripe: stripeAdapter, payu: require('./payu.cjs') };
// ============================================================================

const adapters = {
  // stripe: require('./stripe.cjs'),
  // payu:   require('./payu.cjs'),
  cashfree: require('./cashfree.cjs'),
  // phonepe:  require('./phonepe.cjs'),
};

// ============================================================================
// LOAD THE ACTIVE ADAPTER
// ============================================================================

const gatewayName = (process.env.PAYMENT_GATEWAY || '').trim().toLowerCase();
let activeAdapter;

if (!gatewayName) {
  console.warn('[Payment Gateway] PAYMENT_GATEWAY env var is not set. Using placeholder adapter.');
  console.warn('[Payment Gateway] Payment endpoints will return errors until a gateway is configured.');
  activeAdapter = placeholderAdapter;
} else if (adapters[gatewayName]) {
  activeAdapter = adapters[gatewayName];
  console.log(`[Payment Gateway] Loaded adapter: ${gatewayName}`);
} else {
  console.error(`[Payment Gateway] Unknown gateway "${gatewayName}". Available: ${Object.keys(adapters).join(', ') || '(none registered)'}`);
  console.error('[Payment Gateway] Falling back to placeholder adapter. Payment endpoints will return errors.');
  activeAdapter = placeholderAdapter;
}

module.exports = {
  /**
   * The name of the currently active gateway adapter.
   * @type {string}
   */
  gatewayName: activeAdapter.name || gatewayName || 'placeholder',

  /**
   * Create a payment order/session with the active gateway.
   *
   * @param {{ amount: number, currency: string, receipt: string }} params
   * @returns {Promise<{ orderId: string, amount: number, currency: string, gatewayData: Record<string, any> }>}
   */
  createOrder: (params) => activeAdapter.createOrder(params),

  /**
   * Verify a payment's authenticity after the customer completes checkout.
   *
   * @param {{ paymentData: Record<string, any>, orderDetails: Record<string, any> }} params
   * @returns {Promise<{ verified: boolean, gatewayPaymentId: string, gatewayOrderId: string }>}
   */
  verifyPayment: (params) => activeAdapter.verifyPayment(params),
};
