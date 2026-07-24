import { ChatOpenAI } from "@langchain/openai";

export function createModel() {
  const model = process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error(
      "OPENAI_MODEL is not set. Add it to your .env file (e.g. OPENAI_MODEL=gpt-4.1).",
    );
  }

  return new ChatOpenAI({
    model,
  });
}
