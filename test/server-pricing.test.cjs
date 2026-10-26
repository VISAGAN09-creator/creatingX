const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateCheckoutPricing, coupleStockAdapters, paidOrderItem, parseNewProductSizes, pendingOrderItem } = require('../server.cjs');

test('charges a ₹1.00 server-resolved item as ₹1.00 with free shipping', () => {
  assert.deepEqual(calculateCheckoutPricing([{ lineTotal: 1 }]), {
    subtotalAmount: 1,
    taxAmount: 0,
    shippingAmount: 0,
    totalAmount: 1,
  });
});

test('totals multiple authoritative line items without adding tax', () => {
  assert.deepEqual(calculateCheckoutPricing([{ lineTotal: 2.02 }, { lineTotal: 7.65 }]), {
    subtotalAmount: 9.67,
    taxAmount: 0,
    shippingAmount: 0,
    totalAmount: 9.67,
  });
});

test('adds an explicit shipping charge once and rounds decimal totals to paise', () => {
  assert.deepEqual(calculateCheckoutPricing([{ lineTotal: 0.1 }, { lineTotal: 0.2 }, { lineTotal: 0.3 }], 49.5), {
    subtotalAmount: 0.6,
    taxAmount: 0,
    shippingAmount: 49.5,
    totalAmount: 50.1,
  });
});

test('does not accept a client-claimed total in place of resolved line totals', () => {
  const untrustedRequest = { totalAmount: 1.18 };
  const pricing = calculateCheckoutPricing([{ lineTotal: 1 }]);

  assert.equal(pricing.totalAmount, 1);
  assert.notEqual(pricing.totalAmount, untrustedRequest.totalAmount);
});

test('omits inapplicable optional size fields from a standard pending order item', () => {
  const item = pendingOrderItem({
    productId: 'tees-standard-M',
    firestoreDocId: 'standard',
    collectionName: 'tees',
    couple: false,
    selectedSize: 'M',
    selectedMensSize: undefined,
    selectedWomensSize: undefined,
    selectedColor: undefined,
    name: 'Standard tee',
    price: 499,
    quantity: 1,
    lineTotal: 499,
    image: '',
  });

  assert.deepEqual(item, {
    productId: 'tees-standard-M',
    firestoreDocId: 'standard',
    collectionName: 'tees',
    couple: false,
    selectedSize: 'M',
    name: 'Standard tee',
    price: 499,
    quantity: 1,
    lineTotal: 499,
    image: '',
  });
});

test('persists both couple sizes without mixing them between order items', () => {
  const items = [
    paidOrderItem({ productId: 'tees-couple-a', name: 'Couple A', couple: true, selectedMensSize: 'M', selectedWomensSize: 'S', price: 999, quantity: 1, image: '' }),
    paidOrderItem({ productId: 'tees-couple-b', name: 'Couple B', couple: true, selectedMensSize: 'XL', selectedWomensSize: 'L', price: 999, quantity: 2, image: '' }),
  ];

  assert.deepEqual(items.map(({ mensSize, womensSize }) => ({ mensSize, womensSize })), [
    { mensSize: 'M', womensSize: 'S' },
    { mensSize: 'XL', womensSize: 'L' },
  ]);
});

test('does not emit undefined optional fields in paid standard-product order items', () => {
  const item = paidOrderItem({ productId: 'tees-standard-M', name: 'Standard tee', selectedSize: 'M', price: 499, quantity: 1, image: '' });

  assert.deepEqual(item, {
    id: 'tees-standard-M',
    name: 'Standard tee',
    size: 'M',
    price: 499,
    quantity: 1,
    image: '',
  });
  assert.equal(Object.values(item).some((value) => value === undefined), false);
});

test('accepts stock-backed product sizes and rejects malformed quantities', () => {
  assert.deepEqual(parseNewProductSizes({ XS: 0, M: 12 }), { XS: 0, M: 12 });
  assert.equal(parseNewProductSizes({ M: -1 }), null);
  assert.equal(parseNewProductSizes({ M: '12' }), null);
  assert.equal(parseNewProductSizes({ OneSize: 2 }), null);
});

test('uses independent maps for new couple products while retaining legacy shared stock', () => {
  const independent = coupleStockAdapters({ mensSizes: { M: 2 }, womensSizes: { S: 3 } });
  assert.equal(independent.mens.quantities.M, 2);
  assert.equal(independent.womens.quantities.S, 3);
  assert.equal(independent.legacy, null);

  const legacy = coupleStockAdapters({ sizes: { M: 4, S: 5 } });
  assert.equal(legacy.legacy.quantities.M, 4);
  assert.equal(legacy.legacy.quantities.S, 5);
});
