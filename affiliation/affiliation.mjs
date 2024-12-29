import { db } from "../db/firebase.mjs";
import * as crypto from "crypto";
import { PublicKey } from "@solana/web3.js";
import { getUser } from "../db/users.mjs"; // Import the getUser function

/**
 * Validate wallet address format.
 * @param {string} walletAddress - The wallet address to validate.
 * @returns {boolean} - Returns true if the address is valid, otherwise throws an error.
 */
function validateWalletAddress(walletAddress) {
    try {
        new PublicKey(walletAddress); // Validate wallet address as a Solana public key
        return true;
    } catch (error) {
        console.error(`Invalid wallet address format: ${walletAddress}`);
        throw new Error(`Invalid wallet address format: ${walletAddress}`);
    }
}

/**
 * Fetch or create a referral code for a wallet address.
 * @param {string} walletAddress - The user's wallet address.
 * @returns {Object} - Referral code and the SOL received by the affiliated wallet.
 */
export async function getReferralCode(walletAddress) {
    try {
        validateWalletAddress(walletAddress);

        const walletDoc = await db.collection("affiliated_wallets").doc(walletAddress).get();

        if (walletDoc.exists) {
            const data = walletDoc.data();
            return { code: data.referral_code, solReceived: data.sol_received || 0 };
        } else {
            console.log("Wallet not found. Generating new referral code...");
            const code = generateReferralCode();
            await db.collection("affiliated_wallets").doc(walletAddress).set({
                wallet_address: walletAddress,
                referral_code: code,
                sol_received: 0,
                created_at: new Date(),
                updated_at: new Date(),
            });
            return { code, solReceived: 0 };
        }
    } catch (error) {
        console.error("Error fetching referral code:", error.message);
        throw error;
    }
}

/**
 * Update the SOL received by an affiliated wallet.
 * @param {string} walletAddress - The user's wallet address.
 * @param {number} amount - Amount of SOL to add.
 * @returns {Object} - Updated wallet data.
 */
export async function updateAffiliatedWallet(walletAddress, amount) {
    try {
        if (!walletAddress || typeof walletAddress !== "string") {
            throw new Error("Wallet address is required and must be a string");
        }
        if (amount === undefined || amount < 0) {
            throw new Error("Amount must be a non-negative number");
        }

        validateWalletAddress(walletAddress);

        const walletRef = db.collection("affiliated_wallets").doc(walletAddress);
        const walletDoc = await walletRef.get();

        if (!walletDoc.exists) {
            throw new Error(`Affiliated wallet with address ${walletAddress} not found`);
        }

        const currentData = walletDoc.data();
        const updatedSolReceived = (currentData.sol_received || 0) + amount;

        await walletRef.update({
            sol_received: updatedSolReceived,
            updated_at: new Date(),
        });

        return { ...currentData, sol_received: updatedSolReceived };
    } catch (error) {
        console.error("Error updating affiliated wallet:", error.message);
        throw error;
    }
}

/**
 * Fetch the affiliated wallet using a referral code.
 * @param {string} referralCode - The referral code to look up.
 * @returns {Object|null} - Wallet data or null if not found.
 */
export async function getAffiliatedWallet(referralCode) {
    try {
        if (!referralCode || typeof referralCode !== "string") {
            throw new Error("Invalid referral code format");
        }

        const user = await getUser(referralCode);

        if (user && user.wallet_address) {
            console.log(`Found user in users collection with referral code: ${referralCode}`);
            return { wallet_address: user.wallet_address, sol_received: user.sol_received || 0 };
        }

        const walletsSnapshot = await db
            .collection("affiliated_wallets")
            .where("referral_code", "==", referralCode)
            .limit(1)
            .get();

        if (!walletsSnapshot.empty) {
            const walletData = walletsSnapshot.docs[0].data();
            console.log(`Found wallet in affiliated_wallets with referral code: ${referralCode}`);
            return walletData;
        }

        console.log(`No affiliated wallet found for referral code: ${referralCode}`);
        return null;
    } catch (error) {
        console.error("Error fetching affiliated wallet:", error.message);
        throw error;
    }
}

/**
 * Generate a unique referral code.
 * @returns {string} - Generated referral code.
 */
function generateReferralCode() {
    const randomBytes = crypto.randomBytes(6);
    return randomBytes.toString("base64").replace(/\+/g, "0").replace(/\//g, "1").substring(0, 8);
}
