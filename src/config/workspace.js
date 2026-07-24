import path from "node:path";

const workspaceRoot = path.resolve(process.env.WORKSPACE_DIR ?? process.cwd());

export function getWorkspaceRoot() {
  return workspaceRoot;
}

/**
 * Resolve a relative path against the workspace root, rejecting any path
 * that would escape it (e.g. "../../etc/passwd", absolute paths outside the
 * root, or traversal via symlink-free ".." segments).
 */
export function resolveWorkspacePath(relativePath) {
  const resolved = path.resolve(workspaceRoot, relativePath ?? ".");
  const rootWithSep = workspaceRoot.endsWith(path.sep) ? workspaceRoot : workspaceRoot + path.sep;

  if (resolved !== workspaceRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Path "${relativePath}" resolves outside the workspace directory`);
  }

  return resolved;
}
