import { LlmAgent, Gemini } from "@google/adk";
import { astraVectorSearchTool } from "@/app/lib/agents/tools/vector-tool"; // Use alias if possible, or relative path
// Default to relative if @ isn't guaranteed: 
// ../../lib/agents/tools/vector-tool
import { NextRequest, NextResponse } from "next/server";

// Initialize Model
// Ensure GOOGLE_API_KEY is in .env
const model = new Gemini({
    model: "gemini-1.5-flash", // or gemini-pro
});

// Initialize Agent
const agent = new LlmAgent({
    name: "f1-agent",
    model: model,
    tools: [astraVectorSearchTool],
    instruction: `You are an expert F1 assistant.
  - Use the 'search_f1_knowledge' tool to answer questions about F1.
  - If the search results are not sufficient, admit you don't know rather than hallucinating.
  - Keep answers concise and engaging.`,
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        console.log(`[Agent] Received prompt: ${prompt}`);

        // Run the agent
        const response = await (agent as any).run({
            input: prompt
        });

        // The response structure depends on ADK version. 
        // Usually response.content or similar.
        // Based on recent ADK, it might return a complex object.
        // Inspecting exports showed 'isFinalResponse' helper.

        // For now, return the whole response or text.
        // Assuming .text() or .content

        // Let's assume standard format:
        const text = response.content || JSON.stringify(response);

        return NextResponse.json({ response: text });
    } catch (error: any) {
        console.error("Agent Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
