import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import affiliationRouter from "./affiliation/affiliation.view.mjs";
import claimTransactionsRouter from "./claimTransactions.mjs";
import accountsRouter from "./accounts/accounts.view.mjs";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

dotenv.config();

console.log("SOLANA_RPC_URL from index.mjs:", process.env.SOLANA_RPC_URL);
console.log("SOLANA_KEYPAIR from index.mjs:", process.env.SOLANA_KEYPAIR);

// Parse SOLANA_KEYPAIR
let keypair;

try {
  const secretKeyString = process.env.SOLANA_KEYPAIR;
  if (!secretKeyString) {
    throw new Error("SOLANA_KEYPAIR is not defined in .env");
  }

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
  throw new Error(
    "SOLANA_KEYPAIR is not valid. Ensure it is a Base58 string or JSON array."
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Importing routers
app.use("/api/affiliation", affiliationRouter);
app.use("/api/claim-transactions", claimTransactionsRouter);
app.use("/api/accounts", accountsRouter);

// Handle React routing, return all requests to React app except for images and privacy-policy
app.get("/privacy-policy", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "privacy-policy.html"));
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next(); // Skip static file handling for API requests
  }
  if (req.path.startsWith("/images/")) {
    res.sendFile(path.join(__dirname, "public", req.path));
  } else {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

// Start the server
const server = http.createServer(app);

// server.listen(PORT, async () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log("Firebase integration and routers initialized successfully.");
// });

export { keypair }; // Exporting the keypair for compatibility with other modules if needed

export default server;
