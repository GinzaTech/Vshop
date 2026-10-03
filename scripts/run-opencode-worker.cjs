/* eslint-env node */

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const policy = require("./lib/opencode-worker-policy.cjs");
const runtime = require("./lib/opencode-worker-runtime.cjs");

const MAX_TASK_PACKET_BYTES = 1024 * 1024;
const FORBIDDEN_ARTIFACT = /(?:^|\/)(?:android|ios|dist|out|coverage)(?:\/|$)|(?:^|\/)\.env(?:\..*)?$|\.(?:apk|aab|log|jks|keystore|p8|p12|key|mobileprovision)$/i;
const AUTH_FAILURE = /api key|credential|unauthorized|authentication|not authenticated/i;
const SAFE_ENVIRONMENT_KEYS = new Set([
  "APPDATA",
  "CI",
  "COLORTERM",
  "COMSPEC",
  "FORCE_COLOR",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "NO_COLOR",
  "NUMBER_OF_PROCESSORS",
  "PATH",
  "PATHEXT",
  "PNPM_HOME",
  "PROCESSOR_ARCHITECTURE",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "USERPROFILE",
  "WINDIR",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
]);

class RunnerError extends Error {
  constructor(code) {
    super(code);
    this.name = "RunnerError";
    this.code = code;
  }
}

const stripAnsi = (value) => String(value).replace(/\u001b\[[0-9;]*m/g, "");

const parseExactModels = (value) => stripAnsi(value)
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(line));

function parseArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new RunnerError(policy.RESULT_STATUS.INVALID_TASK_PACKET);
  }
  const dryRunCount = argv.filter((value) => value === "--dry-run").length;
  const filtered = argv.filter((value) => value !== "--dry-run");
  if (
    dryRunCount > 1 ||
    filtered.length !== 2 ||
    filtered[0] !== "--task-file" ||
    !path.isAbsolute(filtered[1])
  ) {
    throw new RunnerError(policy.RESULT_STATUS.INVALID_TASK_PACKET);
  }
  return Object.freeze({ taskFile: path.resolve(filtered[1]), dryRun: dryRunCount === 1 });
}

function loadTaskFile(taskFile) {
  try {
    const stat = fs.statSync(taskFile);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_TASK_PACKET_BYTES) {
      throw new RunnerError(policy.RESULT_STATUS.INVALID_TASK_PACKET);
    }
    return JSON.parse(fs.readFileSync(taskFile, "utf8"));
  } catch (error) {
    if (error instanceof RunnerError) {
      throw error;
    }
    throw new RunnerError(policy.RESULT_STATUS.INVALID_TASK_PACKET);
  }
}

function resolveOpenCodeCommand({
  platform = process.platform,
  env = process.env,
  existsImpl = fs.existsSync,
  readFileImpl = fs.readFileSync,
} = {}) {
  if (platform !== "win32") {
    return "opencode";
  }
  if (!env.PNPM_HOME || !path.win32.isAbsolute(env.PNPM_HOME)) {
    throw new RunnerError("OPENCODE_BINARY_REJECTED");
  }
  const pnpmHome = path.win32.resolve(env.PNPM_HOME);
  const shimPath = path.win32.join(pnpmHome, "bin", "opencode.cmd");
  if (!existsImpl(shimPath)) {
    throw new RunnerError("OPENCODE_BINARY_REJECTED");
  }
  const shim = String(readFileImpl(shimPath, "utf8"));
  if (shim.length > 4_096) {
    throw new RunnerError("OPENCODE_BINARY_REJECTED");
  }
  const targetMatch = /^@"%~dp0\\([^"\r\n]+\\opencode\.exe)"\s+%\*\s*$/mi.exec(shim);
  if (!targetMatch) {
    throw new RunnerError("OPENCODE_BINARY_REJECTED");
  }
  const executable = path.win32.resolve(path.win32.dirname(shimPath), targetMatch[1]);
  const relative = path.win32.relative(pnpmHome, executable);
  const requiredSuffix = path.win32.join(
    "node_modules",
    "opencode-ai",
    "bin",
    "opencode.exe",
  ).toLowerCase();
  const globalRelative = path.win32.relative(path.win32.join(pnpmHome, "global"), executable);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.win32.sep}`) ||
    path.win32.isAbsolute(relative) ||
    globalRelative === ".." ||
    globalRelative.startsWith(`..${path.win32.sep}`) ||
    path.win32.isAbsolute(globalRelative) ||
    !executable.toLowerCase().endsWith(requiredSuffix) ||
    path.win32.extname(executable).toLowerCase() !== ".exe" ||
    !existsImpl(executable)
  ) {
    throw new RunnerError("OPENCODE_BINARY_REJECTED");
  }
  return executable;
}

function probeOpenCode({ command, execFileSyncImpl = execFileSync }) {
  const options = {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
    timeout: 120_000,
  };
  return Object.freeze({
    version: String(execFileSyncImpl(command, ["--version"], options)).trim(),
    authSummary: String(execFileSyncImpl(command, ["auth", "list"], options)).trim(),
    models: Object.freeze(parseExactModels(String(execFileSyncImpl(
      command,
      ["models", "--refresh"],
      options,
    )))),
  });
}

const createRunId = () => `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;

function buildWorkerEnvironment(baseEnv, permission) {
  const workerEnv = {};
  for (const [key, value] of Object.entries(baseEnv || {})) {
    if (SAFE_ENVIRONMENT_KEYS.has(key.toUpperCase()) && typeof value === "string") {
      workerEnv[key] = value;
    }
  }
  workerEnv.OPENCODE_PERMISSION = JSON.stringify(permission);
  return workerEnv;
}

const sanitizeObject = (value) => {
  try {
    return JSON.parse(policy.redactEvidence(value));
  } catch {
    return { status: policy.RESULT_STATUS.WORKER_FAILED, evidence: "<redaction-failed>" };
  }
};

const sanitizeProcessResult = (processResult) => processResult
  ? {
      code: processResult.code,
      signal: processResult.signal,
      timedOut: processResult.timedOut,
      outputTruncated: processResult.outputTruncated,
      stdout: policy.redactEvidence(processResult.stdout),
      stderr: policy.redactEvidence(processResult.stderr),
    }
  : undefined;

async function executeValidatedTask(task, dependencies = {}) {
  const deps = {
    projectRoot: path.resolve(__dirname, ".."),
    env: process.env,
    dryRun: false,
    resolveOpenCodeCommandImpl: resolveOpenCodeCommand,
    resolvePrimaryWorktreeImpl: runtime.resolvePrimaryWorktree,
    inspectWorktreeImpl: runtime.inspectWorktree,
    assertScopesInsideWorktreeImpl: runtime.assertScopesInsideWorktree,
    planExistsImpl: fs.existsSync,
    probeOpenCodeImpl: probeOpenCode,
    runProcessImpl: runtime.runProcess,
    waitForStableWriteImpl: runtime.waitForStableWrite,
    listChangedPathsImpl: runtime.listChangedPaths,
    runGitDiffCheckImpl: runtime.runGitDiffCheck,
    createEvidenceStoreImpl: runtime.createEvidenceStore,
    runIdImpl: createRunId,
    ...dependencies,
  };

  const openCodeCommand = deps.openCodeCommand || deps.resolveOpenCodeCommandImpl({
    env: deps.env,
  });

  const mainCheckout = deps.resolvePrimaryWorktreeImpl(deps.projectRoot);
  const worktree = deps.inspectWorktreeImpl(task.workspace, { mainCheckout });
  const planPath = path.join(worktree.root, task.planPath);
  if (!deps.planExistsImpl(planPath)) {
    throw new RunnerError(policy.RESULT_STATUS.INVALID_TASK_PACKET);
  }
  deps.assertScopesInsideWorktreeImpl(worktree.root, [
    { base: task.planPath, directory: false },
    ...task.allowedPaths,
    ...task.protectedPaths,
  ]);

  const evidenceStore = deps.createEvidenceStoreImpl({
    env: deps.env,
    taskId: task.taskId,
    runId: deps.runIdImpl(),
  });
  const probe = deps.probeOpenCodeImpl({ command: openCodeCommand });

  const finish = (status, details = {}) => {
    const safeResult = sanitizeObject({
      status,
      evidencePath: evidenceStore.root,
      probe: {
        version: probe.version,
        authSummary: probe.authSummary,
        models: probe.models,
      },
      ...details,
    });
    evidenceStore.writeJson("result.json", safeResult);
    return Object.freeze(safeResult);
  };

  if (!probe.models.includes(task.model)) {
    return finish(policy.RESULT_STATUS.MODEL_NOT_AVAILABLE);
  }

  const workerArgs = [
    "run",
    "--dir",
    worktree.root,
    "--model",
    task.model,
    "--agent",
    "codex-worker",
    "--format",
    "json",
    "--title",
    task.taskId,
    "--auto",
    policy.buildWorkerPrompt(task),
  ];
  if (deps.dryRun) {
    return finish(policy.RESULT_STATUS.PASS_TO_REVIEW, {
      dryRun: true,
      command: openCodeCommand,
      args: workerArgs,
    });
  }

  const processResult = await deps.runProcessImpl({
    command: openCodeCommand,
    args: workerArgs,
    cwd: worktree.root,
    env: buildWorkerEnvironment(deps.env, policy.buildPermissionPolicy(task)),
    timeoutMs: task.timeoutMinutes * 60_000,
  });
  const safeProcess = sanitizeProcessResult(processResult);
  if (processResult.timedOut) {
    return finish(policy.RESULT_STATUS.TIMEOUT, { process: safeProcess });
  }
  if (processResult.code !== 0) {
    const combinedOutput = `${processResult.stdout}\n${processResult.stderr}`;
    const status = AUTH_FAILURE.test(combinedOutput)
      ? policy.RESULT_STATUS.PROVIDER_AUTH_REQUIRED
      : policy.RESULT_STATUS.WORKER_FAILED;
    return finish(status, { process: safeProcess });
  }

  const stable = await deps.waitForStableWriteImpl({ workspace: worktree.root });
  if (!stable.stable) {
    return finish(policy.RESULT_STATUS.WRITE_WINDOW_UNSTABLE, {
      process: safeProcess,
      stable,
    });
  }

  const changedPaths = deps.listChangedPathsImpl(worktree.root);
  if (changedPaths.length === 0) {
    return finish(policy.RESULT_STATUS.NO_CHANGES, { process: safeProcess, stable });
  }
  if (changedPaths.some((relativePath) => FORBIDDEN_ARTIFACT.test(relativePath))) {
    return finish(policy.RESULT_STATUS.SCOPE_VIOLATION, {
      process: safeProcess,
      stable,
      changedPaths,
    });
  }

  const scope = policy.classifyChangedPaths(changedPaths, task);
  if (scope.violations.length > 0) {
    return finish(policy.RESULT_STATUS.SCOPE_VIOLATION, {
      process: safeProcess,
      stable,
      changedPaths,
      scope,
    });
  }

  deps.runGitDiffCheckImpl(worktree.root);
  return finish(policy.RESULT_STATUS.PASS_TO_REVIEW, {
    process: safeProcess,
    stable,
    changedPaths,
    scope,
  });
}

const statusForError = (error) => {
  if (error instanceof policy.WorkerPolicyError || error instanceof SyntaxError) {
    return policy.RESULT_STATUS.INVALID_TASK_PACKET;
  }
  if (error instanceof RunnerError && Object.values(policy.RESULT_STATUS).includes(error.code)) {
    return error.code;
  }
  if (Object.values(policy.RESULT_STATUS).includes(error?.message)) {
    return error.message;
  }
  if (error?.code === "EACCES" || error?.code === "EPERM") {
    return policy.RESULT_STATUS.PERMISSION_DENIED;
  }
  return policy.RESULT_STATUS.WORKER_FAILED;
};

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout || process.stdout;
  const stderr = dependencies.stderr || process.stderr;
  try {
    const parsed = parseArgs(argv);
    const projectRoot = dependencies.projectRoot || path.resolve(__dirname, "..");
    const resolvePrimary = dependencies.resolvePrimaryWorktreeImpl || runtime.resolvePrimaryWorktree;
    const mainCheckout = resolvePrimary(projectRoot);
    const loadTaskFileImpl = dependencies.loadTaskFileImpl || loadTaskFile;
    const validateTaskPacketImpl = dependencies.validateTaskPacketImpl || policy.validateTaskPacket;
    const task = validateTaskPacketImpl(loadTaskFileImpl(parsed.taskFile), { mainCheckout });
    const result = await executeValidatedTask(task, {
      ...dependencies,
      projectRoot,
      dryRun: parsed.dryRun,
      resolvePrimaryWorktreeImpl: resolvePrimary,
    });
    stdout.write(`OPENCODE_WORKER_STATUS=${result.status}\n`);
    if (result.evidencePath) {
      stdout.write(`OPENCODE_WORKER_EVIDENCE=${result.evidencePath}\n`);
    }
    return result.status === policy.RESULT_STATUS.PASS_TO_REVIEW ? 0 : 1;
  } catch (error) {
    const status = statusForError(error);
    stderr.write(`OPENCODE_WORKER_STATUS=${status}\n`);
    return 1;
  }
}

if (require.main === module) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = {
  buildWorkerEnvironment,
  RunnerError,
  executeValidatedTask,
  loadTaskFile,
  main,
  parseArgs,
  parseExactModels,
  probeOpenCode,
  resolveOpenCodeCommand,
};
