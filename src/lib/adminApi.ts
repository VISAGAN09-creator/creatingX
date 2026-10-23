import { paymentApiPath } from './paymentApi';
import { auth } from './firebase';

type AdminSessionResponse = {
  success: boolean;
  message?: string;
};

export async function verifyAdminSession(idToken: string): Promise<void> {
  const response = await fetch(paymentApiPath('/admin/session'), {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const body = (await response.json().catch(() => null)) as AdminSessionResponse | null;
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || 'Your administrator session could not be verified.');
  }
}

export type FulfillmentStatus = 'production' | 'out_for_delivery' | 'delivered';

export type AdminOrder = {
  orderId: string;
  customer: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  shipping: {
    address?: string;
    apartment?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    country?: string;
  };
  items: Array<{
    id?: string;
    name?: string;
    image?: string;
    price?: number;
    quantity?: number;
  }>;
  pricing: {
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
  };
  payment: {
    gateway?: string;
    transactionId?: string;
    paymentStatus?: string;
  };
  paymentStatus: string | null;
  fulfillmentStatus: FulfillmentStatus;
  createdAt: string | null;
};

type OrdersResponse = {
  success: boolean;
  orders?: AdminOrder[];
  message?: string;
};

export type FulfillmentSaveResult = {
  success: boolean;
  successful: Array<{ orderId: string; fulfillmentStatus: FulfillmentStatus; previousStatus: FulfillmentStatus }>;
  failed: Array<{ orderId: string | null; message: string }>;
};

async function adminFetch(path: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Your administrator session has expired. Please sign in again.');

  const idToken = await user.getIdToken();
  const response = await fetch(paymentApiPath(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as { message?: string } | null;

  if (!response.ok && response.status !== 207) {
    throw new Error(body?.message || 'The administrator request failed.');
  }

  return { response, body };
}

export async function fetchAdminOrders(status: FulfillmentStatus, signal?: AbortSignal): Promise<AdminOrder[]> {
  const { body } = await adminFetch(`/admin/orders?status=${encodeURIComponent(status)}`, { signal });
  const result = body as OrdersResponse | null;
  if (!result?.success || !Array.isArray(result.orders)) {
    throw new Error(result?.message || 'Unable to load orders.');
  }
  return result.orders;
}

export async function saveFulfillmentStatuses(
  updates: Array<{ orderId: string; fulfillmentStatus: FulfillmentStatus }>,
): Promise<FulfillmentSaveResult> {
  const { body } = await adminFetch('/admin/orders/fulfillment-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  const result = body as FulfillmentSaveResult | null;
  if (!result || !Array.isArray(result.successful) || !Array.isArray(result.failed)) {
    throw new Error('Unable to save fulfillment statuses.');
  }
  return result;
}
