import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getWorkspaceRoot } from "../config/workspace.js";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_CHARS = 4000;

function truncate(text) {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `... (truncated) ...\n${text.slice(-MAX_OUTPUT_CHARS)}`;
}

async function runNpm(args) {
  try {
    const { stdout, stderr } = await execFileAsync("npm", args, {
      cwd: getWorkspaceRoot(),
      maxBuffer: 10 * 1024 * 1024,
    });
    return truncate(stdout.trim() || stderr.trim() || "(no output)");
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
    return `Error running npm ${args.join(" ")}: ${truncate(detail)}`;
  }
}

const npmInstall = tool(
  async ({ packages, dev }) => {
    const args = ["install"];
    if (packages && packages.length > 0) {
      args.push(...packages);
      if (dev) args.push("--save-dev");
    }
    return runNpm(args);
  },
  {
    name: "npm_install",
    description:
      "Run npm install in the workspace. With no packages, reconciles node_modules with the existing package.json (use this after manually editing package.json). With packages given, installs those specific packages and updates package.json/package-lock.json automatically.",
    schema: z.object({
      packages: z
        .array(z.string())
        .optional()
        .describe(
          "Specific package names to install, e.g. ['lodash', 'zod@3']. Omit to install from the existing package.json.",
        ),
      dev: z
        .boolean()
        .optional()
        .describe("Install as devDependencies (--save-dev). Only applies when packages are given."),
    }),
  },
);

export const npmTools = [npmInstall];
