// ============================================================================
// FIREBASE CLOUD FUNCTIONS ENTRY POINT
// ============================================================================
// Exports the Express app from server.cjs as a Firebase HTTPS Cloud Function.
// Firebase Hosting rewrites /api/** requests to this function.
//
// The predeploy script copies server.cjs and gateway/ into this directory
// so they are available in the Cloud Functions runtime.
// ============================================================================

const functions = require('firebase-functions');
const { app } = require('./server.cjs');

exports.api = functions.https.onRequest(app);
