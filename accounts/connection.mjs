import { Connection, Keypair } from "@solana/web3.js";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

console.log("SOLANA_RPC_URL from connection.mjs:", process.env.SOLANA_RPC_URL);

const secretKeyString = process.env.SOLANA_KEYPAIR;
if (!secretKeyString) {
    throw new Error("SOLANA_KEYPAIR is not defined in .env");
}

let keypair;

try {
    let secretKeyArray;

    if (secretKeyString.startsWith("[") || secretKeyString.startsWith("{")) {
        // Parse as JSON array
        console.log("Parsing SOLANA_KEYPAIR as JSON array...");
        secretKeyArray = JSON.parse(secretKeyString);

        if (!Array.isArray(secretKeyArray)) {
            throw new Error("SOLANA_KEYPAIR must be an array.");
        }
    } else {
        // Decode as Base58
        console.log("Decoding SOLANA_KEYPAIR as Base58 string...");
        secretKeyArray = bs58.decode(secretKeyString);
    }

    // Ensure the key is valid length
    if (secretKeyArray.length !== 64) {
        throw new Error("Invalid secret key size. Must be 64 bytes.");
    }

    keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    console.log("Parsed SOLANA_KEYPAIR:", keypair.publicKey.toBase58());
} catch (err) {
    console.error("Error parsing SOLANA_KEYPAIR:", err.message);
    throw new Error("SOLANA_KEYPAIR is not valid. Ensure it is a Base58 string or JSON array.");
}

export const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");

export { keypair }; // Exporting the keypair for other modules that might need it
