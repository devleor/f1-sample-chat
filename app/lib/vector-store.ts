import { DataAPIClient } from "@datastax/astra-db-ts";
import { HfInference } from "@huggingface/inference";

const {
    ASTRA_DB_KEYSPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    HUGGINGFACE_API_KEY,
} = process.env;

if (!ASTRA_DB_APPLICATION_TOKEN || !ASTRA_DB_API_ENDPOINT || !ASTRA_DB_COLLECTION) {
    throw new Error("Missing Astra DB environment variables.");
}

if (!HUGGINGFACE_API_KEY) {
    throw new Error("Missing Hugging Face API Key.");
}

// Initialize Clients
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_KEYSPACE });
const collection = db.collection(ASTRA_DB_COLLECTION);
const hf = new HfInference(HUGGINGFACE_API_KEY);

export async function searchVectorStore(query: string, limit: number = 5) {
    try {
        // 1. Generate Embedding
        const embedding = await hf.featureExtraction({
            model: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            inputs: query,
        });

        const vector = (Array.isArray(embedding) ? embedding : Array.from(embedding as any)) as number[];

        // 2. Query Astra DB
        const cursor = await collection.find(
            {},
            {
                sort: { $vector: vector },
                limit: limit,
                projection: { text: 1, $vector: 0 }, // We only need the text
            }
        );

        const results = await cursor.toArray();
        return results.map((doc) => doc.text).join("\n\n");
    } catch (error) {
        console.error("Error searching vector store:", error);
        throw error;
    }
}
