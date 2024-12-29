import express from "express";
import { db } from "./db/firebase.mjs";
import admin from "firebase-admin"; // Import for Firestore's FieldValue

const claimTransactionsRouter = express.Router();

claimTransactionsRouter.use(express.json());

// Fetch recent transactions
claimTransactionsRouter.get("/", async (req, res) => {
  try {
    console.log("object");
    console.log("Fetching claim transactions...");
    const claimTransactionsRef = db.collection("claim_transactions");
    const snapshot = await claimTransactionsRef
      .orderBy("claimed_at", "desc")
      .limit(20)
      .get();

    if (snapshot.empty) {
      console.log("No transactions found in Firestore.");
      res.status(200).json([]);
      return;
    }

    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("Fetched transactions:", transactions);
    res.status(200).json(transactions);
  } catch (error) {
    console.error(
      "Error fetching claim transactions:",
      error.message,
      error.stack
    );
    res.status(500).json({ error: "Error fetching transactions" });
  }
});

// Fetch general data including totals from claim_transactions and affiliated_wallets
claimTransactionsRouter.get("/info", async (req, res) => {
  try {
    console.log("Fetching general data...");

    // Fetch claim_transactions collection
    const claimTransactionsSnapshot = await db
      .collection("claim_transactions")
      .get();

    // Calculate total accounts closed
    const totalAccountsClosed = claimTransactionsSnapshot.docs.reduce(
      (sum, doc) => sum + (doc.data().accounts_closed || 0),
      0
    );

    // Calculate total SOL received
    const totalSolClaimed = claimTransactionsSnapshot.docs.reduce(
      (sum, doc) => sum + (doc.data().sol_received || 0),
      0
    );

    // Calculate total SOL shared
    const totalSolShared = claimTransactionsSnapshot.docs
      .reduce((sum, doc) => {
        const solShared = doc.data()["Sol Shared"];

        // Convert `solShared` to a number if it's a string
        const parsedSolShared =
          typeof solShared === "string" ? parseFloat(solShared) : solShared;

        // Ensure parsed value is a valid number
        return sum + (isNaN(parsedSolShared) ? 0 : parsedSolShared);
      }, 0)
      .toFixed(6); // Format to 6 decimal places

    res.status(200).json({
      total_accounts_closed: totalAccountsClosed,
      total_sol_claimed: totalSolClaimed,
      total_sol_shared: totalSolShared, // Use this in the frontend for Total Sol Shared
    });
  } catch (error) {
    console.error("Error fetching general data:", error.message, error.stack);
    res.status(500).json({ error: "Error fetching general data" });
  }
});

// Add new transaction
claimTransactionsRouter.post("/store", async (req, res) => {
  const { walletAddress, transactionId, solReceived, accountsClosed } =
    req.body;

  try {
    console.log("Storing a new transaction...");
    console.log("Request body:", req.body);

    const claimTransactionsRef = db.collection("claim_transactions");
    const newTransaction = {
      wallet_address: walletAddress,
      transaction_id: transactionId,
      sol_received: solReceived,
      accounts_closed: accountsClosed || 1,
      claimed_at: admin.firestore.FieldValue.serverTimestamp(), // Correctly set as Firestore Timestamp
    };

    console.log("New transaction data:", newTransaction);

    const docRef = await claimTransactionsRef.add(newTransaction);
    console.log("Transaction stored with ID:", docRef.id);

    res.status(201).json({ id: docRef.id, ...newTransaction });
  } catch (error) {
    console.error("Error adding transaction:", error.message, error.stack);
    res.status(500).json({ error: "Error adding transaction" });
  }
});

export default claimTransactionsRouter;
