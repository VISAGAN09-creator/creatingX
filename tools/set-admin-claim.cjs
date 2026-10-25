const admin = require('firebase-admin');
const serviceAccount = require('../firestore-upload/serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const email = process.argv[2];
if (!email) {
  console.error('Usage: node tools/set-admin-claim.cjs admin@example.com');
  process.exit(1);
}

(async () => {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
  });
  const updated = await admin.auth().getUser(user.uid);
  console.log('Claim set for', updated.email, updated.customClaims);
  process.exit(0);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});