import {
    createBurnInstruction,
    getAccount,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Transaction, Keypair } from "@solana/web3.js";
import { connection } from "./connection.mjs";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

console.log("SOLANA_KEYPAIR from burning.mjs:", process.env.SOLANA_KEYPAIR);

// Load and validate the secret key
const secretKeyString = process.env.SOLANA_KEYPAIR;
if (!secretKeyString) {
    throw new Error("SOLANA_KEYPAIR is not defined in .env");
}

let keypair;
try {
    let secretKeyArray;

    if (secretKeyString.startsWith("[") || secretKeyString.startsWith("{")) {
        console.log("Parsing SOLANA_KEYPAIR as JSON array...");
        secretKeyArray = JSON.parse(secretKeyString);

        if (!Array.isArray(secretKeyArray)) {
            throw new Error("SOLANA_KEYPAIR must be an array.");
        }
    } else {
        console.log("Decoding SOLANA_KEYPAIR as Base58 string...");
        secretKeyArray = bs58.decode(secretKeyString);
    }

    if (secretKeyArray.length !== 64) {
        throw new Error("Invalid secret key size. Must be 64 bytes.");
    }

    keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    console.log("Parsed SOLANA_KEYPAIR:", keypair.publicKey.toBase58());
} catch (err) {
    console.error("Error parsing SOLANA_KEYPAIR:", err.message);
    throw new Error("SOLANA_KEYPAIR is not valid. Ensure it is a Base58 string or JSON array.");
}

/**
 * Burn the balance of a specified token account.
 * @param {PublicKey} userPublicKey - The user's public key.
 * @param {PublicKey} accountPublicKey - The token account's public key.
 * @param {Transaction} transaction - The transaction to which the burn instruction will be added.
 */
export async function burnAccountBalance(userPublicKey, accountPublicKey, transaction) {
    try {
        // Fetch the token account info
        const accountInfo = await connection.getAccountInfo(accountPublicKey);
        if (!accountInfo) {
            throw new Error("Failed to fetch account info for " + accountPublicKey.toBase58());
        }

        const tokenAccountInfo = await getAccount(connection, accountPublicKey);

        // Retrieve mint address and balance
        const mintAddress = tokenAccountInfo.mint;
        const tokenBalance = tokenAccountInfo.amount;

        if (tokenBalance === BigInt(0)) {
            console.log(`Token account ${accountPublicKey.toBase58()} has zero balance. Skipping burn.`);
            return;
        }

        // Verify the owner of the token account
        if (!tokenAccountInfo.owner.equals(userPublicKey)) {
            throw new Error(`Permission denied. User ${userPublicKey.toBase58()} is not the owner of token account ${accountPublicKey.toBase58()}`);
        }

        // Get the associated token address
        const associatedTokenAddress = await getAssociatedTokenAddress(mintAddress, userPublicKey);

        // Check if the associated token account exists
        const associatedAccountInfo = await connection.getAccountInfo(associatedTokenAddress);
        if (!associatedAccountInfo) {
            throw new Error(`Associated token account for ${associatedTokenAddress.toBase58()} doesn't exist. Please create it first.`);
        }

        console.log(`Burning ${tokenBalance} tokens from account ${accountPublicKey.toBase58()}...`);

        // Add the burn instruction to the transaction
        transaction.add(
            createBurnInstruction(
                accountPublicKey, // Source account
                mintAddress, // Mint
                userPublicKey, // Owner of the source account
                tokenBalance, // Amount to burn
                [], // Multi-signers (if any)
                TOKEN_PROGRAM_ID // Token program ID
            )
        );

        console.log(`Burn instruction added for account ${accountPublicKey.toBase58()}`);
    } catch (error) {
        console.error(`Error burning balance for account ${accountPublicKey.toBase58()}:`, error.message);
        throw error;
    }
}
