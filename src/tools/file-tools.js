import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveWorkspacePath } from "../config/workspace.js";

const readFile = tool(
  async ({ filePath }) => {
    try {
      const resolved = resolveWorkspacePath(filePath);
      return await fs.readFile(resolved, "utf-8");
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "read_file",
    description: "Read the full contents of a text file at the given relative path.",
    schema: z.object({
      filePath: z.string().describe("Path to the file, relative to the workspace root"),
    }),
  },
);

const listDirectory = tool(
  async ({ dirPath }) => {
    try {
      const resolved = resolveWorkspacePath(dirPath ?? ".");
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return entries
        .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
        .join("\n");
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "list_directory",
    description: "List files and subdirectories at the given relative path.",
    schema: z.object({
      dirPath: z
        .string()
        .optional()
        .describe("Path to list, relative to the workspace root. Defaults to the workspace root."),
    }),
  },
);

const writeFile = tool(
  async ({ filePath, content }) => {
    try {
      const resolved = resolveWorkspacePath(filePath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");
      return `Wrote ${content.length} characters to ${filePath}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "write_file",
    description:
      "Create a new file or overwrite an existing file with the given content. Creates parent directories if needed.",
    schema: z.object({
      filePath: z.string().describe("Path to the file, relative to the workspace root"),
      content: z.string().describe("Full content to write to the file"),
    }),
  },
);

const editFile = tool(
  async ({ filePath, oldString, newString }) => {
    try {
      const resolved = resolveWorkspacePath(filePath);
      const content = await fs.readFile(resolved, "utf-8");

      const occurrences = content.split(oldString).length - 1;
      if (occurrences === 0) {
        return `Error: oldString not found in ${filePath}. No changes made.`;
      }
      if (occurrences > 1) {
        return `Error: oldString matches ${occurrences} locations in ${filePath}. Provide more surrounding context to make it unique. No changes made.`;
      }

      const updated = content.replace(oldString, newString);
      await fs.writeFile(resolved, updated, "utf-8");
      return `Replaced 1 occurrence in ${filePath}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  },
  {
    name: "edit_file",
    description:
      "Replace an exact string in a file with a new string. oldString must match exactly one location in the file; include enough surrounding context to make it unique.",
    schema: z.object({
      filePath: z.string().describe("Path to the file, relative to the workspace root"),
      oldString: z.string().describe("Exact existing text to replace (must be unique in the file)"),
      newString: z.string().describe("Text to replace it with"),
    }),
  },
);

export const fileTools = [readFile, listDirectory, writeFile, editFile];
