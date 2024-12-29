import { db } from "./db/firebase.mjs";

async function testFirebase() {
    try {
        const testRef = db.collection("test_collection");
        const docRef = await testRef.add({ message: "Firebase is working!", timestamp: new Date() });
        console.log("Document added with ID:", docRef.id);
    } catch (error) {
        console.error("Error connecting to Firebase:", error);
    }
}

testFirebase();
