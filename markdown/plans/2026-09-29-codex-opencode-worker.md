# Codex–OpenCode GLM Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cài OpenCode CLI và cung cấp một runner được kiểm soát để Codex giao implementation đã đóng phạm vi cho exact GLM 5.3 trong worktree riêng, sau đó Codex review toàn bộ diff và verification evidence.

**Architecture:** Policy thuần validate task packet/path/command và sinh OpenCode permission; runtime module sở hữu Git/process/stable-write/evidence side effects; runner CLI chỉ orchestration hai module này. Custom OpenCode agent không tự quyết scope, còn Codex skill giữ lifecycle plan → worktree → run → review → tối đa hai repair round.

**Tech Stack:** Node.js 22 CommonJS, Jest 29, PowerShell trên Windows, pnpm 11, OpenCode CLI 1.18.x, Git managed worktrees.

**Spec:** `markdown/plans/2026-09-29-codex-opencode-worker-design.md`

**Trạng thái:** done — native execution hoàn tất ngày 2026-09-30; exact GLM 5.3 live smoke và final gates PASS

## Global Constraints

- Dùng `pnpm` theo `packageManager: pnpm@11.24.0`; không tạo npm/yarn/bun lockfile.
- OpenCode CLI là global developer tool; không thêm vào app dependencies hoặc Expo bundle.
- CLI phải khớp version OpenCode Desktop đang cài; không tự migrate shared database/config.
- Worker chỉ chạy trong linked worktree sạch, không chạy trong `C:\Users\kona\Desktop\Project\Vshop`.
- Model phải là exact refreshed ID có final segment `glm-5.3`; thiếu model thì fail-closed, không fallback GLM 5.2.
- Task packet/evidence nằm ngoài repository; credential không được đưa vào prompt, argv, log hoặc Git.
- Worker không được commit, push, merge, rebase, checkout, reset, clean, stash, tag, release hoặc publish.
- Dynamic edit permission và post-run audit đều bắt buộc; một lớp PASS không thay thế lớp còn lại.
- Stable-write cần fingerprint không đổi liên tục 10 giây, tối đa chờ 60 giây.
- Tối đa hai repair round; `PASS_TO_REVIEW` không đồng nghĩa task hoàn tất.
- Hai file dirty ban đầu `components/ui/AppRefreshControl.web.tsx` và `components/ui/AppViewport.tsx` không được stage, sửa hoặc đưa vào commit setup.
- Mọi commit phải stage explicit path, kiểm tra `git diff --cached --name-only`, và không push.

## Review Focus

- Junction/symlink bên trong allowlist trỏ ra ngoài worktree phải bị reject trước khi worker chạy; Task 2 có injected-realpath test.
- ANSI color, whitespace hoặc alias `glm-5.3-preview` không được match exact `provider/glm-5.3`; Task 3 có parser tests.
- CLI exit nhưng process con/file writer tiếp tục sửa phải tạo `WRITE_WINDOW_UNSTABLE`; Task 2–3 có stability tests.
- Rename, delete, staged và untracked file đều phải xuất hiện trong changed-path audit; Task 2 có merged Git-output test.
- Bearer, cookie, API key và JWT sâu trong nested JSON/stdout/stderr phải bị redact trước khi ghi evidence; Task 1 và Task 3 có canary tests.

---

## File Map

| File | Trách nhiệm |
|---|---|
| `scripts/lib/opencode-worker-policy.cjs` | Task schema, path/command policy, permissions, prompt, scope classification, redaction |
| `scripts/lib/opencode-worker-runtime.cjs` | Git/worktree, realpath guard, process lifecycle, changed paths, fingerprint, evidence |
| `scripts/run-opencode-worker.cjs` | CLI args, OpenCode probe/run orchestration và status mapping |
| `jest.opencode-worker.config.js` | Isolated 80% coverage floor cho workflow modules |
| `__tests__/opencode-worker-*.test.js` | Policy, runtime, runner và static-config contracts |
| `.opencode/agents/codex-worker.md` | Worker prompt và immutable deny rules |
| `skills/codex-opencode-handoff/SKILL.md` | Canonical Codex coordinator workflow |
| `package.json` | `worker:opencode` và `test:opencode-worker` scripts |
| `README.md`, `CHANGELOG.md` | Developer boundary và local-tooling release note |

## Task 1 — Pure task-packet and permission policy

**Files:**
- Create: `scripts/lib/opencode-worker-policy.cjs`
- Create: `__tests__/opencode-worker-policy.test.js`
- Create: `jest.opencode-worker.config.js`

**Interfaces:**
- Consumes: plain JSON task packet và absolute `mainCheckout`.
- Produces: `WorkerPolicyError`, `RESULT_STATUS`, `validateTaskPacket`, `buildPermissionPolicy`, `buildWorkerPrompt`, `classifyChangedPaths`, `redactEvidence`.

- [x] **Step 1: Viết failing contract tests**

Tạo fixture và các hostile cases sau trong `__tests__/opencode-worker-policy.test.js`:

```js
/* eslint-env jest, node */
const policy = require("../scripts/lib/opencode-worker-policy.cjs");

const mainCheckout = "C:\\Users\\kona\\Desktop\\Project\\Vshop";
const packet = () => ({
  schemaVersion: 1,
  taskId: "profile-cache-race",
  title: "Fix profile cache race",
  objective: "Prevent stale responses from overwriting a newer account.",
  workspace: "C:\\Users\\kona\\.codex\\worktrees\\profile-cache-race",
  model: "zai-coding-plan/glm-5.3",
  planPath: "markdown/plans/2026-09-29-profile-cache-race.md",
  allowedPaths: ["services/profile/cache.ts", "__tests__/profile-cache.test.ts"],
  protectedPaths: ["services/profile/credentials.ts"],
  acceptanceCriteria: ["Stale responses cannot overwrite the active account."],
  targetedCommands: [{
    executable: "pnpm",
    args: ["exec", "jest", "__tests__/profile-cache.test.ts", "--runInBand"],
  }],
  timeoutMinutes: 45,
  maxRepairRounds: 2,
});

const capture = (run) => {
  try { run(); throw new Error("EXPECTED_POLICY_ERROR"); } catch (error) { return error; }
};

test("accepts and freezes the complete contract", () => {
  const result = policy.validateTaskPacket(packet(), { mainCheckout });
  expect(result.model).toBe("zai-coding-plan/glm-5.3");
  expect(Object.isFrozen(result.allowedPaths)).toBe(true);
});

test.each([
  "C:/absolute.ts", "../escape.ts", "services\\mixed.ts", "//server/share.ts",
  "services//double.ts", ".env", ".env.production", "android/release.jks",
])("rejects unsafe path %s", (value) => {
  const valuePacket = packet(); valuePacket.allowedPaths = [value];
  expect(capture(() => policy.validateTaskPacket(valuePacket, { mainCheckout })))
    .toMatchObject({ name: "WorkerPolicyError", code: "PATH_REJECTED" });
});

test.each([
  "zai-coding-plan/glm-5.2", "zai-coding-plan/glm-5.3-preview",
  "glm-5.3", "zai-coding-plan/GLM 5.3",
])("rejects non-exact model %s", (model) => {
  const valuePacket = packet(); valuePacket.model = model;
  expect(capture(() => policy.validateTaskPacket(valuePacket, { mainCheckout })))
    .toMatchObject({ code: "MODEL_REJECTED" });
});

test.each([
  { executable: "powershell", args: ["-EncodedCommand", "AAAA"] },
  { executable: "pnpm", args: ["add", "left-pad"] },
  { executable: "pnpm", args: ["exec", "jest", "x.test.ts;git", "push"] },
  { executable: "pnpm", args: ["exec", "expo", "publish"] },
])("rejects unsafe command %#", (command) => {
  const valuePacket = packet(); valuePacket.targetedCommands = [command];
  expect(capture(() => policy.validateTaskPacket(valuePacket, { mainCheckout })))
    .toMatchObject({ code: "COMMAND_REJECTED" });
});
```

Also test allowed/protected overlap, timeout outside 1–120, repair rounds outside 0–2, main checkout equality, permission rule ordering, scope classification and nested secret redaction.

- [x] **Step 2: Chạy RED**

```powershell
pnpm exec jest __tests__/opencode-worker-policy.test.js --runInBand
```

Expected: FAIL with missing policy module.

- [x] **Step 3: Implement validation and immutable result statuses**

Implement these exact rules in `scripts/lib/opencode-worker-policy.cjs`:

```js
/* eslint-env node */
"use strict";
const path = require("node:path");

const RESULT_STATUS = Object.freeze({
  PASS_TO_REVIEW: "PASS_TO_REVIEW", MODEL_NOT_AVAILABLE: "MODEL_NOT_AVAILABLE",
  PROVIDER_AUTH_REQUIRED: "PROVIDER_AUTH_REQUIRED", INVALID_TASK_PACKET: "INVALID_TASK_PACKET",
  DIRTY_BASELINE: "DIRTY_BASELINE", PERMISSION_DENIED: "PERMISSION_DENIED",
  TIMEOUT: "TIMEOUT", WRITE_WINDOW_UNSTABLE: "WRITE_WINDOW_UNSTABLE",
  SCOPE_VIOLATION: "SCOPE_VIOLATION", NO_CHANGES: "NO_CHANGES",
  WORKER_FAILED: "WORKER_FAILED",
});
const SAFE_RUN = new Set(["test", "test:ci", "typecheck", "lint", "check:source", "check:android", "check", "audit:prod", "check:export-budget"]);
const SAFE_EXEC = new Set(["jest", "eslint", "tsc"]);
const SHELL_META = /[;&|><`\r\n]/;
const SENSITIVE = /(?:^|\/)\.env(?:\..*)?$|\.(?:jks|keystore|p8|p12|key|mobileprovision)$|(?:^|\/)credentials\.json$/i;

class WorkerPolicyError extends Error {
  constructor(code) { super(code); this.name = "WorkerPolicyError"; this.code = code; }
}
const fail = (code) => { throw new WorkerPolicyError(code); };

function normalizeScopePattern(value) {
  if (typeof value !== "string" || !value || value.includes("\\") ||
      path.posix.isAbsolute(value) || /^(?:[a-z]:|\/\/)/i.test(value)) fail("PATH_REJECTED");
  const directory = value.endsWith("/**");
  const base = directory ? value.slice(0, -3) : value;
  const segments = base.split("/");
  if (!base || base.includes("*") || SENSITIVE.test(base) ||
      segments.some((part) => !part || part === "." || part === "..")) fail("PATH_REJECTED");
  return Object.freeze({ pattern: directory ? `${base}/**` : base, base, directory });
}

function validateCommand(command) {
  if (!command || command.executable !== "pnpm" || !Array.isArray(command.args)) fail("COMMAND_REJECTED");
  if (command.args.some((arg) => typeof arg !== "string" || !arg || /\s/.test(arg) || SHELL_META.test(arg))) fail("COMMAND_REJECTED");
  const safeRun = command.args[0] === "run" && command.args.length === 2 && SAFE_RUN.has(command.args[1]);
  const safeExec = command.args[0] === "exec" && SAFE_EXEC.has(command.args[1]);
  if (!safeRun && !safeExec) fail("COMMAND_REJECTED");
  return Object.freeze({ executable: "pnpm", args: Object.freeze([...command.args]) });
}
```

`validateTaskPacket` must reject unknown/missing required fields, normalize workspace with `path.resolve`, require `/^[a-z0-9._-]+\/glm-5\.3$/i`, require at least one allowlist path, reject allowed/protected overlap by prefix coverage, freeze nested arrays, and preserve only declared schema fields.

- [x] **Step 4: Implement permission, prompt, scope and redaction helpers**

```js
function buildPermissionPolicy(task) {
  const edit = { "*": "deny" };
  task.allowedPaths.forEach((scope) => { edit[scope.pattern] = "allow"; });
  const bash = {
    "*": "deny", "git status*": "allow", "git diff*": "allow",
    "git log*": "allow", "git show*": "allow", "git rev-parse*": "allow", "rg *": "allow",
  };
  task.targetedCommands.forEach((command) => {
    bash[[command.executable, ...command.args].join(" ")] = "allow";
  });
  ["commit", "push", "reset", "clean", "checkout", "switch", "merge", "rebase", "stash", "tag"]
    .forEach((verb) => { bash[`git ${verb}*`] = "deny"; });
  bash["eas *"] = "deny"; bash["pnpm exec eas *"] = "deny";
  return Object.freeze({
    read: { "*": "allow", ".env": "deny", ".env.*": "deny", "**/.env": "deny", "**/.env.*": "deny", "**/*.key": "deny", "**/*.jks": "deny", "**/credentials.json": "deny" },
    edit, bash, external_directory: "deny", task: "deny", webfetch: "deny", websearch: "deny",
  });
}

function redactEvidence(value) {
  return (typeof value === "string" ? value : JSON.stringify(value))
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer <redacted>")
    .replace(/("(?:api[_-]?key|authorization|cookie|token|secret|password)"\s*:\s*)"[^"]*"/gi, "$1\"<redacted>\"")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "<redacted-jwt>");
}
```

`buildWorkerPrompt` must include task ID, objective, plan, allow/protect paths, numbered acceptance criteria, exact structured commands and the no-commit/no-release/no-subagent contract. `classifyChangedPaths` must sort/dedupe paths and return separate frozen `allowed`/`violations` arrays.

- [x] **Step 5: Add focused coverage config**

```js
/* eslint-env node */
const base = require("./jest.config");
module.exports = {
  ...base,
  roots: ["<rootDir>"],
  testMatch: ["<rootDir>/__tests__/opencode-worker-*.test.js"],
  collectCoverageFrom: ["scripts/lib/opencode-worker-policy.cjs", "scripts/lib/opencode-worker-runtime.cjs", "scripts/run-opencode-worker.cjs"],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
};
```

- [x] **Step 6: Run GREEN, lint and commit**

```powershell
pnpm exec jest __tests__/opencode-worker-policy.test.js --runInBand
pnpm exec eslint scripts/lib/opencode-worker-policy.cjs __tests__/opencode-worker-policy.test.js jest.opencode-worker.config.js --max-warnings=0
git add -- scripts/lib/opencode-worker-policy.cjs __tests__/opencode-worker-policy.test.js jest.opencode-worker.config.js
git diff --cached --name-only
git commit -m "test: add opencode worker task policy"
```

Expected staged names exactly match the three Task 1 files.

## Task 2 — Worktree, process and stable-write runtime

**Files:**
- Create: `scripts/lib/opencode-worker-runtime.cjs`
- Create: `__tests__/opencode-worker-runtime.test.js`

**Interfaces:**
- Consumes: validated task, injected `execFileSync`, `spawn`, clock/delay and environment.
- Produces: `inspectWorktree`, `assertScopesInsideWorktree`, `listChangedPaths`, `fingerprintWorkspace`, `waitForStableWrite`, `runProcess`, `terminateProcessTree`, `createEvidenceStore`.

- [x] **Step 1: Write runtime tests RED**

```js
/* eslint-env jest, node */
const EventEmitter = require("node:events");
const runtime = require("../scripts/lib/opencode-worker-runtime.cjs");

test("merges tracked, staged and untracked Git paths", () => {
  const outputs = new Map([
    ["diff --name-only -z HEAD", "src/a.ts\0src/deleted.ts\0"],
    ["diff --cached --name-only -z HEAD", "src/staged.ts\0"],
    ["ls-files --others --exclude-standard -z", "src/new.ts\0"],
  ]);
  const execFileSyncImpl = jest.fn((command, args) => outputs.get(args.slice(2).join(" ")) || "");
  expect(runtime.listChangedPaths("C:/worktree", { execFileSyncImpl })).toEqual([
    "src/a.ts", "src/deleted.ts", "src/new.ts", "src/staged.ts",
  ]);
});

test("rejects a realpath escape through a linked scope", () => {
  expect(() => runtime.assertScopesInsideWorktree(
    "C:\\worktree",
    [{ base: "linked/new.ts", directory: false }],
    {
      existsImpl: (value) => value.endsWith("linked") || value.endsWith("worktree"),
      realpathImpl: (value) => value.endsWith("linked") ? "C:\\outside" : "C:\\worktree",
    },
  )).toThrow("SCOPE_REALPATH_ESCAPE");
});

test("resets the ten-second stable window after a late write", async () => {
  const fingerprints = ["a", "a", "b", "b", "b"];
  let now = 0;
  const result = await runtime.waitForStableWrite({
    workspace: "C:/worktree", stableMs: 2_000, maxWaitMs: 10_000, pollMs: 1_000,
    fingerprintImpl: async () => fingerprints.shift() || "b",
    nowImpl: () => now,
    delayImpl: async (ms) => { now += ms; },
  });
  expect(result).toEqual({ stable: true, fingerprint: "b" });
});

test("a timeout terminates only the spawned process tree", async () => {
  const child = new EventEmitter();
  child.pid = 43127; child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  const terminateImpl = jest.fn(async () => undefined);
  const pending = runtime.runProcess({
    command: "opencode.cmd", args: ["run"], cwd: "C:/worktree", env: {}, timeoutMs: 1,
    spawnImpl: () => child, terminateImpl,
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  child.emit("exit", null, "SIGTERM");
  await expect(pending).resolves.toMatchObject({ timedOut: true });
  expect(terminateImpl).toHaveBeenCalledWith(child);
});
```

Also test clean linked-worktree acceptance, main checkout rejection, ordinary checkout rejection, dirty baseline, `stable: false`, Windows `taskkill.exe /PID exact /T /F`, missing `LOCALAPPDATA`, exclusive evidence writes and `spawn` with `shell: false`.

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/opencode-worker-runtime.test.js --runInBand
```

Expected: missing runtime module.

- [x] **Step 3: Implement worktree and realpath boundaries**

```js
/* eslint-env node */
"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFile, execFileSync, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const execFileAsync = promisify(execFile);

const runGit = (workspace, args, execImpl = execFileSync) => String(execImpl(
  "git", ["-C", workspace, ...args], { encoding: "utf8", windowsHide: true },
));
const parseNul = (value) => value.split("\0").filter(Boolean).map((item) => item.replace(/\\/g, "/"));

function inspectWorktree(workspace, { mainCheckout, execFileSyncImpl = execFileSync }) {
  const root = path.resolve(runGit(workspace, ["rev-parse", "--show-toplevel"], execFileSyncImpl).trim());
  const gitDir = path.resolve(root, runGit(root, ["rev-parse", "--git-dir"], execFileSyncImpl).trim());
  const commonDir = path.resolve(root, runGit(root, ["rev-parse", "--git-common-dir"], execFileSyncImpl).trim());
  const status = runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], execFileSyncImpl);
  if (root.toLowerCase() === path.resolve(mainCheckout).toLowerCase()) throw new Error("MAIN_CHECKOUT_REJECTED");
  if (gitDir.toLowerCase() === commonDir.toLowerCase()) throw new Error("LINKED_WORKTREE_REQUIRED");
  if (status) throw new Error("DIRTY_BASELINE");
  return Object.freeze({ root, gitDir, commonDir, clean: true, linked: true });
}

function assertScopesInsideWorktree(workspace, scopes, {
  existsImpl = fs.existsSync, realpathImpl = fs.realpathSync.native,
} = {}) {
  const rootReal = path.resolve(realpathImpl(workspace));
  for (const scope of scopes) {
    let candidate = path.resolve(workspace, scope.base);
    while (!existsImpl(candidate) && candidate !== workspace) candidate = path.dirname(candidate);
    const relative = path.relative(rootReal, path.resolve(realpathImpl(candidate)));
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
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
  return [...new Set(sources.flatMap((args) => parseNul(runGit(workspace, args, execFileSyncImpl))))].sort();
}
```

- [x] **Step 4: Implement content fingerprint, stability, process and evidence**

`fingerprintWorkspace` hashes sorted relative names plus current file bytes or `<deleted>`. `waitForStableWrite` resets `stableSince` whenever the hash changes.

```js
async function waitForStableWrite({
  workspace, stableMs = 10_000, maxWaitMs = 60_000, pollMs = 1_000,
  fingerprintImpl = fingerprintWorkspace, nowImpl = Date.now,
  delayImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const startedAt = nowImpl();
  let last = await fingerprintImpl(workspace);
  let stableSince = startedAt;
  while (nowImpl() - startedAt <= maxWaitMs) {
    await delayImpl(pollMs);
    const current = await fingerprintImpl(workspace);
    if (current !== last) { last = current; stableSince = nowImpl(); }
    if (nowImpl() - stableSince >= stableMs) return Object.freeze({ stable: true, fingerprint: current });
  }
  return Object.freeze({ stable: false, fingerprint: last });
}

async function terminateProcessTree(child, {
  platform = process.platform, execFileAsyncImpl = execFileAsync,
} = {}) {
  if (!child.pid) return;
  if (platform === "win32") {
    await execFileAsyncImpl("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true })
      .catch(() => undefined);
    return;
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
}
```

`runProcess` must call `spawn(command, args, { cwd, env, shell: false, windowsHide: true, detached: platform !== "win32", stdio: ["ignore", "pipe", "pipe"] })`, collect stdout/stderr, set `timedOut`, and invoke only `terminateProcessTree(child)` on timeout. `createEvidenceStore` must require `LOCALAPPDATA`, create `%LOCALAPPDATA%\CodexOpenCode\Vshop\runs\<task>-<run>`, and write JSON with `flag: "wx"`.

- [x] **Step 5: Run GREEN, lint and commit**

```powershell
pnpm exec jest __tests__/opencode-worker-runtime.test.js --runInBand
pnpm exec eslint scripts/lib/opencode-worker-runtime.cjs __tests__/opencode-worker-runtime.test.js --max-warnings=0
git add -- scripts/lib/opencode-worker-runtime.cjs __tests__/opencode-worker-runtime.test.js
git diff --cached --name-only
git commit -m "feat: add guarded opencode worker runtime"
```

## Task 3 — Non-interactive runner and result classification

**Files:**
- Create: `scripts/run-opencode-worker.cjs`
- Create: `__tests__/opencode-worker-runner.test.js`
- Modify: `package.json` scripts only

**Interfaces:**
- Consumes: `--task-file <absolute-json-path>` and optional `--dry-run`.
- Produces: `OPENCODE_WORKER_STATUS=<status>`, sanitized evidence, and exit code 0 only for successful dry-run or `PASS_TO_REVIEW`.
- Internal test API: `main(argv, dependencies): Promise<number>`, `parseExactModels(text): string[]`.

- [x] **Step 1: Write runner tests RED**

```js
/* eslint-env jest, node */
const { main, parseExactModels } = require("../scripts/run-opencode-worker.cjs");

test("strips ANSI but does not collapse model aliases", () => {
  const text = "\u001b[32mzai-coding-plan/glm-5.3\u001b[0m\n" +
    "zai-coding-plan/glm-5.3-preview\n";
  expect(parseExactModels(text)).toEqual([
    "zai-coding-plan/glm-5.3", "zai-coding-plan/glm-5.3-preview",
  ]);
});

test("missing exact model does not spawn a worker", async () => {
  const runProcessImpl = jest.fn();
  const writes = [];
  const code = await main(["--task-file", "C:\\temp\\task.json"], createRunnerDeps({
    models: ["zai-coding-plan/glm-5.2"], runProcessImpl,
    stdout: { write: (value) => writes.push(value) },
  }));
  expect(code).toBe(1);
  expect(runProcessImpl).not.toHaveBeenCalled();
  expect(writes.join("")).toContain("OPENCODE_WORKER_STATUS=MODEL_NOT_AVAILABLE");
});
```

`createRunnerDeps` must supply a validated exact-GLM task, clean linked worktree, in-memory evidence store and no-op Git checks. Add tests for timeout, nonzero exit, auth-shaped failure, no changes, unstable window, scope violation, forbidden artifact, `git diff --check` failure, dry-run, invalid argv/JSON and nested stdout/stderr secret canaries.

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/opencode-worker-runner.test.js --runInBand
```

- [x] **Step 3: Implement CLI parsing and exact model probe**

```js
/* eslint-env node */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const policy = require("./lib/opencode-worker-policy.cjs");
const runtime = require("./lib/opencode-worker-runtime.cjs");

const stripAnsi = (value) => value.replace(/\u001b\[[0-9;]*m/g, "");
const parseExactModels = (value) => stripAnsi(value).split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(line));
const resolveOpenCodeCommand = (platform = process.platform) => platform === "win32" ? "opencode.cmd" : "opencode";

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const filtered = argv.filter((value) => value !== "--dry-run");
  if (filtered.length !== 2 || filtered[0] !== "--task-file" || !path.isAbsolute(filtered[1])) {
    throw new Error("USAGE: --task-file <absolute-path> [--dry-run]");
  }
  return Object.freeze({ taskFile: filtered[1], dryRun });
}

function probeOpenCode({ command, execFileSyncImpl = execFileSync }) {
  const options = { encoding: "utf8", windowsHide: true };
  return Object.freeze({
    version: String(execFileSyncImpl(command, ["--version"], options)).trim(),
    authSummary: String(execFileSyncImpl(command, ["auth", "list"], options)).trim(),
    models: Object.freeze(parseExactModels(String(execFileSyncImpl(command, ["models", "--refresh"], options)))),
  });
}
```

- [x] **Step 4: Implement ordered orchestration**

`main` order is fixed: load/validate → inspect linked worktree → realpath guard → CLI probe → exact model membership → dry-run or spawn → timeout/exit mapping → stable-write → changed paths → artifact/scope audit → `git diff --check` → sanitized evidence → `PASS_TO_REVIEW`.

OpenCode invocation must be an argument array, never a shell string:

```js
const args = [
  "run", "--dir", worktree.root, "--model", task.model,
  "--agent", "codex-worker", "--format", "json",
  "--title", task.taskId, "--auto", policy.buildWorkerPrompt(task),
];
const processResult = await runProcessImpl({
  command, args, cwd: worktree.root,
  env: { ...process.env, OPENCODE_PERMISSION: JSON.stringify(policy.buildPermissionPolicy(task)) },
  timeoutMs: task.timeoutMinutes * 60_000,
});
```

Map auth-shaped nonzero output to `PROVIDER_AUTH_REQUIRED`; other nonzero output to `WORKER_FAILED`; zero changes to `NO_CHANGES`; forbidden `.env`, signing key, APK/AAB, log, `android/`, `ios/`, `dist/`, `out/`, `coverage/` to `SCOPE_VIOLATION`. Never auto-revert.

- [x] **Step 5: Add package scripts**

```json
"worker:opencode": "node scripts/run-opencode-worker.cjs",
"test:opencode-worker": "jest --config jest.opencode-worker.config.js --ci --runInBand --coverage"
```

- [x] **Step 6: Run coverage, lint and commit**

```powershell
pnpm exec jest __tests__/opencode-worker-runner.test.js --runInBand
pnpm run test:opencode-worker
pnpm exec eslint scripts/run-opencode-worker.cjs __tests__/opencode-worker-runner.test.js --max-warnings=0
git add -- scripts/run-opencode-worker.cjs __tests__/opencode-worker-runner.test.js package.json
git diff --cached --name-only
git commit -m "feat: add opencode worker runner"
```

If any coverage metric is below 80%, add tests for uncovered failure branches; do not lower the threshold.

## Task 4 — Canonical Codex skill and OpenCode worker agent

**Files:**
- Create: `skills/codex-opencode-handoff/SKILL.md`
- Create: `.opencode/agents/codex-worker.md`
- Create: `__tests__/opencode-worker-config.test.js`

**Interfaces:**
- Consumes: approved plan, managed worktree and runner status.
- Produces: reusable coordinator workflow and OpenCode primary agent `codex-worker`.

- [x] **Step 1: Write static contract test RED**

```js
/* eslint-env jest, node */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("agent cannot delegate, leave the worktree or browse", () => {
  const agent = read(".opencode/agents/codex-worker.md");
  expect(agent).toMatch(/mode:\s*primary/);
  expect(agent).toMatch(/task:\s*deny/);
  expect(agent).toMatch(/external_directory:\s*deny/);
  expect(agent).toMatch(/webfetch:\s*deny/);
  expect(agent).toMatch(/websearch:\s*deny/);
  expect(agent).toMatch(/Do not commit, push, merge, release/i);
  expect(agent).not.toMatch(/^model:/m);
});

test("skill requires isolation, complete diff review and bounded repairs", () => {
  const skill = read("skills/codex-opencode-handoff/SKILL.md");
  expect(skill).toMatch(/managed worktree/i);
  expect(skill).toMatch(/read the complete diff/i);
  expect(skill).toMatch(/maximum of two repair rounds/i);
  expect(skill).toMatch(/MODEL_NOT_AVAILABLE/);
  expect(skill).toMatch(/PASS_TO_REVIEW.*not.*completion/is);
});
```

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/opencode-worker-config.test.js --runInBand
```

- [x] **Step 3: Create the OpenCode primary agent**

Create `.opencode/agents/codex-worker.md` exactly as follows:

```markdown
---
description: Implements an approved Codex task packet inside an isolated worktree
mode: primary
temperature: 0.1
permission:
  task: deny
  external_directory: deny
  webfetch: deny
  websearch: deny
---

You are the implementation worker for a Codex-coordinated task.

Read AGENTS.md and the named implementation plan before editing. Treat the
task packet in the user message as the complete scope. Use RED, GREEN, then
refactor. Modify only allowlisted paths, run only listed commands, preserve
unrelated state, and report every limitation as NOT VERIFIED.

Do not commit, push, merge, release, publish, change credentials, read secret
files, launch subagents, broaden scope, or claim runtime evidence you did not
observe. End with files changed, tests run, exact results, limitations, and
remaining verification.
```

Do not set `model`; runner owns exact refreshed model selection.

- [x] **Step 4: Create the canonical coordinator skill**

Create `skills/codex-opencode-handoff/SKILL.md` with valid frontmatter and these mandatory ordered actions:

```markdown
---
name: codex-opencode-handoff
description: Delegate an approved implementation plan to guarded OpenCode GLM workers while Codex owns worktrees, review, verification, and final decisions.
---

# Codex to OpenCode Handoff

Use only after the user approves a design and implementation plan.

1. Read AGENTS.md, the approved spec, and the approved plan.
2. Snapshot git status and preserve unrelated dirty paths.
3. Create or reuse a managed worktree from the exact verified ref. Never run
   the worker in the main checkout.
4. Create the task packet outside the repository with exact GLM 5.3, finite
   allowed/protected paths, structured pnpm commands, timeout <= 120 minutes,
   and a maximum of two repair rounds.
5. Run `pnpm run worker:opencode -- --task-file ABSOLUTE_JSON_PATH`.
6. Stop on MODEL_NOT_AVAILABLE, PROVIDER_AUTH_REQUIRED, DIRTY_BASELINE,
   WRITE_WINDOW_UNSTABLE, SCOPE_VIOLATION, NO_CHANGES, or WORKER_FAILED.
7. PASS_TO_REVIEW is not completion. Read the complete diff and rerun gates.
8. Send concrete findings through a narrower repair packet; maximum two rounds.
9. Commit only reviewed files with explicit staging. Do not push or release.
10. Archive the managed worktree only after every process and patch is accounted.
```

- [x] **Step 5: Run GREEN, lint and commit**

```powershell
pnpm exec jest __tests__/opencode-worker-config.test.js --runInBand
pnpm exec eslint __tests__/opencode-worker-config.test.js --max-warnings=0
git add -- .opencode/agents/codex-worker.md skills/codex-opencode-handoff/SKILL.md __tests__/opencode-worker-config.test.js
git diff --cached --name-only
git commit -m "chore: add codex opencode handoff workflow"
```

## Task 5 — Install matching CLI and run a guarded GLM 5.3 smoke task

**Files:**
- No committed repository source expected.
- Outside repo: temporary task packet and `%LOCALAPPDATA%\CodexOpenCode\Vshop\runs\...` evidence.
- Disposable worktree only: `markdown/plans/.opencode-smoke-proof.md`.

**Interfaces:**
- Consumes: current Desktop version, current OpenCode credential store, exact setup commit.
- Produces: matching global CLI, exact model evidence and reviewed disposable smoke diff.

- [x] **Step 1: Verify matching package availability without installing**

```powershell
$opencodeDesktopPath = 'C:\Users\kona\AppData\Local\Programs\@opencode-aidesktop\OpenCode.exe'
if (-not (Test-Path -LiteralPath $opencodeDesktopPath)) { throw 'OPENCODE_DESKTOP_NOT_FOUND' }
$opencodeDesktopVersion = (Get-Item -LiteralPath $opencodeDesktopPath).VersionInfo.FileVersion
if (-not $opencodeDesktopVersion) { throw 'OPENCODE_DESKTOP_VERSION_UNKNOWN' }
pnpm view "opencode-ai@$opencodeDesktopVersion" version
```

Expected: registry returns exactly the installed Desktop version. Otherwise stop with `CLI_VERSION_NOT_AVAILABLE`; do not install latest.

- [x] **Step 2: Install with pnpm and verify the executable**

```powershell
$opencodeDesktopPath = 'C:\Users\kona\AppData\Local\Programs\@opencode-aidesktop\OpenCode.exe'
$opencodeDesktopVersion = (Get-Item -LiteralPath $opencodeDesktopPath).VersionInfo.FileVersion
pnpm add --global "opencode-ai@$opencodeDesktopVersion"
opencode --version
```

Expected: CLI version equals Desktop version. Do not run `opencode uninstall` or edit shared state/database.

- [x] **Step 3: Verify provider and exact model without exposing credentials**

```powershell
opencode auth list
opencode models --refresh | Select-String -Pattern '^[a-z0-9._-]+/glm-5\.3$' -CaseSensitive:$false
```

Expected: auth status contains no secret and model command returns an exact ID. If absent, record `MODEL_NOT_AVAILABLE`, keep the CLI installed, and stop live execution without fallback.

- [x] **Step 4: Confirm committed setup and preserve main dirty state**

```powershell
git status --short
git log -1 --oneline
```

Expected: Tasks 1–4 are committed and the main checkout still has only the two original UI modifications. Record exact setup commit SHA.

- [x] **Step 5: Create a managed smoke worktree**

Use Codex `create_worktree` with the exact setup commit SHA as `ref` and name `opencode-worker-smoke`. Do not use shell `git worktree add`. Wait for the returned `workspaceDirectory`.

- [x] **Step 6: Create the smoke plan and external packet**

Keep the disposable worktree clean before the runner starts. The committed
implementation plan is the packet's `planPath`; the objective and acceptance
criteria require the worker to create exactly:

```markdown
# OpenCode Worker Smoke Proof
OPENCODE_WORKER_SMOKE=PASS
```

Use `apply_patch` to create the JSON packet under the exact system temp directory. Fill `workspace` with the returned worktree path and `model` with the exact refreshed ID. Fixed fields are:

```json
{
  "schemaVersion": 1,
  "taskId": "opencode-worker-smoke",
  "title": "OpenCode worker smoke proof",
  "objective": "Create the exact two-line proof from the smoke plan and change nothing else.",
  "planPath": "markdown/plans/2026-09-29-codex-opencode-worker.md",
  "allowedPaths": [
    "markdown/plans/.opencode-smoke-proof.md"
  ],
  "protectedPaths": ["components/**", "services/**", "package.json", "opencode.json"],
  "acceptanceCriteria": [
    "The proof file contains exactly the requested heading and sentinel line.",
    "No path outside the two allowlisted files changes."
  ],
  "targetedCommands": [],
  "timeoutMinutes": 15,
  "maxRepairRounds": 0
}
```

The final packet also contains the required dynamic `workspace` and `model` fields. Keep the packet outside Git. Immediately before running, `git status --porcelain` in the worktree must return no output.

- [x] **Step 7: Run dry-run then live worker**

```powershell
pnpm run worker:opencode -- --task-file $opencodeSmokePacketPath --dry-run
pnpm run worker:opencode -- --task-file $opencodeSmokePacketPath
```

Set `$opencodeSmokePacketPath` to the exact validated temp path from Step 6. Expected status for both commands: `OPENCODE_WORKER_STATUS=PASS_TO_REVIEW`.

- [x] **Step 8: Codex reviews the complete smoke diff and evidence**

```powershell
git -C $opencodeSmokeWorkspace status --short
git -C $opencodeSmokeWorkspace diff --check
```

Set `$opencodeSmokeWorkspace` to the exact returned worktree path. Inspect the proof file and sanitized run evidence; verify it is the only changed path and no raw token/key/cookie exists. Do not commit or merge the smoke file.

- [x] **Step 9: Archive safely**

Use `list_artifacts`, verify no process still uses the worktree, then call `archive_worktree`. Do not shell-delete the checkout. Delete only the exact packet file after resolving it under the system temp root; otherwise leave it and report its path.

## Task 6 — Documentation, full gates and final Codex review

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `markdown/plans/2026-09-29-codex-opencode-worker.md`
- Modify: `markdown/plans/README.md`

**Interfaces:**
- Consumes: committed runner/agent, model/smoke evidence and clean verification worktree.
- Produces: documented workflow, verification matrix and final review decision.

- [x] **Step 1: Document the developer workflow**

Add this README subsection and a CHANGELOG bullet labelled local development tooling:

```markdown
### Guarded OpenCode worker

Codex may delegate an approved implementation plan to `codex-worker` only
inside a clean managed worktree. Create the task packet outside the repository,
then run `pnpm run worker:opencode -- --task-file <absolute-json-path>`.

The runner requires exact GLM 5.3, finite edit paths, structured pnpm commands
and a stable post-exit write window. It never commits, pushes or releases, and
`PASS_TO_REVIEW` still requires Codex to review the complete diff and rerun all
applicable project gates.
```

Document rollback beside it: remove only the global package with
`pnpm remove --global opencode-ai`, revert the scoped repository commits, and
never run `opencode uninstall` because that command can remove shared config or
session data.

- [x] **Step 2: Run focused coverage**

```powershell
pnpm run test:opencode-worker
```

Expected: all four workflow suites pass and branches/functions/lines/statements are each at least 80%.

- [x] **Step 3: Run full gate in a clean verification worktree**

Create/reuse a managed worktree from final setup HEAD so main's unrelated dirty UI files cannot contaminate evidence:

```powershell
pnpm install --frozen-lockfile
pnpm run check
git diff --check
```

If only production audit fails, report typecheck/lint/tests/export/audit separately; do not hide advisories by changing dependencies or tests.

- [x] **Step 4: Run explicit Android export and validated cleanup**

```powershell
$opencodeExportRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$opencodeExportDir = [System.IO.Path]::GetFullPath((Join-Path $opencodeExportRoot ("vshop-opencode-worker-export-" + [guid]::NewGuid())))
if (-not $opencodeExportDir.StartsWith($opencodeExportRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'TEMP_EXPORT_PATH_REJECTED' }
pnpm exec expo export --platform android --output-dir $opencodeExportDir
if (-not $opencodeExportDir.StartsWith($opencodeExportRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'TEMP_EXPORT_PATH_REJECTED' }
Remove-Item -LiteralPath $opencodeExportDir -Recurse -Force
```

- [x] **Step 5: Review the whole implementation range**

```powershell
git diff 99d95da..HEAD -- . ':(exclude)components/ui/AppRefreshControl.web.tsx' ':(exclude)components/ui/AppViewport.tsx'
git log --oneline 99d95da..HEAD
rg -n -i "api[_-]?key|authorization|bearer |cookie|password|secret|git push|git reset|git clean|eas update|eas build" scripts/lib/opencode-worker-*.cjs scripts/run-opencode-worker.cjs .opencode/agents/codex-worker.md skills/codex-opencode-handoff/SKILL.md README.md CHANGELOG.md
```

Classify findings by severity. Fix every CRITICAL/HIGH issue, then rerun focused/full gates. Deny-rule documentation matches are expected review inputs, not automatic vulnerabilities.

- [x] **Step 6: Record exact evidence and status**

Record CLI/Desktop versions, provider status without secret, exact model ID, coverage totals, smoke status/evidence directory, each `pnpm run check` sub-gate, Android export cleanup and reviewed commit range. If exact GLM 5.3 or live auth is unavailable, keep live smoke unchecked and label `NOT VERIFIED`; do not mark the plan `done`.

- [x] **Step 7: Commit documentation only**

```powershell
git add -- README.md CHANGELOG.md markdown/plans/2026-09-29-codex-opencode-worker.md markdown/plans/README.md
git diff --cached --name-only
git diff --cached --check
git commit -m "docs: document guarded opencode worker"
```

Expected: exactly four staged files; the two pre-existing UI files remain unstaged and unchanged by this workflow.

## Execution evidence — 2026-09-30

- Task 1 commit `dbd6f18`: task schema, exact-model/path/command policy,
  permission builder và evidence redaction; RED → GREEN 31 tests.
- Task 2 commit `3e1c6e6`: linked-worktree/realpath guard, process-tree timeout,
  content fingerprint, stable-write và exclusive evidence store; 20 tests.
- Task 3 commit `885c934`: non-interactive runner, status mapping, focused Jest
  config và package scripts; focused coverage gate đạt trên 80% cả bốn metric.
- Task 4 commit `e63db42`: project-local `codex-worker` và canonical coordinator
  skill; static contract tests và fallback skill validation PASS.
- Windows resolver commit `c457ace`: Node chạy actual pnpm-installed
  `opencode.exe` bằng argument array, không bật shell.
- Final hardening commit `b6fe48f`: lọc child environment, bỏ unrestricted
  `rg`, chặn ESLint write flags, strict/lazy binary resolution, 120-second model
  probe timeout, structured credential redaction và timeout grace cho child
  không phát exit. Sáu test tương ứng đều được quan sát RED → GREEN.
- OpenCode Desktop và CLI cùng version `1.18.32`; credential store báo Z.AI và
  Z.AI Coding Plan; refreshed registry có exact `zai-coding-plan/glm-5.3`.
- Hardened live smoke evidence:
  `C:\Users\kona\AppData\Local\CodexOpenCode\Vshop\runs\opencode-worker-final-smoke-mumxm891-8bde3767`.
  Kết quả `PASS_TO_REVIEW`, exit `0`, không timeout/truncate, chỉ một allowlisted
  proof path, zero violation, stable fingerprint
  `50bebbe6a33916c91aa421705cfdc861303de495dd139b55fef9acd5d0f66dd6`,
  secret scan bằng `0`; disposable worktree đã được queue archive và proof không
  được merge.
- Focused final: 4 suites / 108 tests; statements `95.02%`, branches `84.57%`,
  functions `92.04%`, lines `96.06%`.
- Final `pnpm run check`: typecheck PASS, zero-warning lint PASS, 116/116 suites
  và 1,367/1,367 tests PASS, production audit PASS với 6 advisory transitive đã
  document, Android export/budget PASS ở 10.17/12 MiB total, 7.70/8 MiB Hermes
  và 1.25/1.50 MiB largest asset; unique export directory đã được dọn.
- Một full-check trước fix pass gặp test motion không liên quan timeout ở ngưỡng
  5 giây; isolated rerun PASS tại 4.977 giây và hai full-check kế tiếp PASS mà
  không sửa test.
- `quick_validate.py` không chạy vì host Python thiếu PyYAML; equivalent
  frontmatter/name/placeholder validation PASS. Host policy chặn xóa hai task
  packet tạm không chứa secret, nên không dùng workaround xóa rộng.

## Verification Matrix

| Requirement | Automated | Live/manual | PASS rule |
|---|---|---|---|
| Exact model, no fallback | parser/model policy tests | refreshed exact model line | Both pass |
| Worktree-only | packet/runtime tests | managed smoke worktree | Main rejected, smoke isolated |
| Path/command safety | hostile policy tests | changed-path audit | No violation |
| Background writer | stability tests | 10-second stable window | Stable fingerprint |
| Credential safety | nested canaries | sanitized artifacts inspected | No raw canary |
| Process safety | timeout/tree tests | clean live exit | No orphan writer |
| Codex authority | config tests | complete diff + gates | Review follows PASS_TO_REVIEW |
| App regression | focused/full checks | Android export | All applicable gates pass |

## Completion Audit

- [x] Every spec section 1–18 maps to a task or explicit outside-scope statement.
- [x] No `TBD`, `TODO`, `implement later` or undefined interface remains.
- [x] Policy/runtime/runner signatures match across tests, skill and plan.
- [x] All five Review Focus conditions have executable tests.
- [x] Focused coverage is at least 80% for all four metrics.
- [x] Matching CLI and exact GLM 5.3 discovery have evidence.
- [x] Disposable GLM smoke passes without fallback.
- [x] `pnpm run check`, repository-owned Android export and `git diff --check` pass in the isolated worktree.
- [x] Whole-range Codex self-review has no open CRITICAL/HIGH finding after the single TDD fix pass.
- [x] Original two dirty UI files were never staged or modified by setup.
- [x] No secret, task packet, log or build artifact is committed.
- [x] Rollback instructions preserve OpenCode Desktop config, database and credentials.
- [x] Nothing was pushed, remotely merged, released or published.
