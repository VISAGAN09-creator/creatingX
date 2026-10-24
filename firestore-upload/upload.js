const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

// 1. Initialize Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// 2. Map product categories to existing Firestore collections.
// Change these collection names to match your database exactly.
const categoryToCollection = {
  "Gym Freak": "Gym Freak",
  "Fight": "Fight",
  "Racing Collection": "Racing Collection",
  "Others": "Others",
  "Cars & Bikes": "Cars & Bikes",
  "Football Collection": "Football Collection",
  "Anime": "Anime",
  "Movies & Series": "Movies & Series",
  "Music & Dance": "Music & Dance",
  "TOTD": "TOTD",
};

async function upload() {
  const products = JSON.parse(
    fs.readFileSync("./products.json", "utf8")
  );

  if (!Array.isArray(products)) {
    throw new Error("products.json must contain a JSON array.");
  }

  let batch = db.batch();
  let batchCount = 0;
  let uploaded = 0;
  let skipped = 0;

  for (const product of products) {
    const { id, collection, category, ...productData } = product;

    // Collection can be specified directly in JSON,
    // or inferred from the product category.
    const targetCollection =
      collection || categoryToCollection[category];

    if (!id || !targetCollection) {
      console.warn(
        `Skipping product: missing ID or collection/category mapping.`,
        product
      );
      skipped++;
      continue;
    }

    const docRef = db.collection(targetCollection).doc(id);

    batch.set(docRef, productData, { merge: true });

    batchCount++;
    uploaded++;

    // Firestore batches support a maximum of 500 writes.
    if (batchCount === 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log("Bulk upload completed.");
  console.log(`Products processed: ${uploaded}`);
  console.log(`Products skipped: ${skipped}`);
}

upload().catch((error) => {
  console.error("Upload failed:", error);
  process.exitCode = 1;
});
