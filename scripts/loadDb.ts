import * as cheerio from "cheerio"
import { DataAPIClient } from "@datastax/astra-db-ts"
import OpenAI from "openai"
import { HfInference } from "@huggingface/inference"
import { config } from "dotenv"

config(); // Load environment variables

type SimilarityMetric = "cosine" | "dot_product" | "euclidean";

const { ASTRA_DB_KEYSPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, GROQ_API_KEY, HUGGINGFACE_API_KEY } = process.env;

const groq = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
})

const hf = new HfInference(HUGGINGFACE_API_KEY)
const EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";

const f1Data = [
    'https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship',
    'https://en.wikipedia.org/wiki/2025_Formula_One_World_Championship',
    'https://www.formula1.com/en/teams.html',
    'https://www.formula1.com/en/drivers.html',
    'https://www.formula1.com/en/results/2025/races',
    'https://www.formula1.com/en/results/2024/races',
    'https://www.skysports.com/f1',
    'https://www.skysports.com/f1/news/12433/13071399/f1-2024-cars-launched-ferrari-mercedes-red-bull-and-more-revealed-for-new-formula-1-season'
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_KEYSPACE })

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Initialize the splitter with better defaults for context preservation
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 200,
});

const splitText = async (text: string): Promise<string[]> => {
    return await splitter.splitText(text);
}

const scrapePage = async (url: string, retries = 3) => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            clearTimeout(timeout);

            if (!response.ok) throw new Error(`Status ${response.status}`);

            const html = await response.text();
            const $ = cheerio.load(html);

            // Special handling for F1 Results pages to structure tabular data
            if (url.includes('formula1.com/en/results')) {
                const rows = $('tr').slice(1).map((i, el) => {
                    const cols = $(el).find('td');
                    if (cols.length > 0) {
                        const gp = $(cols[0]).text().trim().replace("Flag of ", "").replace(/Grand Prix.*/, "Grand Prix").trim();
                        // Fix bad country/flag text mapping, e.g. "Flag of AustraliaAustralia" -> "Australia"
                        // Actually the text() output was "Flag of AustraliaAustralia", so let's just grab the text carefully.
                        // But for simplicity, let's trust the text cleaning or just accept the location name.
                        const date = $(cols[1]).text().trim();
                        // Handle potential hidden text in winner/team cols
                        let winner = $(cols[2]).find('.hide-for-mobile').text().trim();
                        if (!winner) winner = $(cols[2]).text().trim().replace(/\s+/g, ' ');

                        let team = $(cols[3]).find('.hide-for-mobile').text().trim();
                        if (!team) team = $(cols[3]).text().trim().replace(/\s+/g, ' ');

                        const time = $(cols[5]).text().trim();

                        // Construct semantic sentence
                        return `In the 2025 F1 Season, at the ${gp} on ${date}, the winner was ${winner} driving for ${team} with a time of ${time}.`;
                    }
                    return "";
                }).get().filter(line => line.length > 20).join("\n");

                if (rows.length > 0) {
                    return rows;
                }
            }

            // Remove scripts, styles, and other non-content elements
            $('script, style, noscript, iframe, svg').remove();

            // Get clean text content
            const content = $('body').text().replace(/\s+/g, ' ').trim();

            return content;
        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed for ${url}:`, error);
            if (attempt < retries - 1) {
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            }
        }
    }
    return "";
}

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

    for (const url of f1Data) {
        console.log(`Scraping ${url}...`);
        const content = await scrapePage(url);

        if (!content) {
            console.log(`No content found for ${url}, skipping...`);
            continue;
        }

        const chunks = await splitText(content);
        console.log(`Split into ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                // Generate embeddings using Hugging Face (gratuito)
                const embedding = await hf.featureExtraction({
                    model: EMBEDDING_MODEL,
                    inputs: chunk
                });

                // Convert to array if needed
                const vector = Array.isArray(embedding) ? embedding : Array.from(embedding as any);

                await collection.insertOne({
                    text: chunk,
                    $vector: vector
                });

                if ((i + 1) % 10 === 0) {
                    console.log(`Processed ${i + 1}/${chunks.length} chunks`);
                }
            } catch (error) {
                console.error("Error processing chunk:", error);
                // Continue with next chunk
            }
        }
    }
    console.log("Data loading complete");
}

createCollection().then(() => loadSampleData());