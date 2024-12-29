import express from "express";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
    closeAccountTransaction,
    closeAccountBunchTransaction,
    closeAccountWithBalanceTransaction,
} from "./accounts.mjs";
import { connection } from "./connection.mjs";
import { Metaplex } from "@metaplex-foundation/js";

const accounts_router = express.Router();
accounts_router.use(express.json());

// Endpoint to close a single account
accounts_router.post("/close-account", async (req, res) => {
    try {
        const { user_public_key, account_public_key, referral_code } = req.body;

        // Validate input
        if (!user_public_key || !account_public_key) {
            return res.status(400).json({ error: "Missing user or account public key" });
        }

        try {
            new PublicKey(user_public_key);
            new PublicKey(account_public_key);
        } catch (error) {
            return res.status(400).json({ error: "Invalid public key format" });
        }

        // Proceed with transaction creation
        const transactionDetails = await closeAccountTransaction(
            new PublicKey(user_public_key),
            new PublicKey(account_public_key),
            referral_code
        );

        res.status(200).json({
            transaction: transactionDetails.transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false,
            }).toString("base64"),
            solReceived: transactionDetails.solReceived,
        });
    } catch (error) {
        console.error("Error in /close-account:", error.message);
        res.status(500).json({ error: "Failed to create the transaction" });
    }
});

// Endpoint to close multiple accounts in a batch
accounts_router.post("/close-accounts-bunch", async (req, res) => {
    try {
        const { user_public_key, account_public_keys, referral_code } = req.body;

        if (!user_public_key || !account_public_keys || !Array.isArray(account_public_keys)) {
            return res.status(400).json({ error: "Invalid request parameters" });
        }

        const transactionDetails = await closeAccountBunchTransaction(
            new PublicKey(user_public_key),
            account_public_keys.map((key) => new PublicKey(key)),
            referral_code
        );

        res.status(200).json({
            transaction: transactionDetails.transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false,
            }).toString("base64"),
            solReceived: transactionDetails.solReceived,
        });
    } catch (error) {
        console.error("Error in /close-accounts-bunch:", error.message);
        res.status(500).json({ error: "Failed to close accounts" });
    }
});

// Endpoint to close a single account with a balance
accounts_router.post("/close-account-with-balance", async (req, res) => {
    try {
        const { user_public_key, account_public_key, referral_code } = req.body;

        if (!user_public_key || !account_public_key) {
            return res.status(400).json({ error: "Missing user or account public key" });
        }

        const transactionDetails = await closeAccountWithBalanceTransaction(
            new PublicKey(user_public_key),
            new PublicKey(account_public_key),
            referral_code
        );

        res.status(200).json({
            transaction: Buffer.from(
                transactionDetails.transaction.serialize({
                    requireAllSignatures: false,
                    verifySignatures: false,
                })
            ).toString("base64"),
            solReceived: transactionDetails.solReceived,
        });
    } catch (error) {
        console.error("Error in /close-account-with-balance:", error.message);
        res.status(500).json({ error: "Failed to create the transaction" });
    }
});

// Endpoint to get a list of accounts without balance
accounts_router.get("/get-accounts-without-balance-list", async (req, res) => {
    const walletAddress = req.query["wallet_address"];

    if (!walletAddress) {
        return res.status(400).json({ error: "No wallet address provided" });
    }

    try {
        const accounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(walletAddress), {
            programId: TOKEN_PROGRAM_ID,
        });

        const processedAccounts = [];

        for (const account of accounts.value) {
            const parsedInfo = account.account.data.parsed.info;

            // Include only accounts with zero balance
            if (parsedInfo.tokenAmount.uiAmount === 0) {
                const accountInfo = await connection.getAccountInfo(new PublicKey(account.pubkey));
                const rentAmount = accountInfo ? accountInfo.lamports / 1e9 : 0; // Convert lamports to SOL

                processedAccounts.push({
                    pubkey: account.pubkey.toBase58(),
                    mint: parsedInfo.mint,
                    balance: parsedInfo.tokenAmount.uiAmount,
                    rentAmount: rentAmount, // Add rent amount to the response
                });
            }
        }

        res.status(200).json({ accounts: processedAccounts });
    } catch (error) {
        console.error("Error fetching accounts without balance:", error.message);
        res.status(500).json({ error: "Failed to fetch accounts without balance" });
    }
});

// Endpoint to get a list of accounts with balance
accounts_router.get("/get-accounts-with-balance-list", async (req, res) => {
    const walletAddress = req.query["wallet_address"];

    if (!walletAddress) {
        return res.status(400).json({ error: "No wallet address provided" });
    }

    try {
        const accounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(walletAddress), {
            programId: TOKEN_PROGRAM_ID,
        });

        const metaplex = Metaplex.make(connection);
        const processedAccounts = [];

        for (const account of accounts.value) {
            const parsedInfo = account.account.data.parsed.info;
            const mintAddress = new PublicKey(parsedInfo.mint);

            if (parsedInfo.tokenAmount.uiAmount > 0) {
                try {
                    const nft = await metaplex.nfts().findByMint({ mintAddress });
                    const nftJson = nft.json;

                    processedAccounts.push({
                        pubkey: account.pubkey.toBase58(),
                        mint: parsedInfo.mint,
                        balance: parsedInfo.tokenAmount.uiAmount,
                        name: nft.name || nftJson?.name,
                        symbol: nft.symbol || nftJson?.symbol,
                        logo:
                            nftJson?.image?.startsWith("ipfs://")
                                ? nftJson.image.replace("ipfs://", "https://ipfs.io/ipfs/")
                                : nftJson?.image,
                    });
                } catch (error) {
                    console.error("Error fetching NFT metadata:", error.message);
                    processedAccounts.push({
                        pubkey: account.pubkey.toBase58(),
                        mint: parsedInfo.mint,
                        balance: parsedInfo.tokenAmount.uiAmount,
                    });
                }
            }
        }

        res.status(200).json({ accounts: processedAccounts });
    } catch (error) {
        console.error("Error fetching accounts with balance:", error.message);
        res.status(500).json({ error: "Failed to fetch accounts with balance" });
    }
});

accounts_router.get('/get-wallet-balance', async (req, res) => {
    const walletAddress = req.query['wallet_address'];

    if (!walletAddress) {
        return res.status(400).json({ error: 'No wallet address provided' });
    }

    try {
        const balance = await connection.getBalance(new PublicKey(walletAddress));
        res.status(200).json({ balance: balance / 1e9 }); // Convert lamports to SOL
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }
});

export default accounts_router;
