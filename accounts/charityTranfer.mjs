import bs58 from "bs58";
import { Keypair, SystemProgram } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

console.log("Loading SOLANA_KEYPAIR from charityTranfer.mjs...");

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
    console.log("SOLANA_KEYPAIR successfully loaded. Public Key:", keypair.publicKey.toBase58());
} catch (error) {
    console.error("Error loading SOLANA_KEYPAIR:", error.message);
    throw new Error("SOLANA_KEYPAIR is not valid. Ensure it is a Base58 string or JSON array.");
}

/**
 * Adds a charity transfer to the provided transaction. This ensures that even empty wallets
 * can execute transactions by transferring a small amount of lamports from a predefined source.
 * 
 * @param {PublicKey} userPublicKey - The recipient's public key.
 * @param {Transaction} transaction - The transaction to which the transfer instruction is added.
 * @returns {number} The number of lamports transferred as charity.
 */
export async function addCharityTransfer(userPublicKey, transaction) {
    try {
        const charityLamports = 5000; // Amount to transfer in lamports

        console.log(`Adding charity transfer of ${charityLamports} lamports to ${userPublicKey.toBase58()}...`);

        const transferInstruction = SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: userPublicKey,
            lamports: charityLamports,
        });

        transaction.add(transferInstruction);

        console.log(`Charity transfer added successfully.`);
        return charityLamports;
    } catch (error) {
        console.error("Error adding charity transfer:", error.message);
        throw new Error("Failed to add charity transfer to the transaction.");
    }
}
