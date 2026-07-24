function formatContent(message) {
  if (typeof message.content === "string" && message.content.length > 0) {
    return message.content;
  }
  if (message.tool_calls?.length) {
    return message.tool_calls
      .map((call) => `[tool_call] ${call.name}(${JSON.stringify(call.args)})`)
      .join("\n");
  }
  return "(empty)";
}

/**
 * Logs human and AI messages as they occur in the conversation. Tool
 * messages are intentionally skipped to keep this log focused on the
 * human<->AI exchange rather than raw tool output.
 */
export function logMessage(message) {
  const type = message.getType();
  if (type !== "human" && type !== "ai") return;

  const label = type === "human" ? "HUMAN" : "AI";
  console.log(`\n[${label}] ${formatContent(message)}`);
}
