import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer"
import OpenAI from "openai"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { HfInference } from "@huggingface/inference"
import { config } from "dotenv"

config(); // Load environment variables

type SimilarityMetric = "cosine" | "dot_product" | "euclidean";

const { ASTRA_DB_KEYSPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, GROQ_API_KEY, HUGGINGFACE_API_KEY } = process.env;

const groq = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
})

// Hugging Face para embeddings (gratuito)
const hf = new HfInference(HUGGINGFACE_API_KEY)

const f1Data = [
    'https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship',
    'https://www.formula1.com/en/teams.html',
    'https://www.formula1.com/en/drivers.html',
    'https://www.skysports.com/f1/news/12433/13071399/f1-2024-cars-launched-ferrari-mercedes-red-bull-and-more-revealed-for-new-formula-1-season'
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_KEYSPACE })



const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 200,
})


const createCollection = async (similarityMetric: SimilarityMetric = "cosine") => {
    try {
        // Try to drop existing collection first
        await db.dropCollection(ASTRA_DB_COLLECTION)
        console.log("Dropped existing collection")
    } catch (error) {
        console.log("No existing collection to drop")
    }

    // Create collection with vector support (384 dimensions for sentence-transformers/all-MiniLM-L6-v2)
    const collection = await db.createCollection(ASTRA_DB_COLLECTION, {
        vector: { dimension: 384, metric: similarityMetric }
    })
    console.log("Collection created with vector support")
    return collection
}

const loadSampleData = async () => {
    const collection = db.collection(ASTRA_DB_COLLECTION);
    for await (const url of f1Data) {
        const content = await scrapePage(url);
        const chunks = await splitter.splitText(content);

        for await (const chunk of chunks) {
            try {
                // Generate embeddings using Hugging Face (gratuito)
                const embedding = await hf.featureExtraction({
                    model: "sentence-transformers/all-MiniLM-L6-v2",
                    inputs: chunk
                });

                // Convert to array if needed
                const vector = Array.isArray(embedding) ? embedding : Array.from(embedding as any);

                const res = await collection.insertOne({
                    text: chunk,
                    $vector: vector
                });
                console.log(res)
            } catch (error) {
                console.error("Error processing chunk:", error);
                // Continue with next chunk
            }
        }
    }
}

const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true
        },
        gotoOptions: {
            waitUntil: "domcontentloaded"
        },
        evaluate: async (page: any, browser: any) => {
            const result = await page.evaluate(() => document.body.innerHTML)
            await browser.close()
            return result
        }
    });

    const content = await loader.load();
    return content[0]?.pageContent?.replace(/<[^>]*>?/g, '') || '';
}

createCollection().then(() => loadSampleData());