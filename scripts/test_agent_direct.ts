import "dotenv/config";
import { LlmAgent, Gemini } from "@google/adk";
import { astraVectorSearchTool } from "../app/lib/agents/tools/vector-tool";

async function testAgent() {
    console.log("Testing ADK Agent...");

    if (!process.env.GOOGLE_API_KEY) {
        console.warn("WARNING: GOOGLE_API_KEY is missing. Agent might fail if using Gemini.");
    }

    try {
        const model = new Gemini({
            model: "gemini-1.5-flash",
        });

        const agent = new LlmAgent({
            name: "test-agent",
            model: model,
            tools: [astraVectorSearchTool],
            instruction: "You are an F1 assistant.",
        });

        const input = "Who won the 2024 F1 championship?";
        console.log(`Input: ${input}`);

        const response = await (agent as any).run({ input });

        console.log("Agent Response:", JSON.stringify(response, null, 2));

    } catch (error) {
        console.error("Agent Test Failed:", error);
    }
}

testAgent();
