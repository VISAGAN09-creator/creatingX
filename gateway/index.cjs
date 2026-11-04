// Keep payment-provider concerns behind this small boundary so the shared
// fulfillment and inventory transaction remains gateway independent.
module.exports = require('./razorpay.cjs');
