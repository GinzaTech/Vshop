/* eslint-env jest, node */

const EventEmitter = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  assertScopesInsideWorktree,
  createEvidenceStore,
  fingerprintWorkspace,
  inspectWorktree,
  listChangedPaths,
  runProcess,
  resolvePrimaryWorktree,
  terminateProcessTree,
  waitForStableWrite,
} = require("../scripts/lib/opencode-worker-runtime.cjs");

const createChild = () => {
  const child = new EventEmitter();
  child.pid = 43127;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();
  return child;
};

const linkedWorktreeGit = ({ root = "C:/worktrees/task", status = "" } = {}) =>
  jest.fn((command, args) => {
    const operation = args.slice(2).join(" ");
    if (operation === "rev-parse --show-toplevel") return `${root}\n`;
    if (operation === "rev-parse --git-dir") return "C:/repo/.git/worktrees/task\n";
    if (operation === "rev-parse --git-common-dir") return "C:/repo/.git\n";
    if (operation === "status --porcelain=v1 -z --untracked-files=all") return status;
    throw new Error(`UNEXPECTED_GIT_CALL:${operation}`);
  });

describe("OpenCode worker Git and path runtime", () => {
  test.each([
    ["relative", "C:/repo", "WORKTREE_PATH_REJECTED"],
    ["C:/worktrees/task", "relative", "MAIN_CHECKOUT_REJECTED"],
  ])("rejects invalid workspace inputs", (workspace, mainCheckout, code) => {
    expect(() => inspectWorktree(workspace, {
      mainCheckout,
      execFileSyncImpl: jest.fn(),
    })).toThrow(code);
  });

  test("accepts only a clean linked worktree", () => {
    const result = inspectWorktree("C:/worktrees/task", {
      mainCheckout: "C:/repo",
      execFileSyncImpl: linkedWorktreeGit(),
    });
    expect(result).toMatchObject({
      root: path.resolve("C:/worktrees/task"),
      clean: true,
      linked: true,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  test.each([
    ["C:/repo", "C:/repo", "", "MAIN_CHECKOUT_REJECTED"],
    ["C:/worktrees/task", "C:/repo", " M src/file.ts\0", "DIRTY_BASELINE"],
  ])("rejects workspace=%s status=%s", (root, mainCheckout, status, code) => {
    expect(() => inspectWorktree(root, {
      mainCheckout,
      execFileSyncImpl: linkedWorktreeGit({ root, status }),
    })).toThrow(code);
  });

  test("rejects an ordinary checkout whose git dir equals its common dir", () => {
    const execFileSyncImpl = jest.fn((command, args) => {
      const operation = args.slice(2).join(" ");
      if (operation === "rev-parse --show-toplevel") return "C:/other\n";
      if (operation === "rev-parse --git-dir") return ".git\n";
      if (operation === "rev-parse --git-common-dir") return ".git\n";
      if (operation.startsWith("status ")) return "";
      throw new Error(operation);
    });
    expect(() => inspectWorktree("C:/other", {
      mainCheckout: "C:/repo",
      execFileSyncImpl,
    })).toThrow("LINKED_WORKTREE_REQUIRED");
  });

  test("merges tracked, deleted, staged and untracked Git paths", () => {
    const outputs = new Map([
      ["diff --name-only -z HEAD", "src/a.ts\0src/deleted.ts\0"],
      ["diff --cached --name-only -z HEAD", "src/staged.ts\0"],
      ["ls-files --others --exclude-standard -z", "src/new.ts\0src/a.ts\0"],
    ]);
    const execFileSyncImpl = jest.fn((command, args) =>
      outputs.get(args.slice(2).join(" ")) || "");
    expect(listChangedPaths("C:/worktrees/task", { execFileSyncImpl })).toEqual([
      "src/a.ts",
      "src/deleted.ts",
      "src/new.ts",
      "src/staged.ts",
    ]);
  });

  test("resolves the primary checkout from Git worktree porcelain output", () => {
    const execFileSyncImpl = jest.fn(() => [
      "worktree C:/repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree C:/repo-worktrees/task",
      "HEAD def456",
      "detached",
      "",
    ].join("\n"));
    expect(resolvePrimaryWorktree("C:/repo-worktrees/task", { execFileSyncImpl }))
      .toBe(path.resolve("C:/repo"));
    expect(execFileSyncImpl).toHaveBeenCalledWith(
      "git",
      ["-C", "C:/repo-worktrees/task", "worktree", "list", "--porcelain"],
      { encoding: "utf8", windowsHide: true },
    );
  });

  test("rejects worktree output without a primary path", () => {
    expect(() => resolvePrimaryWorktree("C:/worktree", {
      execFileSyncImpl: () => "HEAD abc\n",
    })).toThrow("PRIMARY_WORKTREE_NOT_FOUND");
  });

  test("rejects a linked scope whose nearest existing parent escapes the worktree", () => {
    expect(() => assertScopesInsideWorktree(
      "C:\\worktree",
      [{ base: "linked/new.ts", directory: false }],
      {
        existsImpl: (value) => value.endsWith("linked") || value.endsWith("worktree"),
        realpathImpl: (value) => value.endsWith("linked")
          ? "C:\\outside\\target"
          : "C:\\worktree",
      },
    )).toThrow("SCOPE_REALPATH_ESCAPE");
  });

  test("accepts a not-yet-created file under a real parent inside the worktree", () => {
    expect(() => assertScopesInsideWorktree(
      "C:\\worktree",
      [{ base: "src/new.ts", directory: false }],
      {
        existsImpl: (value) => value.endsWith("src") || value.endsWith("worktree"),
        realpathImpl: (value) => value,
      },
    )).not.toThrow();
  });

  test("rejects malformed scopes and a missing worktree root", () => {
    expect(() => assertScopesInsideWorktree("C:\\worktree", null, {
      realpathImpl: (value) => value,
    })).toThrow("SCOPE_REALPATH_REJECTED");
    expect(() => assertScopesInsideWorktree("C:\\worktree", [null], {
      realpathImpl: (value) => value,
    })).toThrow("SCOPE_REALPATH_REJECTED");
    expect(() => assertScopesInsideWorktree(
      "C:\\worktree",
      [{ base: "src/new.ts", directory: false }],
      { existsImpl: () => false, realpathImpl: (value) => value },
    )).toThrow("SCOPE_REALPATH_REJECTED");
  });

  test("fingerprints file contents and deletion markers deterministically", async () => {
    const reads = new Map([["C:\\worktree\\a.ts", "alpha"]]);
    const first = await fingerprintWorkspace("C:\\worktree", {
      listChangedPathsImpl: () => ["deleted.ts", "a.ts"],
      existsImpl: (value) => reads.has(value),
      readFileImpl: (value) => Buffer.from(reads.get(value)),
    });
    reads.set("C:\\worktree\\a.ts", "beta");
    const second = await fingerprintWorkspace("C:\\worktree", {
      listChangedPathsImpl: () => ["a.ts", "deleted.ts"],
      existsImpl: (value) => reads.has(value),
      readFileImpl: (value) => Buffer.from(reads.get(value)),
    });
    expect(first).not.toBe(second);
    expect(first).toHaveLength(64);
  });
});

describe("OpenCode worker stability and process runtime", () => {
  test("requires a full stable interval after a late write", async () => {
    const fingerprints = ["a", "a", "b", "b", "b"];
    let now = 0;
    const result = await waitForStableWrite({
      workspace: "C:/worktree",
      stableMs: 2_000,
      maxWaitMs: 10_000,
      pollMs: 1_000,
      fingerprintImpl: async () => fingerprints.shift() || "b",
      nowImpl: () => now,
      delayImpl: async (milliseconds) => { now += milliseconds; },
    });
    expect(result).toEqual({ stable: true, fingerprint: "b" });
  });

  test("returns unstable when writes never settle before the deadline", async () => {
    let now = 0;
    let fingerprint = 0;
    await expect(waitForStableWrite({
      workspace: "C:/worktree",
      stableMs: 3_000,
      maxWaitMs: 2_000,
      pollMs: 1_000,
      fingerprintImpl: async () => String(fingerprint++),
      nowImpl: () => now,
      delayImpl: async (milliseconds) => { now += milliseconds; },
    })).resolves.toMatchObject({ stable: false });
  });

  test("spawns without a shell and captures bounded output", async () => {
    const child = createChild();
    const spawnImpl = jest.fn(() => child);
    const pending = runProcess({
      command: "opencode.cmd",
      args: ["run"],
      cwd: "C:/worktree",
      env: { SAFE: "1" },
      timeoutMs: 1_000,
      maxOutputBytes: 5,
      spawnImpl,
    });
    child.stdout.emit("data", Buffer.from("123456"));
    child.stderr.emit("data", Buffer.from("error"));
    child.emit("exit", 0, null);
    await expect(pending).resolves.toMatchObject({
      code: 0,
      timedOut: false,
      stdout: "12345",
      stderr: "error",
      outputTruncated: true,
    });
    expect(spawnImpl).toHaveBeenCalledWith(
      "opencode.cmd",
      ["run"],
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
  });

  test("timeout terminates only the spawned child tree", async () => {
    const child = createChild();
    const terminateImpl = jest.fn(async () => undefined);
    const pending = runProcess({
      command: "opencode.cmd",
      args: ["run"],
      cwd: "C:/worktree",
      env: {},
      timeoutMs: 1,
      spawnImpl: () => child,
      terminateImpl,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    child.emit("exit", null, "SIGTERM");
    await expect(pending).resolves.toMatchObject({ timedOut: true, code: 1 });
    expect(terminateImpl).toHaveBeenCalledTimes(1);
    expect(terminateImpl).toHaveBeenCalledWith(child);
  });

  test("returns a timeout result when the child never emits exit", async () => {
    const child = createChild();
    child.stdout.destroy = jest.fn();
    child.stderr.destroy = jest.fn();
    child.unref = jest.fn();
    const pending = runProcess({
      command: "opencode.exe",
      args: ["run"],
      cwd: "C:/worktree",
      env: {},
      timeoutMs: 1,
      terminationGraceMs: 1,
      spawnImpl: () => child,
      terminateImpl: jest.fn(async () => undefined),
    });
    await expect(pending).resolves.toMatchObject({
      timedOut: true,
      code: 1,
      signal: "TERMINATION_UNCONFIRMED",
    });
    expect(child.stdout.destroy).toHaveBeenCalledTimes(1);
    expect(child.stderr.destroy).toHaveBeenCalledTimes(1);
    expect(child.unref).toHaveBeenCalledTimes(1);
  });

  test("Windows termination targets only the exact child PID", async () => {
    const execFileAsyncImpl = jest.fn(async () => ({ stdout: "", stderr: "" }));
    await terminateProcessTree({ pid: 43127 }, {
      platform: "win32",
      execFileAsyncImpl,
    });
    expect(execFileAsyncImpl).toHaveBeenCalledWith(
      "taskkill.exe",
      ["/PID", "43127", "/T", "/F"],
      { windowsHide: true },
    );
  });

  test("ignores a process object without a valid PID", async () => {
    const execFileAsyncImpl = jest.fn();
    await terminateProcessTree({ pid: 0 }, { platform: "win32", execFileAsyncImpl });
    expect(execFileAsyncImpl).not.toHaveBeenCalled();
  });

  test("uses the POSIX process group and falls back to the child", async () => {
    const killSpy = jest.spyOn(process, "kill").mockImplementationOnce(() => undefined);
    const child = { pid: 43127, kill: jest.fn() };
    await terminateProcessTree(child, { platform: "linux" });
    expect(killSpy).toHaveBeenCalledWith(-43127, "SIGTERM");
    expect(child.kill).not.toHaveBeenCalled();

    killSpy.mockImplementationOnce(() => { throw new Error("NO_GROUP"); });
    await terminateProcessTree(child, { platform: "linux" });
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    killSpy.mockRestore();
  });

  test("rejects spawn errors", async () => {
    const child = createChild();
    const pending = runProcess({
      command: "opencode.cmd",
      args: [],
      cwd: "C:/worktree",
      env: {},
      timeoutMs: 1_000,
      spawnImpl: () => child,
    });
    child.emit("error", new Error("SPAWN_FAILED"));
    await expect(pending).rejects.toThrow("SPAWN_FAILED");
  });
});

describe("OpenCode worker evidence store", () => {
  let temporaryRoot;

  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-runtime-test-"));
  });

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  test("requires LOCALAPPDATA", () => {
    expect(() => createEvidenceStore({ env: {}, taskId: "task", runId: "run" }))
      .toThrow("EVIDENCE_ROOT_UNAVAILABLE");
  });

  test("writes JSON exclusively under the user-local evidence root", () => {
    const store = createEvidenceStore({
      env: { LOCALAPPDATA: temporaryRoot },
      taskId: "safe-task",
      runId: "abc123",
    });
    store.writeJson("result.json", { status: "PASS_TO_REVIEW" });
    expect(JSON.parse(fs.readFileSync(path.join(store.root, "result.json"), "utf8")))
      .toEqual({ status: "PASS_TO_REVIEW" });
    expect(() => store.writeJson("result.json", { status: "overwrite" }))
      .toThrow(/EEXIST/);
  });

  test.each(["../escape", "task/path", "task\\path", ""])(
    "rejects unsafe evidence identifier %s",
    (taskId) => {
      expect(() => createEvidenceStore({
        env: { LOCALAPPDATA: temporaryRoot },
        taskId,
        runId: "run",
      })).toThrow("EVIDENCE_ID_REJECTED");
    },
  );

  test("rejects unsafe evidence filenames", () => {
    const store = createEvidenceStore({
      env: { LOCALAPPDATA: temporaryRoot },
      taskId: "safe-task",
      runId: "run",
    });
    expect(() => store.writeJson("../result.json", {})).toThrow("EVIDENCE_FILE_REJECTED");
    expect(() => store.writeJson("result.txt", {})).toThrow("EVIDENCE_FILE_REJECTED");
  });
});
