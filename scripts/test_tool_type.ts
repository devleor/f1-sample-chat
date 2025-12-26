import { FunctionTool } from "@google/adk";
import { z } from "zod";

const s = z.object({ q: z.string() });
new FunctionTool<typeof s>({
    name: "foo",
    description: "bar",
    parameters: s,
});
