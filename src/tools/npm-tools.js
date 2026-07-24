import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
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
      timeout: 5 * 60 * 1000, // hard backstop in case a script hangs (e.g. a dev server)
      env: { ...process.env, CI: "true" }, // most test runners skip interactive watch mode when CI is set
    });
    return truncate(stdout.trim() || stderr.trim() || "(no output)");
  } catch (error) {
    const parts = [error.stdout?.trim(), error.stderr?.trim()].filter(Boolean);
    const detail = parts.length > 0 ? parts.join("\n") : error.message;
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

const npmRunScript = tool(
  async ({ script, args }) => {
    let packageJsonRaw;
    try {
      packageJsonRaw = await fs.readFile(path.join(getWorkspaceRoot(), "package.json"), "utf-8");
    } catch (error) {
      return `Error: could not read package.json in the workspace: ${error.message}`;
    }

    let packageJson;
    try {
      packageJson = JSON.parse(packageJsonRaw);
    } catch (error) {
      return `Error: package.json is not valid JSON: ${error.message}`;
    }

    const availableScripts = Object.keys(packageJson.scripts ?? {});
    if (!availableScripts.includes(script)) {
      return `Error: no script named "${script}" in package.json. Available scripts: ${
        availableScripts.join(", ") || "(none)"
      }`;
    }

    const npmArgs = ["run", script];
    if (args && args.length > 0) npmArgs.push("--", ...args);
    return runNpm(npmArgs);
  },
  {
    name: "npm_run_script",
    description:
      "Run a script already defined in package.json's \"scripts\" field (e.g. test, build, lint, typecheck). Rejects any script name not declared there — cannot run arbitrary commands.",
    schema: z.object({
      script: z
        .string()
        .min(1)
        .describe("Name of the script to run, must exist in package.json's scripts field"),
      args: z
        .array(z.string())
        .optional()
        .describe("Extra arguments to pass through to the script"),
    }),
  },
);

export const npmTools = [npmInstall, npmRunScript];
