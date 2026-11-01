const test = require('node:test');
const assert = require('node:assert/strict');
const { checkoutQuoteLine, calculateCheckoutPricing } = require('../server.cjs');

test('checkout uses current Firestore price and details instead of stored cart price', () => {
  const storedCart = { id: 'products-tee-M', quantity: 1, price: 499, name: 'Old name', image: 'old.jpg', selectedSize: 'M' };
  const currentRecord = { collectionName: 'products', docId: 'tee', data: { name: 'Updated tee', img1: 'new.jpg', price: 599 } };
  const quote = checkoutQuoteLine(storedCart.id, storedCart.quantity, currentRecord, false);
  assert.equal(quote.price, 599);
  assert.equal(quote.name, 'Updated tee');
  assert.equal(quote.image, 'new.jpg');
  assert.equal(storedCart.selectedSize, 'M');
  assert.equal(calculateCheckoutPricing([{ lineTotal: quote.price * quote.quantity }]).totalAmount, 599);
});

test('multiple updated lines are repriced by current records and retain quantities', () => {
  const records = [
    { collectionName: 'products', docId: 'one', data: { name: 'One', price: 599 } },
    { collectionName: 'products', docId: 'two', data: { name: 'Two', price: 799 } },
  ];
  const lines = [checkoutQuoteLine('products-one-M', 2, records[0], false), checkoutQuoteLine('products-two-L', 1, records[1], false)];
  assert.deepEqual(lines.map((line) => line.quantity), [2, 1]);
  assert.equal(calculateCheckoutPricing(lines.map((line) => ({ lineTotal: line.price * line.quantity }))).subtotalAmount, 1997);
});
