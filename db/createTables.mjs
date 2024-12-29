import { db } from "./firebase.mjs";

/**
 * Initialize Firestore collections to replicate SQL table structure.
 */
export default async function createCollections() {
    try {
        // Initialize claim_transactions collection
        const claimTransactionsDoc = db.collection("claim_transactions").doc("schema");
        const claimExists = await claimTransactionsDoc.get();
        if (!claimExists.exists) {
            await claimTransactionsDoc.set({
                schema: {
                    id: "Auto-generated unique identifier",
                    wallet_address: "User's Solana wallet address (string, required)",
                    accounts_closed: "Number of accounts closed (integer, required)",
                    transaction_id: "Unique transaction ID (string, required)",
                    sol_received: "Amount of SOL received (numeric, required)",
                    claimed_at: "Timestamp of claim (timestamp, defaults to current time)",
                },
            });
            console.log("Initialized claim_transactions collection schema.");
        }

        // Initialize affiliated_wallets collection
        const affiliatedWalletsDoc = db.collection("affiliated_wallets").doc("schema");
        const affiliatedExists = await affiliatedWalletsDoc.get();
        if (!affiliatedExists.exists) {
            await affiliatedWalletsDoc.set({
                schema: {
                    id: "Auto-generated unique identifier",
                    wallet_address: "Affiliated user's wallet address (string, unique, required)",
                    referral_code: "Unique referral code (string, unique, required)",
                    sol_received: "Amount of SOL received (numeric, defaults to 0)",
                    share: "Referral share percentage (integer, defaults to 50)",
                    created_at: "Timestamp of creation (timestamp, defaults to current time)",
                },
            });
            console.log("Initialized affiliated_wallets collection schema.");
        }
    } catch (err) {
        console.error("Error initializing Firestore collections:", err);
    }
}

/**
 * Helper function to create example data (optional, for testing purposes).
 */
async function populateExampleData() {
    try {
        await db.collection("claim_transactions").add({
            wallet_address: "ExampleWallet123",
            accounts_closed: 10,
            transaction_id: "TxnExample123",
            sol_received: 1.23,
            claimed_at: new Date(),
        });

        await db.collection("affiliated_wallets").add({
            wallet_address: "ExampleWallet456",
            referral_code: "RefCode01",
            sol_received: 5.67,
            share: 50,
            created_at: new Date(),
        });

        console.log("Example data populated successfully.");
    } catch (err) {
        console.error("Error populating example data:", err);
    }
}

// Uncomment the following line to run example data population during initialization
// populateExampleData();
