import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { buildEngineerGraph } from "./agents/engineer.js";
import { logMessage } from "./utils/logger.js";

const TASK =
  "In the workspace, create a package.json with a 'test' script that runs `node -e \"console.log('3 " +
  "passed, 0 failed')\"` and a 'build' script that runs `node -e \"console.log('build ok')\"`. Run the " +
  "test script and report its output. Then try running a script called 'deploy' (which doesn't exist) " +
  "and report what happens.";

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
