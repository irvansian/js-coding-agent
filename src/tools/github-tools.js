import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getWorkspaceRoot } from "../config/workspace.js";

const execFileAsync = promisify(execFile);

async function getRemoteOwnerAndRepo() {
  const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
    cwd: getWorkspaceRoot(),
  });
  const url = stdout.trim();
  // Matches both "https://github.com/owner/repo.git" and "git@github.com:owner/repo.git"
  const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/);
  if (!match) {
    throw new Error(`Could not parse a GitHub owner/repo from origin remote URL: ${url}`);
  }
  return { owner: match[1], repo: match[2] };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "coding-agent",
  };
}

const createPullRequest = tool(
  async ({ title, body, head, base }) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return "Error: GITHUB_TOKEN is not set. Add a GitHub personal access token to .env to create pull requests.";
    }

    let owner;
    let repo;
    try {
      ({ owner, repo } = await getRemoteOwnerAndRepo());
    } catch (error) {
      return `Error: ${error.message}`;
    }

    const headers = githubHeaders(token);

    let baseBranch = base;
    if (!baseBranch) {
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoResponse.ok) {
        return `Error fetching repository info: ${repoResponse.status} ${await repoResponse.text()}`;
      }
      baseBranch = (await repoResponse.json()).default_branch;
    }

    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, body: body ?? "", head, base: baseBranch }),
    });

    const data = await prResponse.json();
    if (!prResponse.ok) {
      return `Error creating pull request: ${prResponse.status} ${data.message ?? JSON.stringify(data)}`;
    }

    return `Pull request created: ${data.html_url}`;
  },
  {
    name: "create_pull_request",
    description:
      "Create a GitHub pull request on the workspace's 'origin' repository. The head branch must already be pushed to origin (use git_push first). Requires GITHUB_TOKEN.",
    schema: z.object({
      title: z.string().min(1).describe("Pull request title"),
      body: z.string().optional().describe("Pull request description"),
      head: z
        .string()
        .min(1)
        .describe("Branch containing the changes, already pushed to origin"),
      base: z
        .string()
        .optional()
        .describe("Branch to merge into. Defaults to the repository's default branch."),
    }),
  },
);

export const githubTools = [createPullRequest];
