import { db } from "./firebase.mjs";

/**
 * Update the `claim_transactions` Firestore collection.
 * Adds missing fields or updates existing records as required.
 */
export async function updateClaimTransactions() {
    try {
        const claimTransactionsRef = db.collection("claim_transactions");
        const querySnapshot = await claimTransactionsRef.get();

        const batch = db.batch();
        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Add default value for `accounts_closed` if not present
            if (data.accounts_closed === undefined) {
                batch.update(doc.ref, { accounts_closed: 1 });
            }
        });

        await batch.commit();
        console.log("Claim transactions updated successfully.");
    } catch (error) {
        console.error("Error updating claim transactions:", error.message);
    }
}

/**
 * Update the `affiliated_wallets` Firestore collection.
 * Adds missing fields or modifies existing ones as needed.
 */
export async function updateAffiliatedWallets() {
    try {
        const affiliatedWalletsRef = db.collection("affiliated_wallets");
        const querySnapshot = await affiliatedWalletsRef.get();

        const batch = db.batch();
        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Example: Add a new field `share` if not present, default to 50
            if (data.share === undefined) {
                batch.update(doc.ref, { share: 50 });
            }

            // Example: Update `sol_received` to ensure it's a valid number
            if (data.sol_received === undefined || isNaN(data.sol_received)) {
                batch.update(doc.ref, { sol_received: 0 });
            }
        });

        await batch.commit();
        console.log("Affiliated wallets updated successfully.");
    } catch (error) {
        console.error("Error updating affiliated wallets:", error.message);
    }
}

/**
 * Update schemas for all Firestore collections.
 * Calls individual update functions for each collection.
 */
export default async function updateSchemas() {
    try {
        console.log("Starting schema updates...");

        await updateClaimTransactions();
        console.log("Claim transactions collection updated.");

        await updateAffiliatedWallets();
        console.log("Affiliated wallets collection updated.");

        console.log("All schema updates completed successfully.");
    } catch (error) {
        console.error("Error updating Firestore schemas:", error.message);
    }
}
