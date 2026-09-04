// ============================================================================
// PAYMENT GATEWAY ADAPTER — CLIENT SIDE (CASHFREE)
// ============================================================================
//
// This module integrates with Cashfree Hosted Checkout (redirect-based flow).
//
// Flow:
//  1. loadGatewayScript() — loads the Cashfree JS SDK from their CDN
//  2. openCheckout()     — calls cashfree.checkout() which redirects to
//                          Cashfree's hosted payment page
//  3. After payment, Cashfree redirects back to the return_url with order_id
//
// The Cashfree Secret Key is NEVER used here. Only payment_session_id
// (returned by the backend) is needed client-side.
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
// CASHFREE JS SDK INTEGRATION
// ============================================================================

// Declare the global Cashfree type from the SDK
declare global {
  interface Window {
    Cashfree?: {
      new (options: { mode: string }): {
        checkout: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<{ error?: { message: string }; redirect?: boolean; paymentDetails?: unknown }>;
      };
    };
  }
}

/**
 * Load the Cashfree JS SDK v3 from their CDN.
 *
 * @returns `true` when the SDK is ready, `false` if loading failed.
 */
export async function loadGatewayScript(): Promise<boolean> {
  // If already loaded, return immediately
  if (window.Cashfree) return true;

  return new Promise((resolve) => {
    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="sdk.cashfree.com"]');
    if (existingScript) {
      // Wait for it to load
      existingScript.addEventListener('load', () => resolve(!!window.Cashfree));
      existingScript.addEventListener('error', () => resolve(false));
      if (window.Cashfree) resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => resolve(!!window.Cashfree);
    script.onerror = () => {
      console.error('[Cashfree] Failed to load Cashfree JS SDK.');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Open the Cashfree Hosted Checkout via redirect.
 *
 * This function calls cashfree.checkout() which will redirect the browser
 * to Cashfree's hosted payment page. After payment, Cashfree redirects
 * back to the return_url configured in the backend.
 *
 * Note: Because this is a redirect flow, the onSuccess callback is NOT
 * called here — success is handled by the PaymentReturnPage component
 * that the user is redirected to after payment.
 *
 * @param context  Customer info and order data from the server.
 * @param callbacks  Functions to call on dismiss or error.
 */
export function openCheckout(
  context: CheckoutContext,
  callbacks: CheckoutCallbacks,
): void {
  const paymentSessionId = context.orderData.gatewayData?.payment_session_id as string;

  if (!paymentSessionId) {
    callbacks.onError('No payment session ID received from server.');
    return;
  }

  if (!window.Cashfree) {
    callbacks.onError('Cashfree SDK is not loaded. Please try again.');
    return;
  }

  try {
    // Initialize Cashfree in PRODUCTION mode
    const cashfree = new window.Cashfree({ mode: 'production' });

    // Redirect to Cashfree's hosted checkout page
    cashfree
      .checkout({
        paymentSessionId,
        redirectTarget: '_self', // redirect in the same tab
      })
      .then((result) => {
        // This promise resolves if checkout fails to redirect (rare)
        if (result.error) {
          callbacks.onError(result.error.message || 'Payment checkout failed.');
        }
        // If redirect happened, this code won't execute
        // (the browser navigates away)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to open Cashfree checkout.';
        console.error('[Cashfree] Checkout error:', message);
        callbacks.onError(message);
      });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to initialize Cashfree checkout.';
    console.error('[Cashfree] Init error:', message);
    callbacks.onError(message);
  }
}

