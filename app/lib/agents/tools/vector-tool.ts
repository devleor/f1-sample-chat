import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { searchVectorStore } from "../../vector-store";

const querySchema = z.object({
    query: z.string().describe("The search query to find relevant F1 information."),
});

export const astraVectorSearchTool = new FunctionTool<typeof querySchema>({
    name: "search_f1_knowledge",
    description: "Search for specific information about Formula 1, including drivers, teams, races, and championships. Use this whenever the user asks a question about F1 facts.",
    parameters: querySchema,
    execute: async ({ query }: { query: string }) => {
        try {
            console.log(`[Tool] Searching for: ${query}`);
            const results = await searchVectorStore(query);
            return { results };
        } catch (error: any) {
            return { error: error.message };
        }
    },
});
