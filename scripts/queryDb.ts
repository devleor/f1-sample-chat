import { DataAPIClient } from "@datastax/astra-db-ts"
import { config } from "dotenv"

config()

const {
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    ASTRA_DB_COLLECTION
} = process.env

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT)

async function query(question: string) {
    console.log(`Querying for: "${question}"...`)

    try {
        const collection = db.collection(ASTRA_DB_COLLECTION)

        // We need to generate an embedding for the question to query
        // Since we don't have the OpenAI embedding visible here, 
        // we must rely on the Collection's find method if it supports vectorizing on the fly 
        // OR (more likely) we need to match the embedding method used in loadDb.ts.

        // loadDb.ts used HuggingFace 'sentence-transformers/all-MiniLM-L6-v2' via @huggingface/inference
        // We need to replicate that here to get the vector.

        const { HfInference } = await import("@huggingface/inference")
        const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

        const embedding = await hf.featureExtraction({
            model: "sentence-transformers/all-MiniLM-L6-v2",
            inputs: question,
        })

        const vector = embedding as number[];

        const cursor = await collection.find(
            {},
            {
                sort: { $vector: vector },
                limit: 5,
                includeSimilarity: true
            }
        )

        const results = await cursor.toArray();

        console.log(`Found ${results.length} matches:`)
        results.forEach((doc, i) => {
            console.log(`\n--- Match ${i + 1} (Similarity: ${doc.$similarity}) ---`)
            console.log(doc.text)
        })

    } catch (error) {
        console.error("Error querying DB:", error)
    }
}

const q = process.argv[2] || "What do the 2024 F1 cars look like?"
query(q)
