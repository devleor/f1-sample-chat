
import dotenv from 'dotenv';
import { HfInference } from "@huggingface/inference";
import { traceable } from "langsmith/traceable";

// Load environment variables
dotenv.config();

console.log("---------------------------------------------------");
console.log("  API CONNECTION TEST SCRIPT");
console.log("---------------------------------------------------");

// 1. Verify Env Vars
const requiredVars = [
    "HUGGINGFACE_API_KEY",
    "LANGCHAIN_API_KEY",
    "LANGCHAIN_PROJECT",
    "LANGCHAIN_ENDPOINT"
];

let missing = false;
requiredVars.forEach(v => {
    if (!process.env[v]) {
        console.error(`[ERROR] Missing environment variable: ${v}`);
        missing = true;
    } else {
        // Mask key
        const val = process.env[v] as string;
        const masked = val.length > 8 ? val.substring(0, 4) + "..." + val.substring(val.length - 4) : "****";
        console.log(`[OK] ${v} is set (${masked})`);
    }
});

if (missing) {
    console.error("Please update your .env file with the missing variables.");
    process.exit(1);
}

// 2. Test LangSmith Tracing
console.log("\n[TEST] Testing LangSmith Tracing...");
const testTracing = traceable(async (input: string) => {
    return `Processed: ${input}`;
}, { name: "test_connection_script" });

// 3. Test Hugging Face
console.log("\n[TEST] Testing Hugging Face Inference...");
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

async function runTests() {
    try {
        // Run LangSmith trace
        console.log("  -> Sending trace to LangSmith...");
        const res = await testTracing("Hello from connection test!");
        console.log(`  -> LangSmith Trace completed locally. Result: "${res}"`);
        console.log("  -> Check your LangSmith dashboard for project: " + process.env.LANGCHAIN_PROJECT);

        // Run HF Chat
        console.log("\n  -> Sending request to Hugging Face (Qwen/Qwen2.5-72B-Instruct)...");
        const chatres = await hf.chatCompletion({
            model: "Qwen/Qwen2.5-72B-Instruct",
            messages: [{ role: "user", content: "Say 'Hello F1' in one word." }],
            max_tokens: 10
        });

        console.log(`  -> Hugging Face Response: "${chatres.choices[0].message.content}"`);
        console.log("\n[SUCCESS] All API connection tests passed!");

    } catch (error) {
        console.error("\n[FAILURE] Test Failed:", error);
        if (error instanceof Error && error.message.includes("403")) {
            console.error("  -> HINT: A 403 error usually means the API Key is invalid or does not have permission for this project.");
        }
    }
}

runTests();
