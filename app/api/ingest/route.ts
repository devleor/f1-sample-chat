import { NextRequest, NextResponse } from "next/server";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HfInference } from "@huggingface/inference";

const { ASTRA_DB_KEYSPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, HUGGINGFACE_API_KEY } = process.env;

const hf = new HfInference(HUGGINGFACE_API_KEY);
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_KEYSPACE });

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 200,
});

async function processUrls(urls: string[]) {
    try {
        console.log("Starting background processing...");

        // 1. Drop existing collection
        try {
            await db.dropCollection(ASTRA_DB_COLLECTION);
            console.log("Dropped existing collection");
        } catch (error) {
            console.log("No existing collection to drop");
        }

        // 2. Create collection
        const collection = await db.createCollection(ASTRA_DB_COLLECTION, {
            vector: { dimension: 384, metric: "cosine" }
        });
        console.log("Collection created");

        // 3. Scrape and Index
        for (const url of urls) {
            console.log(`Processing ${url}...`);
            try {
                const loader = new PuppeteerWebBaseLoader(url, {
                    launchOptions: { headless: true },
                    gotoOptions: { waitUntil: "domcontentloaded" },
                    evaluate: async (page, browser) => {
                        const result = await page.evaluate(() => document.body.innerText); // innerText is cleaner than innerHTML
                        return result;
                    }
                });

                const content = await loader.load();
                const cleanContent = content[0]?.pageContent || '';

                const chunks = await splitter.splitText(cleanContent);

                for (const chunk of chunks) {
                    try {
                        const embedding = await hf.featureExtraction({
                            model: "sentence-transformers/all-MiniLM-L6-v2",
                            inputs: chunk
                        });

                        const vector = Array.isArray(embedding) ? embedding : Array.from(embedding as any);

                        await collection.insertOne({
                            text: chunk,
                            $vector: vector
                        });
                    } catch (e) {
                        console.error("Error processing chunk", e);
                    }
                }
            } catch (e) {
                console.error(`Error processing URL ${url}`, e);
            }
        }
        console.log("Background processing complete.");
    } catch (error) {
        console.error("Fatal background error:", error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const { urls } = await req.json();

        if (!urls || !Array.isArray(urls)) {
            return NextResponse.json({ error: "Invalid URLs provided" }, { status: 400 });
        }

        // Start background processing without awaiting
        processUrls(urls).catch(err => console.error("Async process error:", err));

        return NextResponse.json({
            success: true,
            message: "Context update started successfully. This process happens in the background."
        });

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
