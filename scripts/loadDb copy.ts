import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer"
import OpenAI from "openai"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { config } from "dotenv"

config(); // Load environment variables

type SimilarityMetric = "cosine" | "dot_product" | "euclidean";

const { ASTRA_DB_KEYSPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, GROK_API_KEY } = process.env;


const groq = new OpenAI({
    apiKey: GROK_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
})

const f1Data = [
    'https://en.wikipedia.org/wiki/Formula_One',
    'https://www.formula1.com/en/latest/all'
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_KEYSPACE })



const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 200,
})


const createCollection = async (similarityMetrict: SimilarityMetric = "dot_product") => {
    try {
        // Try to drop existing collection first
        await db.dropCollection(ASTRA_DB_COLLECTION)
        console.log("Dropped existing collection")
    } catch (error) {
        console.log("No existing collection to drop")
    }

    const collection = await db.createCollection(ASTRA_DB_COLLECTION, { vector: { dimension: 1536, metric: similarityMetrict } })
    console.log("Collection created" + collection)
    return collection
}

const loadSampleData = async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION);
    for await (const url of f1Data) {
        const content = await scrapePage(url);
        const chunks = await splitter.splitText(content);

        for await (const chunk of chunks) {
            const embedding = await groq.embeddings.create({
                input: chunk,
                model: "text-embedding-3-small",
                encoding_format: "float"
            })
            const vector = embedding.data[0].embedding
            const res = await collection.insertOne({ $vector: vector, text: chunk });
            console.log(res)
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