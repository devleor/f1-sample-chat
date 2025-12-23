import { NextRequest, NextResponse } from "next/server";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { HfInference } from "@huggingface/inference";



const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Astra DB setup
const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
  keyspace: process.env.ASTRA_DB_KEYSPACE
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

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
    const systemPrompt = `You are an AI assistant who knows everything about Formula One.
Use the below context to augment what you know about Formula One racing.
The context will provide you with the most recent page data from wikipedia,
the official F1 website and others.
If the context doesn't include the information you need answer based on your
existing knowledge and don't mention the source of your information or
what the context does or doesn't include.
Format responses using markdown where applicable and don't return
images.
----------------
START CONTEXT
${context}
END CONTEXT
----------------
QUESTION: ${lastMessage.content}
----------------
`;

    // 5. Generate response with Hugging Face (Streaming)
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of hf.chatCompletionStream({
            model: "Qwen/Qwen2.5-72B-Instruct",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              ...messages
            ],
            temperature: 0.7,
            max_tokens: 4000,
          })) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
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