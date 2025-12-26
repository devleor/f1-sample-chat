import * as adk from "@google/adk";
console.log("Exports of @google/adk:", Object.keys(adk));

try {
    // Try deep imports if main is empty
    const agents = require("@google/adk/agents");
    console.log("Exports of @google/adk/agents:", Object.keys(agents));
} catch (e) { console.log("No @google/adk/agents"); }

try {
    const tools = require("@google/adk/tools");
    console.log("Exports of @google/adk/tools:", Object.keys(tools));
} catch (e) { console.log("No @google/adk/tools"); }
