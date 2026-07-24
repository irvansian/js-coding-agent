import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { buildEngineerGraph } from "./agents/engineer.js";

const TASK =
  "Clone https://github.com/irvansian/tetra-frontend into the workspace, create a new branch for " +
  "this change, then update the 'antd' dependency in package.json to version 6.5.2 and run npm " +
  "install to apply it, then stage and commit the change with an appropriate commit message, push " +
  "the branch to origin, and open a pull request for it against the default branch.";

async function main() {
  const agent = buildEngineerGraph();

  const result = await agent.invoke(
    { messages: [new HumanMessage(TASK)] },
    { recursionLimit: 60 },
  );

  const finalMessage = result.messages[result.messages.length - 1];
  console.log(finalMessage.content);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
