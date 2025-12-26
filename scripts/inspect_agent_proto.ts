import { LlmAgent, FunctionTool } from "@google/adk";

console.log("LlmAgent prototype methods:", Object.getOwnPropertyNames(LlmAgent.prototype));
console.log("FunctionTool prototype methods:", Object.getOwnPropertyNames(FunctionTool.prototype));

try {
    const agent = new LlmAgent({ name: "test", model: {} as any, instruction: "test" });
    console.log("Agent instance keys:", Object.keys(agent));
} catch (e) {
    console.log("Could not instantiate agent:", e.message);
}
