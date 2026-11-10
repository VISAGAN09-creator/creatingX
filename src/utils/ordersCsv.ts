import type { AdminOrder } from '../lib/adminApi';

const statusLabels = { production: 'Production', out_for_delivery: 'Out for delivery', delivered: 'Delivered' } as const;

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const protectedText = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

function orderAddress(order: AdminOrder) {
  return [order.shipping.doorNo, order.shipping.addressLine1 ?? order.shipping.address,
    order.shipping.addressLine2 ?? order.shipping.apartment, order.shipping.city,
    order.shipping.state, order.shipping.pinCode, order.shipping.country].filter(Boolean).join(', ');
}

function orderItemsForCsv(order: AdminOrder) {
  return order.items.map((item) => {
    const options = [item.size && `Size: ${item.size}`, item.mensSize && `Men's: ${item.mensSize}`,
      item.womensSize && `Women's: ${item.womensSize}`, item.color && `Color: ${item.color}`].filter(Boolean).join(', ');
    return `${item.name || 'Unnamed item'} ? ${item.quantity ?? 1}${options ? ` (${options})` : ''}`;
  }).join(' | ');
}

export function customerName(order: AdminOrder) {
  return order.customer.name || [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ').trim()
    || order.customer.email || 'Customer details unavailable';
}

export function formatOrderDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function buildOrdersCsv(orders: AdminOrder[]) {
  const rows = [
    ['Order ID', 'Order Type', 'Order Date', 'Customer Name', 'Customer Email', 'Phone Number',
      'Shipping Address', 'Country', 'State', 'City', 'PIN Code', 'Products / Items',
      'Order Total (INR)', 'Payment Method', 'Payment Status', 'Fulfillment Status', 'Gateway Order ID'],
    ...orders.map((order) => [order.orderId, order.orderType === 'walk-in' ? 'Walk-in' : 'Online',
      formatOrderDate(order.createdAt), customerName(order), order.customer.email || '', order.customer.phone || '',
      orderAddress(order), order.shipping.country ?? '', order.shipping.state ?? '', order.shipping.city ?? '',
      order.shipping.pinCode ?? '', orderItemsForCsv(order), order.pricing.total ?? '',
      order.payment.method === 'other' ? order.payment.otherMethod || 'Other' : order.payment.method || order.payment.gateway || '',
      order.paymentStatus || '', statusLabels[order.fulfillmentStatus],
      order.payment.razorpayOrderId || order.payment.cashfreeOrderId || '']),
  ];
  return `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}
