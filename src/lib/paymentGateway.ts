// ============================================================================
// PAYMENT GATEWAY ADAPTER — CLIENT SIDE
// ============================================================================
//
// This module provides a gateway-agnostic interface for the checkout UI.
// CheckoutPage.tsx calls these functions instead of any specific payment SDK.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  HOW TO INTEGRATE A NEW PAYMENT GATEWAY CLIENT-SIDE                   │
// │                                                                       │
// │  1. Implement `loadGatewayScript()`:                                  │
// │     - Load the gateway's checkout.js / SDK script into the page       │
// │     - Return true when ready, false on failure                        │
// │                                                                       │
// │  2. Implement `openCheckout()`:                                       │
// │     - Receive order data from the server + customer info              │
// │     - Open the gateway's payment modal/redirect                       │
// │     - Call `onSuccess(paymentData)` when payment completes            │
// │       paymentData = any object the server needs to verify             │
// │     - Call `onDismiss()` if the user closes without paying            │
// │     - Call `onError(errorMessage)` on failure                         │
// │                                                                       │
// │  3. Set the VITE_PAYMENT_GATEWAY env var if needed for any            │
// │     gateway-specific client config.                                   │
// │                                                                       │
// │  That's it. No changes to CheckoutPage.tsx are needed.                │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ============================================================================

/**
 * The shape of data returned by `/api/create-order` that gets passed
 * to the client-side gateway adapter.
 */
export type CreateOrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  gatewayData: Record<string, unknown>;
};

/**
 * Callbacks the gateway adapter must invoke during checkout.
 */
export type CheckoutCallbacks = {
  /** Called when the customer successfully completes payment.
   *  `paymentData` is forwarded to `/api/verify-payment` as-is. */
  onSuccess: (paymentData: Record<string, unknown>) => void;
  /** Called when the customer closes the payment modal without paying. */
  onDismiss: () => void;
  /** Called when the gateway reports a payment failure. */
  onError: (message: string) => void;
};

/**
 * Customer and order info available for pre-filling the gateway checkout.
 */
export type CheckoutContext = {
  email: string;
  phone: string;
  name: string;
  itemCount: number;
  orderData: CreateOrderResponse;
};

// ============================================================================
// PLACEHOLDER IMPLEMENTATION
// ============================================================================
// Replace the bodies of these two functions with your gateway's SDK logic.
// The function signatures and return types should stay the same.
// ============================================================================

/**
 * Load the payment gateway's client-side script/SDK.
 *
 * @returns `true` when the SDK is ready, `false` if loading failed.
 *
 * Example (Stripe):
 * ```ts
 * export async function loadGatewayScript(): Promise<boolean> {
 *   if (window.Stripe) return true;
 *   return new Promise((resolve) => {
 *     const script = document.createElement('script');
 *     script.src = 'https://js.stripe.com/v3/';
 *     script.onload = () => resolve(true);
 *     script.onerror = () => resolve(false);
 *     document.body.appendChild(script);
 *   });
 * }
 * ```
 */
export async function loadGatewayScript(): Promise<boolean> {
  // No gateway configured — nothing to load.
  // When you integrate a real gateway, load its SDK script here.
  return true;
}

/**
 * Open the payment gateway's checkout modal/redirect.
 *
 * @param context  Customer info and order data from the server.
 * @param callbacks  Functions to call on success, dismiss, or error.
 *
 * Example (Stripe):
 * ```ts
 * export function openCheckout(context: CheckoutContext, callbacks: CheckoutCallbacks) {
 *   const stripe = window.Stripe(context.orderData.gatewayData.publicKey);
 *   stripe.redirectToCheckout({ sessionId: context.orderData.gatewayData.sessionId })
 *     .then(result => {
 *       if (result.error) callbacks.onError(result.error.message);
 *     });
 * }
 * ```
 */
export function openCheckout(
  _context: CheckoutContext,
  callbacks: CheckoutCallbacks,
): void {
  // No gateway configured — inform the developer.
  callbacks.onError(
    'Payment gateway is not configured. See src/lib/paymentGateway.ts for setup instructions.',
  );
}
