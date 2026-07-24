import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { createModel } from "../models/chat-model.js";
import { fileTools } from "../tools/file-tools.js";
import { searchTools } from "../tools/search-tools.js";
import { gitTools } from "../tools/git-tools.js";
import { githubTools } from "../tools/github-tools.js";
import { npmTools } from "../tools/npm-tools.js";
import { logMessage } from "../utils/logger.js";

const tools = [...fileTools, ...searchTools, ...gitTools, ...githubTools, ...npmTools];
const model = createModel().bindTools(tools);
const toolNode = new ToolNode(tools);

async function callModel(state) {
  const response = await model.invoke(state.messages);
  logMessage(response);
  return { messages: [response] };
}

export function buildEngineerGraph() {
  return new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, {
      tools: "tools",
      [END]: END,
    })
    .addEdge("tools", "agent")
    .compile();
}
