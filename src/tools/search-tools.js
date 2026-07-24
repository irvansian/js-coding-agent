import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { getWorkspaceRoot, resolveWorkspacePath } from "../config/workspace.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);
const MAX_RESULTS = 200;

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${pattern}$`);
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

const searchFiles = tool(
  async ({ pattern, filePattern, directory }) => {
    let root;
    try {
      root = resolveWorkspacePath(directory ?? ".");
    } catch (error) {
      return `Error: ${error.message}`;
    }

    const contentRegex = new RegExp(pattern);
    const nameRegex = filePattern ? globToRegExp(filePattern) : null;
    const workspaceRoot = getWorkspaceRoot();

    const matches = [];
    for await (const filePath of walk(root)) {
      if (nameRegex && !nameRegex.test(path.basename(filePath))) continue;

      let content;
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch {
        continue; // skip unreadable/binary files
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (contentRegex.test(lines[i])) {
          const relPath = path.relative(workspaceRoot, filePath);
          matches.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
          if (matches.length >= MAX_RESULTS) break;
        }
      }
      if (matches.length >= MAX_RESULTS) break;
    }

    if (matches.length === 0) return "No matches found.";
    const suffix = matches.length >= MAX_RESULTS ? `\n... truncated at ${MAX_RESULTS} results` : "";
    return matches.join("\n") + suffix;
  },
  {
    name: "search_files",
    description:
      "Search file contents for a regex pattern within the project directory, skipping node_modules/.git/dist/build. Optionally restrict to files matching a glob-like name pattern (e.g. '*.js').",
    schema: z.object({
      pattern: z.string().describe("Regular expression to search for within file contents"),
      filePattern: z
        .string()
        .optional()
        .describe("Glob-like filename filter, e.g. '*.js' or '*.md'. Defaults to all files."),
      directory: z
        .string()
        .optional()
        .describe("Directory to search, relative to the workspace root. Defaults to the workspace root."),
    }),
  },
);

export const searchTools = [searchFiles];
