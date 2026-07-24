import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { buildAgentGraph } from "./agents/graph.js";

const TASK =
  "Clone https://github.com/irvansian/based-neovim-config into the workspace, create a new branch " +
  "for this change, then read the README and other files to understand what the repo is about, add " +
  "a short summary of the repo to the end of README.md (create README.md if it doesn't exist), then " +
  "stage and commit the change with an appropriate commit message, push the branch to origin, and " +
  "open a pull request for it against the default branch.";

async function main() {
  const agent = buildAgentGraph();

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
