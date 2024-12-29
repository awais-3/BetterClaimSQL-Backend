import express from "express";
import {
    getAffiliatedWallet,
    getReferralCode,
    updateAffiliatedWallet,
} from "./affiliation.mjs";

const affiliation_router = express.Router();
affiliation_router.use(express.json());

/**
 * Endpoint to fetch referral code and SOL received for a wallet.
 */
affiliation_router.get("/wallet-info", async (req, res) => {
    const wallet_address = req.query["wallet_address"];

    if (!wallet_address) {
        return res.status(400).json({ error: "Wallet address is required" });
    }

    try {
        const { code, solReceived } = await getReferralCode(wallet_address);

        if (code) {
            res.status(200).json({
                referral_code: code,
                sol_received: solReceived,
            });
        } else {
            res.status(404).json({ error: "Referral code not found" });
        }
    } catch (error) {
        console.error("Error fetching wallet info:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Endpoint to update the SOL received for an affiliated wallet.
 */
affiliation_router.post("/affiliated-wallet/update", async (req, res) => {
    const { wallet_address, amount } = req.body;

    if (!wallet_address || typeof wallet_address !== "string") {
        return res.status(400).json({ error: "Valid wallet address is required" });
    }
    if (amount === undefined || amount < 0) {
        return res.status(400).json({ error: "Amount must be a non-negative number" });
    }

    try {
        const updated_wallet = await updateAffiliatedWallet(wallet_address, amount);
        res.status(200).json({ updated_wallet });
    } catch (error) {
        if (error.message.includes("not found")) {
            res.status(404).json({ error: error.message });
        } else {
            console.error("Error updating affiliated wallet:", error.message);
            res.status(500).json({ error: "Internal server error" });
        }
    }
});

/**
 * Endpoint to get affiliated wallet by referral code.
 */
affiliation_router.get("/affiliated-wallet", async (req, res) => {
    const referral_code = req.query["referral_code"];

    if (!referral_code) {
        return res.status(400).json({ error: "Referral code is required" });
    }

    try {
        const affiliated_wallet = await getAffiliatedWallet(referral_code);

        if (affiliated_wallet) {
            res.status(200).json({ affiliated_wallet });
        } else {
            res.status(404).json({ error: "Affiliated wallet not found" });
        }
    } catch (error) {
        console.error("Error fetching affiliated wallet:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Endpoint to check referral code and fetch the associated wallet.
 */
affiliation_router.get("/check-referral-code", async (req, res) => {
    const referral_code = req.query["referral_code"];

    if (!referral_code) {
        return res.status(400).json({ error: "Referral code is required" });
    }

    try {
        const affiliated_wallet = await getAffiliatedWallet(referral_code);

        if (affiliated_wallet) {
            res.status(200).json({
                wallet_address: affiliated_wallet.wallet_address,
                sol_received: affiliated_wallet.sol_received || 0,
            });
        } else {
            res.status(404).json({ error: "Referral code not found" });
        }
    } catch (error) {
        console.error("Error checking referral code:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default affiliation_router;
