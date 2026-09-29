/* eslint-env node */

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFile, execFileSync, spawn } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const EVIDENCE_ID = /^[a-z0-9](?:[a-z0-9-]{0,79})$/;
const EVIDENCE_FILE = /^[a-z0-9][a-z0-9.-]*\.json$/i;

const normalizeGitPath = (value) => value.replace(/\\/g, "/");
const parseNulPaths = (value) => String(value)
  .split("\0")
  .filter(Boolean)
  .map(normalizeGitPath);

const runGit = (workspace, args, execFileSyncImpl = execFileSync) => String(execFileSyncImpl(
  "git",
  ["-C", workspace, ...args],
  { encoding: "utf8", windowsHide: true },
));

const resolveReportedPath = (root, value) => path.isAbsolute(value)
  ? path.resolve(value)
  : path.resolve(root, value);

function inspectWorktree(workspace, {
  mainCheckout,
  execFileSyncImpl = execFileSync,
} = {}) {
  if (typeof workspace !== "string" || !path.isAbsolute(workspace)) {
    throw new Error("WORKTREE_PATH_REJECTED");
  }
  if (typeof mainCheckout !== "string" || !path.isAbsolute(mainCheckout)) {
    throw new Error("MAIN_CHECKOUT_REJECTED");
  }

  const root = path.resolve(runGit(
    workspace,
    ["rev-parse", "--show-toplevel"],
    execFileSyncImpl,
  ).trim());
  if (root.toLowerCase() === path.resolve(mainCheckout).toLowerCase()) {
    throw new Error("MAIN_CHECKOUT_REJECTED");
  }

  const gitDir = resolveReportedPath(root, runGit(
    root,
    ["rev-parse", "--git-dir"],
    execFileSyncImpl,
  ).trim());
  const commonDir = resolveReportedPath(root, runGit(
    root,
    ["rev-parse", "--git-common-dir"],
    execFileSyncImpl,
  ).trim());
  if (gitDir.toLowerCase() === commonDir.toLowerCase()) {
    throw new Error("LINKED_WORKTREE_REQUIRED");
  }

  const status = runGit(
    root,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    execFileSyncImpl,
  );
  if (status) {
    throw new Error("DIRTY_BASELINE");
  }

  return Object.freeze({
    root,
    gitDir,
    commonDir,
    clean: true,
    linked: true,
  });
}

function assertScopesInsideWorktree(workspace, scopes, {
  existsImpl = fs.existsSync,
  realpathImpl = fs.realpathSync.native,
} = {}) {
  if (!Array.isArray(scopes)) {
    throw new Error("SCOPE_REALPATH_REJECTED");
  }
  const workspaceRoot = path.resolve(workspace);
  const rootReal = path.resolve(realpathImpl(workspaceRoot));
  for (const scope of scopes) {
    if (!scope || typeof scope.base !== "string") {
      throw new Error("SCOPE_REALPATH_REJECTED");
    }
    let candidate = path.resolve(workspaceRoot, scope.base);
    const lexicalRelative = path.relative(workspaceRoot, candidate);
    if (
      lexicalRelative === ".." ||
      lexicalRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(lexicalRelative)
    ) {
      throw new Error("SCOPE_REALPATH_ESCAPE");
    }
    while (!existsImpl(candidate) && candidate !== workspaceRoot) {
      candidate = path.dirname(candidate);
    }
    if (!existsImpl(candidate)) {
      throw new Error("SCOPE_REALPATH_REJECTED");
    }
    const candidateReal = path.resolve(realpathImpl(candidate));
    const realRelative = path.relative(rootReal, candidateReal);
    if (
      realRelative === ".." ||
      realRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(realRelative)
    ) {
      throw new Error("SCOPE_REALPATH_ESCAPE");
    }
  }
}

function listChangedPaths(workspace, { execFileSyncImpl = execFileSync } = {}) {
  const sources = [
    ["diff", "--name-only", "-z", "HEAD"],
    ["diff", "--cached", "--name-only", "-z", "HEAD"],
    ["ls-files", "--others", "--exclude-standard", "-z"],
  ];
  return [...new Set(sources.flatMap((args) =>
    parseNulPaths(runGit(workspace, args, execFileSyncImpl))))].sort();
}

function resolvePrimaryWorktree(workspace, { execFileSyncImpl = execFileSync } = {}) {
  const output = String(execFileSyncImpl(
    "git",
    ["-C", workspace, "worktree", "list", "--porcelain"],
    { encoding: "utf8", windowsHide: true },
  ));
  const firstWorktree = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("worktree "));
  if (!firstWorktree) {
    throw new Error("PRIMARY_WORKTREE_NOT_FOUND");
  }
  return path.resolve(firstWorktree.slice("worktree ".length));
}

async function fingerprintWorkspace(workspace, {
  listChangedPathsImpl = listChangedPaths,
  existsImpl = fs.existsSync,
  readFileImpl = fs.readFileSync,
  execFileSyncImpl = execFileSync,
} = {}) {
  const changedPaths = await listChangedPathsImpl(workspace, { execFileSyncImpl });
  const hash = crypto.createHash("sha256");
  for (const relativePath of [...changedPaths].sort()) {
    const absolutePath = path.join(workspace, relativePath);
    hash.update(relativePath);
    if (!existsImpl(absolutePath)) {
      hash.update("<deleted>");
      continue;
    }
    hash.update(readFileImpl(absolutePath));
  }
  return hash.digest("hex");
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForStableWrite({
  workspace,
  stableMs = 10_000,
  maxWaitMs = 60_000,
  pollMs = 1_000,
  fingerprintImpl = fingerprintWorkspace,
  nowImpl = Date.now,
  delayImpl = delay,
}) {
  const startedAt = nowImpl();
  let last = await fingerprintImpl(workspace);
  let stableSince = startedAt;

  while (nowImpl() - startedAt <= maxWaitMs) {
    await delayImpl(pollMs);
    const current = await fingerprintImpl(workspace);
    if (current !== last) {
      last = current;
      stableSince = nowImpl();
    }
    if (nowImpl() - stableSince >= stableMs) {
      return Object.freeze({ stable: true, fingerprint: current });
    }
  }
  return Object.freeze({ stable: false, fingerprint: last });
}

async function terminateProcessTree(child, {
  platform = process.platform,
  execFileAsyncImpl = execFileAsync,
} = {}) {
  if (!child || !Number.isInteger(child.pid) || child.pid <= 0) {
    return;
  }
  if (platform === "win32") {
    await execFileAsyncImpl(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true },
    ).catch(() => undefined);
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

const createBoundedCollector = (maxBytes) => {
  const chunks = [];
  let length = 0;
  let truncated = false;
  return {
    append(chunk) {
      const buffer = Buffer.from(chunk);
      const remaining = Math.max(0, maxBytes - length);
      if (remaining > 0) {
        const accepted = buffer.subarray(0, remaining);
        chunks.push(accepted);
        length += accepted.length;
      }
      if (buffer.length > remaining) {
        truncated = true;
      }
    },
    text: () => Buffer.concat(chunks).toString("utf8"),
    truncated: () => truncated,
  };
};

function runProcess({
  command,
  args,
  cwd,
  env,
  timeoutMs,
  terminationGraceMs = 5_000,
  maxOutputBytes = 10 * 1024 * 1024,
  platform = process.platform,
  spawnImpl = spawn,
  terminateImpl = terminateProcessTree,
}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      detached: platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = createBoundedCollector(maxOutputBytes);
    const stderr = createBoundedCollector(maxOutputBytes);
    let settled = false;
    let timedOut = false;
    let terminationTimer;

    child.stdout.on("data", (chunk) => stdout.append(chunk));
    child.stderr.on("data", (chunk) => stderr.append(chunk));

    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(terminationTimer);
      resolve(Object.freeze({
        code: Number.isInteger(code) ? code : 1,
        signal,
        timedOut,
        stdout: stdout.text(),
        stderr: stderr.text(),
        outputTruncated: stdout.truncated() || stderr.truncated(),
      }));
    };

    const timer = setTimeout(() => {
      timedOut = true;
      void Promise.resolve(terminateImpl(child)).catch(() => undefined);
      terminationTimer = setTimeout(() => {
        child.stdout.destroy?.();
        child.stderr.destroy?.();
        child.unref?.();
        finish(1, "TERMINATION_UNCONFIRMED");
      }, terminationGraceMs);
    }, timeoutMs);

    child.once("error", (error) => {
      if (settled) return;
      if (timedOut) {
        finish(1, "TERMINATION_ERROR");
      } else {
        settled = true;
        clearTimeout(timer);
        clearTimeout(terminationTimer);
        reject(error);
      }
    });
    child.once("exit", (code, signal) => {
      finish(code, signal);
    });
  });
}

function createEvidenceStore({ env = process.env, taskId, runId }) {
  if (!env.LOCALAPPDATA || !path.isAbsolute(env.LOCALAPPDATA)) {
    throw new Error("EVIDENCE_ROOT_UNAVAILABLE");
  }
  if (!EVIDENCE_ID.test(taskId) || !EVIDENCE_ID.test(runId)) {
    throw new Error("EVIDENCE_ID_REJECTED");
  }
  const root = path.join(
    path.resolve(env.LOCALAPPDATA),
    "CodexOpenCode",
    "Vshop",
    "runs",
    `${taskId}-${runId}`,
  );
  fs.mkdirSync(root, { recursive: true });
  return Object.freeze({
    root,
    writeJson(name, value) {
      if (typeof name !== "string" || !EVIDENCE_FILE.test(name) || path.basename(name) !== name) {
        throw new Error("EVIDENCE_FILE_REJECTED");
      }
      fs.writeFileSync(
        path.join(root, name),
        `${JSON.stringify(value, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
    },
  });
}

function runGitDiffCheck(workspace, { execFileSyncImpl = execFileSync } = {}) {
  runGit(workspace, ["diff", "--check"], execFileSyncImpl);
}

module.exports = {
  assertScopesInsideWorktree,
  createEvidenceStore,
  fingerprintWorkspace,
  inspectWorktree,
  listChangedPaths,
  resolvePrimaryWorktree,
  runGitDiffCheck,
  runProcess,
  terminateProcessTree,
  waitForStableWrite,
};
