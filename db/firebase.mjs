import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

let db;

try {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  };

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("Firebase initialized successfully.");

  // Initialize Firestore
  db = admin.firestore();

  // Optional: Test Firestore connection
  (async () => {
    try {
      const testQuery = await db
        .collection("claim_transactions")
        .limit(1)
        .get();
      console.log(
        "Firestore test query succeeded. Documents found:",
        testQuery.size
      );
    } catch (error) {
      console.error("Firestore test query failed:", error.message);
    }
  })();
} catch (error) {
  console.error("Error initializing Firebase:", error.message);
  process.exit(1); // Exit the process if Firebase initialization fails
}

export { db };
