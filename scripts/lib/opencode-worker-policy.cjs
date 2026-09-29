/* eslint-env node */

"use strict";

const path = require("node:path");

const RESULT_STATUS = Object.freeze({
  PASS_TO_REVIEW: "PASS_TO_REVIEW",
  MODEL_NOT_AVAILABLE: "MODEL_NOT_AVAILABLE",
  PROVIDER_AUTH_REQUIRED: "PROVIDER_AUTH_REQUIRED",
  INVALID_TASK_PACKET: "INVALID_TASK_PACKET",
  DIRTY_BASELINE: "DIRTY_BASELINE",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  TIMEOUT: "TIMEOUT",
  WRITE_WINDOW_UNSTABLE: "WRITE_WINDOW_UNSTABLE",
  SCOPE_VIOLATION: "SCOPE_VIOLATION",
  NO_CHANGES: "NO_CHANGES",
  WORKER_FAILED: "WORKER_FAILED",
});

const TASK_PACKET_KEYS = new Set([
  "schemaVersion",
  "taskId",
  "title",
  "objective",
  "workspace",
  "model",
  "planPath",
  "allowedPaths",
  "protectedPaths",
  "acceptanceCriteria",
  "targetedCommands",
  "timeoutMinutes",
  "maxRepairRounds",
]);
const COMMAND_KEYS = new Set(["executable", "args"]);
const SAFE_RUN_SCRIPTS = new Set([
  "test",
  "test:ci",
  "typecheck",
  "lint",
  "check:source",
  "check:android",
  "check",
  "audit:prod",
  "check:export-budget",
]);
const SAFE_EXEC_TOOLS = new Set(["jest", "eslint", "tsc"]);
const SHELL_META = /[;&|><`\r\n]/;
const DRIVE_OR_UNC = /^(?:[a-z]:|\/\/)/i;
const SENSITIVE_PATH = /(?:^|\/)\.env(?:\..*)?$|\.(?:jks|keystore|p8|p12|key|mobileprovision)$|(?:^|\/)credentials\.json$/i;

class WorkerPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "WorkerPolicyError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new WorkerPolicyError(code);
};

const isPlainObject = (value) => value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const assertExactKeys = (value, keys, code) => {
  if (!isPlainObject(value) || Object.keys(value).some((key) => !keys.has(key))) {
    fail(code);
  }
  return value;
};

const assertText = (value, code, maxLength = 4_000) => {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    fail(code);
  }
  return value.trim();
};

function normalizeScopePattern(value) {
  const raw = assertText(value, "PATH_REJECTED", 500);
  if (raw.includes("\\") || DRIVE_OR_UNC.test(raw) || path.posix.isAbsolute(raw)) {
    fail("PATH_REJECTED");
  }
  const directory = raw.endsWith("/**");
  const base = directory ? raw.slice(0, -3) : raw;
  const segments = base.split("/");
  if (
    !base ||
    base.includes("*") ||
    SENSITIVE_PATH.test(base) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    fail("PATH_REJECTED");
  }
  return Object.freeze({
    pattern: directory ? `${base}/**` : base,
    base,
    directory,
  });
}

const scopeCovers = (left, right) => left.directory
  ? right.base === left.base || right.base.startsWith(`${left.base}/`)
  : right.base === left.base;

function validateTargetedCommand(value) {
  const command = assertExactKeys(value, COMMAND_KEYS, "COMMAND_REJECTED");
  if (command.executable !== "pnpm" || !Array.isArray(command.args) || command.args.length < 2) {
    fail("COMMAND_REJECTED");
  }
  const args = command.args.map((argument) => assertText(argument, "COMMAND_REJECTED", 300));
  if (args.some((argument) => /\s/.test(argument) || SHELL_META.test(argument))) {
    fail("COMMAND_REJECTED");
  }

  const safeRun = args[0] === "run" &&
    args.length === 2 &&
    SAFE_RUN_SCRIPTS.has(args[1]);
  const safeJest = args[0] === "exec" && args[1] === "jest" && args.length >= 3;
  const safeEslint = args[0] === "exec" && args[1] === "eslint" && args.length >= 3;
  const safeTsc = args[0] === "exec" &&
    args[1] === "tsc" &&
    args.length === 3 &&
    args[2] === "--noEmit";
  if (!safeRun && !safeJest && !safeEslint && !safeTsc) {
    fail("COMMAND_REJECTED");
  }
  if (!SAFE_EXEC_TOOLS.has(args[1]) && args[0] === "exec") {
    fail("COMMAND_REJECTED");
  }
  return Object.freeze({
    executable: "pnpm",
    args: Object.freeze(args),
  });
}

function validateTaskPacket(input, { mainCheckout } = {}) {
  const value = assertExactKeys(input, TASK_PACKET_KEYS, "TASK_PACKET_REJECTED");
  if (value.schemaVersion !== 1) {
    fail("SCHEMA_VERSION_REJECTED");
  }
  if (typeof mainCheckout !== "string" || !path.isAbsolute(mainCheckout)) {
    fail("MAIN_CHECKOUT_REJECTED");
  }

  const rawWorkspace = assertText(value.workspace, "WORKSPACE_REJECTED", 1_000);
  if (!path.isAbsolute(rawWorkspace)) {
    fail("WORKSPACE_REJECTED");
  }
  const workspace = path.resolve(rawWorkspace);
  if (workspace.toLowerCase() === path.resolve(mainCheckout).toLowerCase()) {
    fail("MAIN_CHECKOUT_REJECTED");
  }

  const model = assertText(value.model, "MODEL_REJECTED", 200);
  if (!/^[a-z0-9._-]+\/glm-5\.3$/i.test(model)) {
    fail("MODEL_REJECTED");
  }

  if (!Array.isArray(value.allowedPaths) || value.allowedPaths.length === 0) {
    fail("ALLOWED_PATHS_REQUIRED");
  }
  if (!Array.isArray(value.protectedPaths)) {
    fail("PROTECTED_PATHS_REJECTED");
  }
  const allowedPaths = Object.freeze(value.allowedPaths.map(normalizeScopePattern));
  const protectedPaths = Object.freeze(value.protectedPaths.map(normalizeScopePattern));
  if (allowedPaths.some((allowed) => protectedPaths.some((blocked) =>
    scopeCovers(allowed, blocked) || scopeCovers(blocked, allowed)))) {
    fail("SCOPE_OVERLAP");
  }

  if (!Array.isArray(value.acceptanceCriteria) || value.acceptanceCriteria.length === 0) {
    fail("ACCEPTANCE_REJECTED");
  }
  const acceptanceCriteria = Object.freeze(value.acceptanceCriteria.map((criterion) =>
    assertText(criterion, "ACCEPTANCE_REJECTED", 1_000)));

  if (!Array.isArray(value.targetedCommands)) {
    fail("COMMAND_REJECTED");
  }
  const targetedCommands = Object.freeze(value.targetedCommands.map(validateTargetedCommand));

  const timeoutMinutes = Number(value.timeoutMinutes);
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > 120) {
    fail("TIMEOUT_REJECTED");
  }
  const maxRepairRounds = Number(value.maxRepairRounds);
  if (!Number.isInteger(maxRepairRounds) || maxRepairRounds < 0 || maxRepairRounds > 2) {
    fail("REPAIR_ROUNDS_REJECTED");
  }

  const taskId = assertText(value.taskId, "TASK_ID_REJECTED", 80);
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(taskId)) {
    fail("TASK_ID_REJECTED");
  }
  const planScope = normalizeScopePattern(value.planPath);
  if (planScope.directory) {
    fail("PLAN_PATH_REJECTED");
  }

  return Object.freeze({
    schemaVersion: 1,
    taskId,
    title: assertText(value.title, "TITLE_REJECTED", 200),
    objective: assertText(value.objective, "OBJECTIVE_REJECTED"),
    workspace,
    model,
    planPath: planScope.base,
    allowedPaths,
    protectedPaths,
    acceptanceCriteria,
    targetedCommands,
    timeoutMinutes,
    maxRepairRounds,
  });
}

const scopeMatches = (scope, relativePath) => scope.directory
  ? relativePath === scope.base || relativePath.startsWith(`${scope.base}/`)
  : relativePath === scope.base;

function classifyChangedPaths(paths, task) {
  if (!Array.isArray(paths)) {
    fail("CHANGED_PATHS_REJECTED");
  }
  const normalized = [];
  const invalid = [];
  for (const value of paths) {
    try {
      const scope = normalizeScopePattern(value);
      if (scope.directory) {
        invalid.push(value);
      } else {
        normalized.push(scope.base);
      }
    } catch {
      invalid.push(String(value));
    }
  }
  const uniquePaths = [...new Set(normalized)].sort();
  const violations = [...new Set([
    ...invalid,
    ...uniquePaths.filter((relativePath) =>
      !task.allowedPaths.some((scope) => scopeMatches(scope, relativePath)) ||
      task.protectedPaths.some((scope) => scopeMatches(scope, relativePath))),
  ])].sort();
  return Object.freeze({
    allowed: Object.freeze(uniquePaths.filter((value) => !violations.includes(value))),
    violations: Object.freeze(violations),
  });
}

const commandResource = (command) => [command.executable, ...command.args].join(" ");

function buildPermissionPolicy(task) {
  const edit = { "*": "deny" };
  for (const scope of task.allowedPaths) {
    edit[scope.pattern] = "allow";
  }
  const bash = {
    "*": "deny",
    "git status*": "allow",
    "git diff*": "allow",
    "git log*": "allow",
    "git show*": "allow",
    "git rev-parse*": "allow",
    "rg *": "allow",
  };
  for (const command of task.targetedCommands) {
    bash[commandResource(command)] = "allow";
  }
  for (const verb of [
    "commit",
    "push",
    "reset",
    "clean",
    "checkout",
    "switch",
    "merge",
    "rebase",
    "stash",
    "tag",
  ]) {
    bash[`git ${verb}*`] = "deny";
  }
  bash["eas *"] = "deny";
  bash["pnpm exec eas *"] = "deny";

  return Object.freeze({
    read: Object.freeze({
      "*": "allow",
      ".env": "deny",
      ".env.*": "deny",
      "**/.env": "deny",
      "**/.env.*": "deny",
      "**/*.key": "deny",
      "**/*.jks": "deny",
      "**/credentials.json": "deny",
    }),
    edit: Object.freeze(edit),
    bash: Object.freeze(bash),
    external_directory: "deny",
    task: "deny",
    webfetch: "deny",
    websearch: "deny",
  });
}

function buildWorkerPrompt(task) {
  return [
    `Task ID: ${task.taskId}`,
    `Objective: ${task.objective}`,
    `Plan: ${task.planPath}`,
    "Read AGENTS.md and the plan before editing.",
    `Allowed paths: ${task.allowedPaths.map((scope) => scope.pattern).join(", ")}`,
    `Protected paths: ${task.protectedPaths.map((scope) => scope.pattern).join(", ") || "none"}`,
    "Acceptance criteria:",
    ...task.acceptanceCriteria.map((criterion, index) => `${index + 1}. ${criterion}`),
    "Run only these targeted commands:",
    ...task.targetedCommands.map(commandResource),
    "Do not commit, push, merge, release, publish, broaden scope, read credentials, or launch subagents.",
    "Finish with files changed, tests run, exact results, limitations, and NOT VERIFIED items.",
  ].join("\n");
}

function redactEvidence(value) {
  let text;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = "<unserializable-evidence>";
  }
  return String(text ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer <redacted>")
    .replace(/("(?:api[_-]?key|authorization|cookie|token|secret|password)"\s*:\s*)"[^"]*"/gi, "$1\"<redacted>\"")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "<redacted-jwt>");
}

module.exports = {
  RESULT_STATUS,
  WorkerPolicyError,
  buildPermissionPolicy,
  buildWorkerPrompt,
  classifyChangedPaths,
  normalizeScopePattern,
  redactEvidence,
  validateTargetedCommand,
  validateTaskPacket,
};
