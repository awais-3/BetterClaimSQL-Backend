import {
    createCloseAccountInstruction,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    ComputeBudgetProgram,
    PublicKey,
    SystemProgram,
    Transaction,
    Keypair,
} from "@solana/web3.js";
import { connection } from "./connection.mjs";
import { burnAccountBalance } from "./burning.mjs";
import { addCharityTransfer } from "./charityTranfer.mjs";
import { getAffiliatedWallet } from "../affiliation/affiliation.mjs";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

const USER_SHARE = 0.65; 

// Load the keypair from environment variable
const secretKeyString = process.env.SOLANA_KEYPAIR;
if (!secretKeyString) throw new Error("SOLANA_KEYPAIR is not defined in .env");

let keypair;
try {
    const secretKeyArray = bs58.decode(secretKeyString);
    keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
} catch (err) {
    throw new Error("Invalid SOLANA_KEYPAIR. Ensure it is correctly configured.");
}

/**
 * Validate a public key format.
 * @param {string} accountPublicKey - The public key to validate.
 * @returns {PublicKey} Validated PublicKey object.
 * @throws Error if the key is invalid.
 */
function validatePublicKey(accountPublicKey) {
    try {
        const publicKey = new PublicKey(accountPublicKey);
        return publicKey;
    } catch (error) {
        throw new Error(`Invalid public key format: ${accountPublicKey}`);
    }
}

/**
 * Create a base transaction with compute budget settings.
 * @returns {Transaction} A new transaction with compute limits and price.
 */
function createBaseTransaction() {
    const computeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 10_000 });
    const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150_000 });
    return new Transaction().add(computeUnits, computeUnitPrice);
}

/**
 * Create a close account instruction.
 * @param {string} userPublicKey - The user's public key.
 * @param {string} accountPublicKey - The account's public key to close.
 * @returns {Object} Contains rent amount and the close instruction.
 */
async function closeAccountInstruction(userPublicKey, accountPublicKey) {
    const validatedAccountKey = validatePublicKey(accountPublicKey);

    const accountInfo = await connection.getAccountInfo(validatedAccountKey);
    if (!accountInfo) throw new Error(`Account not found for ${accountPublicKey}`);

    const rentAmount = accountInfo.lamports;

    const closeInstruction = createCloseAccountInstruction(
        validatedAccountKey,
        validatePublicKey(userPublicKey),
        validatePublicKey(userPublicKey),
        [],
        TOKEN_PROGRAM_ID
    );

    return { rentAmount, closeInstruction };
}

/**
 * Obtain affiliated wallet from referral code.
 * @param {string} code - The referral code.
 * @returns {Object|null} Affiliated wallet information or null if not found.
 */
async function obtainAffiliatedWallet(code = null) {
    if (!code) return null;
    return await getAffiliatedWallet(code);
}

/**
 * Add a transfer to a referral wallet in the transaction.
 * @param {string} userPublicKey - The user's public key.
 * @param {number} destinationShare - The share amount to transfer.
 * @param {Object} affiliatedWallet - The referral wallet information.
 * @param {Transaction} transaction - The transaction to which the transfer should be added.
 * @returns {number} The referral share amount in lamports.
 */
async function addTransferToReferral(userPublicKey, destinationShare, affiliatedWallet, transaction) {
    const referralShare = Math.floor(destinationShare * 0.30); // Changed from 0.15 to 0.30 (30%)

    const referralPubKey = validatePublicKey(affiliatedWallet.wallet_address);
    const recipientAccountInfo = await connection.getAccountInfo(referralPubKey);

    if (recipientAccountInfo) {
        const referralTransfer = SystemProgram.transfer({
            fromPubkey: validatePublicKey(userPublicKey),
            toPubkey: referralPubKey,
            lamports: referralShare,
        });

        transaction.add(referralTransfer);
        return referralShare;
    }
    return 0;
}

/**
 * Close a single account and generate a transaction.
 */
export async function closeAccountTransaction(userPublicKey, accountPublicKey, referralCode) {
    console.log("Attempting to close account:", accountPublicKey);
    console.log("User public key:", userPublicKey);

    try {
        const transaction = createBaseTransaction();
        const validatedUserKey = validatePublicKey(userPublicKey);
        const validatedAccountKey = validatePublicKey(accountPublicKey);
        
        const balance = await connection.getBalance(validatedUserKey);
        console.log("User balance:", balance);

        let charityBalance = null;
        let userSharePercentage = USER_SHARE;
        let signTransaction = false;

        if (balance === 0) {
            charityBalance = await addCharityTransfer(userPublicKey, transaction);
            userSharePercentage = 0.75;
            signTransaction = true;
        }

        const { rentAmount, closeInstruction } = await closeAccountInstruction(userPublicKey, accountPublicKey);
        console.log("Rent amount:", rentAmount);
        
        transaction.add(closeInstruction);

        let userShare = Math.floor(rentAmount * userSharePercentage);
        let destinationShare = rentAmount - userShare;

        if (charityBalance) {
            userShare -= charityBalance;
            destinationShare += charityBalance;
        }

        if (referralCode) {
            try {
                console.log("Referral code provided:", referralCode);
                const affiliatedWallet = await obtainAffiliatedWallet(referralCode);
                if (affiliatedWallet) {
                    console.log("Affiliated Wallet found:", affiliatedWallet);
                    const referralShare = await addTransferToReferral(userPublicKey, destinationShare, affiliatedWallet, transaction);
                    destinationShare -= referralShare;
                } else {
                    throw new Error(`No affiliated wallet found for the referral code: ${referralCode}`);
                }
            } catch (referralError) {
                console.error("Error processing referral code:", referralError.message);
                throw new Error(`Failed to create transaction due to referral code: ${referralError.message}`);
            }
        }

        const transferInstruction = SystemProgram.transfer({
            fromPubkey: validatedUserKey,
            toPubkey: keypair.publicKey,
            lamports: destinationShare,
        });
        transaction.add(transferInstruction);

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = signTransaction ? keypair.publicKey : validatedUserKey;
        if (signTransaction) transaction.partialSign(keypair);

        console.log("Transaction successfully created:", transaction);

        return { transaction, solReceived: userShare / 1_000_000_000 };
    } catch (error) {
        console.error("Failed to create the transaction:", error);
        throw new Error("Failed to create the transaction");
    }
}


/**
 * Close an account with a balance, burning its tokens, and generate a transaction.
 */
export async function closeAccountWithBalanceTransaction(userPublicKey, accountPublicKey, referralCode) {
    const transaction = createBaseTransaction();
    const validatedUserKey = validatePublicKey(userPublicKey);
    const balance = await connection.getBalance(validatedUserKey);
    let charityBalance = null;
    let userSharePercentage = USER_SHARE;
    let signTransaction = false;

    if (balance === 0) {
        charityBalance = await addCharityTransfer(userPublicKey, transaction);
        userSharePercentage = 0.75;
        signTransaction = true;
    }

    await burnAccountBalance(userPublicKey, accountPublicKey, transaction);
    const { rentAmount, closeInstruction } = await closeAccountInstruction(userPublicKey, accountPublicKey);
    transaction.add(closeInstruction);

    let userShare = Math.floor(rentAmount * userSharePercentage);
    let destinationShare = rentAmount - userShare;

    if (charityBalance) {
        userShare -= charityBalance;
        destinationShare += charityBalance;
    }

    if (referralCode) {
        const affiliatedWallet = await obtainAffiliatedWallet(referralCode);
        if (affiliatedWallet) {
            const referralShare = await addTransferToReferral(userPublicKey, destinationShare, affiliatedWallet, transaction);
            destinationShare -= referralShare;
        }
    }

    const transferInstruction = SystemProgram.transfer({
        fromPubkey: validatedUserKey,
        toPubkey: keypair.publicKey,
        lamports: destinationShare,
    });
    transaction.add(transferInstruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signTransaction ? keypair.publicKey : validatedUserKey;
    if (signTransaction) transaction.partialSign(keypair);

    return { transaction, solReceived: userShare / 1_000_000_000 };
}

/**
 * Generate a transaction to close multiple accounts in a batch.
 */
export async function closeAccountBunchTransaction(userPublicKey, accountPublicKeys, referralCode) {
    const validatedUserKey = validatePublicKey(userPublicKey);
    const transaction = createBaseTransaction();
    const balance = await connection.getBalance(validatedUserKey);
    let charityBalance = null;
    let userSharePercentage = USER_SHARE;
    let signTransaction = false;

    if (balance === 0) {
        charityBalance = await addCharityTransfer(userPublicKey, transaction);
        userSharePercentage = 0.75;
        signTransaction = true;
    }

    let totalRentAmount = 0;
    const errors = [];
    const processedAccounts = [];

    for (const accountKey of accountPublicKeys) {
        try {
            const validatedAccountKey = validatePublicKey(accountKey);
            const { rentAmount, closeInstruction } = await closeAccountInstruction(userPublicKey, validatedAccountKey.toBase58());
            totalRentAmount += rentAmount;
            transaction.add(closeInstruction);
            processedAccounts.push(validatedAccountKey.toBase58());
        } catch (error) {
            console.error(`Failed to process account ${accountKey}:`, error.message);
            errors.push({ accountPublicKey: accountKey, error: error.message });
        }
    }

    if (processedAccounts.length === 0) {
        throw new Error("No valid accounts to process");
    }

    let userShare = Math.floor(totalRentAmount * userSharePercentage);
    let destinationShare = totalRentAmount - userShare;

    if (charityBalance) {
        userShare -= charityBalance;
        destinationShare += charityBalance;
    }

    if (referralCode) {
        const affiliatedWallet = await obtainAffiliatedWallet(referralCode);
        if (affiliatedWallet) {
            const referralShare = await addTransferToReferral(userPublicKey, destinationShare, affiliatedWallet, transaction);
            destinationShare -= referralShare;
        }
    }

    const transferInstruction = SystemProgram.transfer({
        fromPubkey: validatedUserKey,
        toPubkey: keypair.publicKey,
        lamports: destinationShare,
    });
    transaction.add(transferInstruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signTransaction ? keypair.publicKey : validatedUserKey;
    if (signTransaction) transaction.partialSign(keypair);

    return {
        transaction,
        solReceived: userShare / 1_000_000_000,
        processedAccounts,
        errors,
    };
}
