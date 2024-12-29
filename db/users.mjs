import { db } from "./firebase.mjs";

/**
 * Add a new user to the `users` collection.
 * @param {string} userId - The unique ID for the user.
 * @param {Object} userData - An object containing user details (e.g., wallet address, referral code).
 */
export async function addUser(userId, userData) {
    const usersRef = db.collection("users");

    try {
        await usersRef.doc(userId).set({
            ...userData,
            created_at: new Date(),
            updated_at: new Date(),
        });
        console.log(`User ${userId} added successfully.`);
    } catch (error) {
        console.error(`Error adding user ${userId}:`, error.message);
        throw new Error(`Failed to add user: ${error.message}`);
    }
}

/**
 * Get a user document from the `users` collection by user ID.
 * @param {string} userId - The unique ID for the user.
 * @returns {Object|null} - The user document, or null if not found.
 */
export async function getUser(userId) {
    const usersRef = db.collection("users");

    try {
        const userDoc = await usersRef.doc(userId).get();

        if (!userDoc.exists) {
            console.log(`User ${userId} not found.`);
            return null;
        }

        return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
        console.error(`Error fetching user ${userId}:`, error.message);
        throw new Error(`Failed to fetch user: ${error.message}`);
    }
}

/**
 * Update an existing user in the `users` collection.
 * @param {string} userId - The unique ID for the user.
 * @param {Object} updates - An object containing fields to update.
 */
export async function updateUser(userId, updates) {
    const usersRef = db.collection("users");

    try {
        await usersRef.doc(userId).update({
            ...updates,
            updated_at: new Date(),
        });
        console.log(`User ${userId} updated successfully.`);
    } catch (error) {
        console.error(`Error updating user ${userId}:`, error.message);
        throw new Error(`Failed to update user: ${error.message}`);
    }
}

/**
 * Delete a user from the `users` collection by user ID.
 * @param {string} userId - The unique ID for the user.
 */
export async function deleteUser(userId) {
    const usersRef = db.collection("users");

    try {
        await usersRef.doc(userId).delete();
        console.log(`User ${userId} deleted successfully.`);
    } catch (error) {
        console.error(`Error deleting user ${userId}:`, error.message);
        throw new Error(`Failed to delete user: ${error.message}`);
    }
}

/**
 * Fetch all users from the `users` collection.
 * @returns {Array<Object>} - Array of user documents.
 */
export async function getAllUsers() {
    const usersRef = db.collection("users");

    try {
        const querySnapshot = await usersRef.get();
        const users = [];

        querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });

        console.log(`Fetched ${users.length} users.`);
        return users;
    } catch (error) {
        console.error("Error fetching all users:", error.message);
        throw new Error("Failed to fetch users.");
    }
}

/**
 * Check if a user exists in the `users` collection.
 * @param {string} userId - The unique ID for the user.
 * @returns {boolean} - True if the user exists, otherwise false.
 */
export async function userExists(userId) {
    const usersRef = db.collection("users");

    try {
        const userDoc = await usersRef.doc(userId).get();
        return userDoc.exists;
    } catch (error) {
        console.error(`Error checking existence of user ${userId}:`, error.message);
        throw new Error(`Failed to check user existence: ${error.message}`);
    }
}
