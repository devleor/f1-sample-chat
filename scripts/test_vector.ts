import "dotenv/config";
import { searchVectorStore } from "../app/lib/vector-store";

async function deepTest() {
    console.log("Testing Vector Store...");
    try {
        const query = "Who is the current F1 champion in 2024?";
        console.log(`Query: "${query}"`);
        const result = await searchVectorStore(query, 2);
        console.log("\nResults:\n" + result);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

deepTest();
