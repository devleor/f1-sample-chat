import { NextRequest, NextResponse } from "next/server";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { HfInference } from "@huggingface/inference";
import redis from "@/lib/redis";
import { traceable } from "langsmith/traceable";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import dotenv from "dotenv";
import path from "path";

// Force load env vars with explicit path and debug logging
const envPath = path.resolve(process.cwd(), '.env');
console.log("DEBUG: Loading env from:", envPath);
const result = dotenv.config({ path: envPath });
if (result.error) console.error("DEBUG: Error loading .env:", result.error);

// Log relevant keys to debug
const relevantKeys = Object.keys(process.env).filter(k => k.includes('LANG') || k.includes('PROJECT'));
console.log("DEBUG: All Env Keys (LANG/PROJECT):", relevantKeys);
relevantKeys.forEach(k => {
  const val = process.env[k] || "";
  // Mask sensitive parts
  const display = k.includes("KEY") ? val.substring(0, 5) + "..." : val;
  console.log(`DEBUG: ${k} = ${display}`);
});

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Traceable wrapper for HF generation
const generateResponse = traceable(async (messages: any[], systemPrompt: string) => {
  // DEBUG: Check vars inside request
  const pName = process.env.LANGCHAIN_PROJECT || process.env.LANGSMITH_PROJECT || "default";
  console.log("DEBUG: Inside Traceable - Resolved Project Name:", pName);

  const responseStream = hf.chatCompletionStream({
    model: "Qwen/Qwen2.5-72B-Instruct",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return responseStream;
}, {
  name: "generate_response",
  project_name: process.env.LANGCHAIN_PROJECT || process.env.LANGSMITH_PROJECT
});

// Astra DB setup
const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
  keyspace: process.env.ASTRA_DB_KEYSPACE
});

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionId, userLanguage } = await req.json();
    const lastMessage = messages[messages.length - 1];

    if (sessionId) {
      await redis.rpush(`chat:${sessionId}`, JSON.stringify(lastMessage));
      await redis.expire(`chat:${sessionId}`, 86400); // 24 hours TTL
    }

    // 1. Generate embedding for user question
    const questionEmbedding = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: lastMessage.content
    });

    // Ensure vector is properly typed as number array
    const vector: number[] = Array.isArray(questionEmbedding)
      ? questionEmbedding as number[]
      : Array.from(questionEmbedding as ArrayLike<number>);

    // 2. Search for relevant F1 content
    const collection = db.collection(process.env.ASTRA_DB_COLLECTION);
    const searchResults = await collection.find({}, {
      sort: { $vector: vector },
      limit: 3,
      includeSimilarity: true
    }).toArray();

    // 3. Build context from search results
    const context = searchResults.map(doc => doc.text).join('\n\n');



    // 4. Create enhanced system prompt with F1 context
    let systemPrompt = `You are an AI assistant who knows everything about Formula One.
Use the below context to augment what you know about Formula One racing.
The context will provide you with the most recent page data from wikipedia,
the official F1 website and others.
If the context doesn't include the information you need answer based on your
existing knowledge and don't mention the source of your information or
what the context does or doesn't include.
Format responses using markdown where applicable and don't return
images.

USER LANGUAGE INFO:
The user's browser language is: ${userLanguage || 'Unknown'}.
IMPORTANT: Detect the language of the user's input message. 
- If the user writes in a specific language, RESPOND IN THAT LANGUAGE.
- If the input is ambiguous, default to the browser language (${userLanguage || 'English'}).
- Main rule: Always match the user's language.

----------------
START CONTEXT
${context}
END CONTEXT
----------------
QUESTION: ${lastMessage.content}
----------------
`;

    // Local System Prompt is used directly.

    // 5. Generate response with Hugging Face (Streaming)
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        try {
          // Use the traceable wrapper
          const responseStream = await generateResponse(messages, systemPrompt);

          for await (const chunk of responseStream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              fullResponse += content;
              controller.enqueue(new TextEncoder().encode(content));
            }
          }

          if (sessionId && fullResponse) {
            const assistantMsg = { role: 'assistant', content: fullResponse, timestamp: new Date() };
            await redis.rpush(`chat:${sessionId}`, JSON.stringify(assistantMsg));
            await redis.expire(`chat:${sessionId}`, 86400);
          }

          controller.close();
        } catch (err) {
          console.error("Streaming error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      },
    });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate response",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}