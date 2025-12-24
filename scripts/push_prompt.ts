import { push } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as dotenv from "dotenv";

dotenv.config();

const main = async () => {
    console.log("Pushing prompt to LangSmith Hub...");

    const systemTemplate = `You are an AI assistant who knows everything about Formula One.
Use the below context to augment what you know about Formula One racing.
The context will provide you with the most recent page data from wikipedia,
the official F1 website and others.
If the context doesn't include the information you need answer based on your
existing knowledge and don't mention the source of your information or
what the context does or doesn't include.
Format responses using markdown where applicable and don't return
images.

USER LANGUAGE INFO:
The user's browser language is: {userLanguage}.
IMPORTANT: Detect the language of the user's input message. 
- If the user writes in a specific language, RESPOND IN THAT LANGUAGE.
- If the input is ambiguous, default to the browser language ({userLanguage}).
- Main rule: Always match the user's language.

----------------
START CONTEXT
{context}
END CONTEXT
----------------
QUESTION: {question}
----------------
`;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemTemplate],
    ]);

    try {
        // Attempt to push to "f1-chat-system"
        // If this fails due to missing handle, the user checks logs.
        // We cannot easily auto-detect handle without "langsmith" package client logic effectively, 
        // and even then ownership is complex. 
        // We will try pushing to "f1-chat-system" which implies current user's namespace if key is scoped?
        // Actually, usually requires "handle/repo". 
        // I will try to use a placeholder "default/f1-chat-system" if it fails? No.
        const repoName = "f1-chat-system";
        const url = await push(repoName, prompt);
        console.log(`Successfully pushed prompt to ${url}`);
    } catch (error) {
        console.error("Error pushing prompt. Ensure you have ownership or provide 'handle/repo-name'.", error);
    }
};

main();
