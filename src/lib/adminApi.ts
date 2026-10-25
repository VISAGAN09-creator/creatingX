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
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  shipping: {
    doorNo?: string;
    addressLine1?: string;
    addressLine2?: string;
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
    size?: string;
    couple?: boolean;
    mensSize?: string;
    womensSize?: string;
    color?: string;
  }>;
  pricing: {
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
  };
  payment: {
    gateway?: string;
    cashfreeOrderId?: string;
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
  const responseBody = await response.text();
  let body: { message?: string } | null = null;
  try {
    body = responseBody ? JSON.parse(responseBody) as { message?: string } : null;
  } catch {
    // Hosting fallback pages and proxy errors are HTML, not API JSON.
  }

  if (!response.ok && response.status !== 207) {
    throw new Error(
      body?.message || `Administrator API request failed (${response.status}) at ${paymentApiPath(path)}. Restart or redeploy the API if this route is new.`,
    );
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

export const INVENTORY_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export type InventorySize = (typeof INVENTORY_SIZES)[number];

export type InventoryProduct = {
  productId: string;
  collectionName: string;
  documentId: string;
  name: string;
  nameField: 'name' | 'title' | null;
  image: string;
  price: number | null;
  flags: {
    latest: boolean;
    hero: boolean;
    couple: boolean;
  };
  version: string | null;
  schema: string;
  editable: boolean;
  sizes: Record<InventorySize, number | null>;
};

type InventoryResponse = {
  success: boolean;
  products?: InventoryProduct[];
  message?: string;
};

export type InventorySaveResult = {
  success: boolean;
  successful: Array<{
    productId: string;
    changes: Partial<Record<InventorySize, number>>;
    metadata?: Partial<{ name: string; price: number; latest: boolean; hero: boolean; couple: boolean }>;
  }>;
  failed: Array<{ productId: string | null; message: string; code?: string }>;
};

export async function fetchInventory(signal?: AbortSignal): Promise<InventoryProduct[]> {
  const { body } = await adminFetch('/admin/inventory', { signal });
  const result = body as InventoryResponse | null;
  if (!result?.success || !Array.isArray(result.products)) {
    throw new Error(result?.message || 'Unable to load inventory.');
  }
  return result.products;
}

export async function saveInventory(
  updates: Array<{
    productId: string;
    version: string;
    changes?: Partial<Record<InventorySize, number>>;
    metadata?: Partial<{ name: string; price: number; latest: boolean; hero: boolean; couple: boolean }>;
  }>,
): Promise<InventorySaveResult> {
  const { body } = await adminFetch('/admin/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  const result = body as InventorySaveResult | null;
  if (!result || !Array.isArray(result.successful) || !Array.isArray(result.failed)) {
    throw new Error('Unable to save inventory changes.');
  }
  return result;
}
