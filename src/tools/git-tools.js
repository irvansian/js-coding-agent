import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getWorkspaceRoot } from "../config/workspace.js";

const execFileAsync = promisify(execFile);

// Never put the token in argv or in the remote URL — both can end up echoed
// back in an error string. Injecting it via GIT_CONFIG_* env vars keeps it
// out of the process's command line and out of the on-disk git config.
function buildGitEnv({ withAuth } = {}) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const token = process.env.GITHUB_TOKEN;
  if (withAuth && token) {
    const basicAuth = Buffer.from(`x-access-token:${token}`).toString("base64");
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.extraheader";
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basicAuth}`;
  }
  return env;
}

async function runGit(args, { withAuth = false } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: getWorkspaceRoot(),
      env: buildGitEnv({ withAuth }),
    });
    return stdout.trim() || stderr.trim() || "(no output)";
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
    return `Error running git ${args.join(" ")}: ${detail}`;
  }
}

const gitStatus = tool(
  async () => runGit(["status", "--short", "--branch"]),
  {
    name: "git_status",
    description: "Show the working tree status: staged, unstaged, and untracked changes.",
    schema: z.object({}),
  },
);

const gitDiff = tool(
  async ({ filePath, staged }) => {
    const args = ["diff"];
    if (staged) args.push("--staged");
    if (filePath) args.push("--", filePath);
    return runGit(args);
  },
  {
    name: "git_diff",
    description: "Show changes in the working tree or staging area. Optionally scope the diff to one file.",
    schema: z.object({
      filePath: z
        .string()
        .optional()
        .describe("Limit the diff to this file, relative to the project root"),
      staged: z
        .boolean()
        .optional()
        .describe("Show staged (index) changes instead of unstaged working tree changes"),
    }),
  },
);

const gitLog = tool(
  async ({ count }) => runGit(["log", "--oneline", "-n", String(count ?? 10)]),
  {
    name: "git_log",
    description: "Show recent commit history, one line per commit.",
    schema: z.object({
      count: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Number of commits to show. Defaults to 10."),
    }),
  },
);

const gitAdd = tool(
  async ({ filePaths }) => runGit(["add", "--", ...filePaths]),
  {
    name: "git_add",
    description: "Stage one or more files for commit.",
    schema: z.object({
      filePaths: z
        .array(z.string())
        .min(1)
        .describe("Paths to stage, relative to the project root"),
    }),
  },
);

const gitCommit = tool(
  async ({ message }) => runGit(["commit", "-m", message]),
  {
    name: "git_commit",
    description:
      "Commit currently staged changes with the given message. Use git_add first to stage files.",
    schema: z.object({
      message: z.string().min(1).describe("Commit message"),
    }),
  },
);

const gitClone = tool(
  async ({ repoUrl, branch }) => {
    const args = ["clone"];
    if (branch) args.push("--branch", branch);
    args.push(repoUrl, ".");
    return runGit(args, { withAuth: true });
  },
  {
    name: "git_clone",
    description:
      "Clone a remote git repository directly into the workspace root, so all other git/file tools operate on it. The workspace must be empty.",
    schema: z.object({
      repoUrl: z.string().describe("URL of the remote repository to clone (https or ssh)"),
      branch: z.string().optional().describe("Branch or tag to check out after cloning"),
    }),
  },
);

const gitCreateBranch = tool(
  async ({ branchName }) => runGit(["checkout", "-b", branchName]),
  {
    name: "git_create_branch",
    description:
      "Create a new branch from the current HEAD and switch to it. Do this before committing changes that should become a pull request.",
    schema: z.object({
      branchName: z.string().min(1).describe("Name of the new branch to create and check out"),
    }),
  },
);

const gitPush = tool(
  async ({ branch }) => runGit(["push", "--set-upstream", "origin", branch || "HEAD"], { withAuth: true }),
  {
    name: "git_push",
    description:
      "Push the current (or specified) branch to the 'origin' remote, setting up tracking. Requires GITHUB_TOKEN to be set in the environment.",
    schema: z.object({
      branch: z
        .string()
        .optional()
        .describe("Branch to push. Defaults to the currently checked-out branch."),
    }),
  },
);

const gitPull = tool(
  async ({ branch }) => {
    const args = ["pull"];
    if (branch) args.push("origin", branch);
    return runGit(args, { withAuth: true });
  },
  {
    name: "git_pull",
    description:
      "Pull the latest changes from 'origin' into the current branch. With no branch given, uses the current branch's tracking info (set automatically by git_clone/git_push).",
    schema: z.object({
      branch: z
        .string()
        .optional()
        .describe("Remote branch to pull from origin. Defaults to the current branch's tracked upstream."),
    }),
  },
);

export const gitTools = [
  gitStatus,
  gitDiff,
  gitLog,
  gitAdd,
  gitCommit,
  gitClone,
  gitCreateBranch,
  gitPush,
  gitPull,
];
