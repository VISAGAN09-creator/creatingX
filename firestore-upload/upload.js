const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// 1. Initialize the SDK
const serviceAccount = require('./serviceAccountKey.json');
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function upload() {
    const products = JSON.parse(fs.readFileSync('./products.json', 'utf8'));
    const batch = db.batch();

    products.forEach((product) => {
        const docId = product.id;

        if (!docId) {
            console.warn("Skipping product because 'id' is missing:", product);
            return;
        }

        const { id, ...productData } = product;

        // 2. TARGET YOUR EXISTING "Gym Freak" COLLECTION
        const docRef = db.collection('Fight').doc(docId);

        // 3. USE MERGE TO APPEND SAFELY WITHOUT WIPING EXISTING FIELDS
        batch.set(docRef, productData, { merge: true });
    });

    await batch.commit();
    console.log('Success! Products appended to collection.');
}

upload().catch(console.error);
