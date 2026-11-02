const { states, rates, defaultRate } = require('./shipping-rates.json');

const aliases = { orissa: 'Odisha', pondicherry: 'Puducherry', 'nct of delhi': 'Delhi', 'jammu & kashmir': 'Jammu and Kashmir', chattisgarh: 'Chhattisgarh', uttaranchal: 'Uttarakhand', 'andaman & nicobar islands': 'Andaman and Nicobar Islands', 'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu', 'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu' };
function normalizeState(value) {
  const key = String(value || '').trim().toLowerCase();
  return aliases[key] || states.find((state) => state.toLowerCase() === key) || null;
}
function shippingCharge(state, items) {
  const normalized = normalizeState(state);
  if (!normalized) throw new Error('Select a valid Indian state or Union Territory.');
  const quantity = items.reduce((sum, item) => sum + Number(item.quantity) * (item.couple || item.isCouple ? 2 : 1), 0);
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Invalid cart quantity.');
  const rate = rates[normalized] || defaultRate;
  return Math.ceil(quantity / 3) * rate;
}
async function lookupPin(pin, fetcher = fetch) {
  if (!/^[1-9]\d{5}$/.test(pin)) throw new Error('Enter a valid six-digit Indian PIN code.');
  const response = await fetcher(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('PIN lookup is unavailable. Please try again.');
  const data = await response.json();
  const offices = Array.isArray(data) && data[0]?.Status === 'Success' ? data[0].PostOffice : null;
  const found = [...new Set((offices || []).map((office) => normalizeState(office.State)))];
  if (found.length !== 1 || !found[0]) throw new Error('PIN code could not be verified.');
  return found[0];
}
module.exports = { states, normalizeState, shippingCharge, lookupPin };
