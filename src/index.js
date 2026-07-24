import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { buildEngineerGraph } from "./agents/engineer.js";
import { logMessage } from "./utils/logger.js";

const TASK =
  "The workspace is currently empty. Set up a new Express.js project from scratch: initialize " +
  "package.json, install express, and add a single GET / endpoint that responds with 'Hello World'. " +
  "Verify that it actually works before reporting done.";

async function main() {
  const agent = buildEngineerGraph();
  const humanMessage = new HumanMessage(TASK);
  logMessage(humanMessage);

  const result = await agent.invoke(
    { messages: [humanMessage] },
    { recursionLimit: 60 },
  );

  const finalMessage = result.messages[result.messages.length - 1];
  console.log("\n--- Final response ---");
  console.log(finalMessage.content);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
