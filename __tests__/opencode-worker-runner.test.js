/* eslint-env jest, node */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const policy = require("../scripts/lib/opencode-worker-policy.cjs");
const {
  buildWorkerEnvironment,
  executeValidatedTask,
  loadTaskFile,
  main,
  parseArgs,
  parseExactModels,
  probeOpenCode,
  resolveOpenCodeCommand,
} = require("../scripts/run-opencode-worker.cjs");

const fixturePath = (...segments) => path.resolve(__dirname, "fixtures", ...segments);

const createTask = () => policy.validateTaskPacket({
  schemaVersion: 1,
  taskId: "worker-smoke",
  title: "Worker smoke",
  objective: "Create the approved smoke proof.",
  workspace: fixturePath("worktrees", "worker-smoke"),
  model: "zai-coding-plan/glm-5.3",
  planPath: "markdown/plans/worker-smoke.md",
  allowedPaths: ["markdown/plans/proof.md"],
  protectedPaths: ["components/**"],
  acceptanceCriteria: ["Only the proof file changes."],
  targetedCommands: [],
  timeoutMinutes: 15,
  maxRepairRounds: 0,
}, { mainCheckout: fixturePath("repo") });

const createEvidenceStore = () => {
  const writes = [];
  return {
    root: fixturePath("evidence", "worker-smoke-run"),
    writes,
    writeJson: (name, value) => writes.push({ name, value }),
  };
};

const createExecutionDeps = (overrides = {}) => {
  const evidenceStore = createEvidenceStore();
  return {
    openCodeCommand: "opencode.cmd",
    projectRoot: fixturePath("runner"),
    env: { LOCALAPPDATA: "C:\\local" },
    dryRun: false,
    resolvePrimaryWorktreeImpl: () => fixturePath("repo"),
    inspectWorktreeImpl: () => ({ root: fixturePath("worktrees", "worker-smoke") }),
    assertScopesInsideWorktreeImpl: jest.fn(),
    planExistsImpl: () => true,
    probeOpenCodeImpl: () => ({
      version: "1.18.32",
      authSummary: "Z.AI Coding Plan",
      models: ["zai-coding-plan/glm-5.3"],
    }),
    runProcessImpl: jest.fn(async () => ({
      code: 0,
      signal: null,
      timedOut: false,
      stdout: "worker complete",
      stderr: "",
      outputTruncated: false,
    })),
    waitForStableWriteImpl: jest.fn(async () => ({ stable: true, fingerprint: "abc" })),
    listChangedPathsImpl: () => ["markdown/plans/proof.md"],
    runGitDiffCheckImpl: jest.fn(),
    createEvidenceStoreImpl: () => evidenceStore,
    runIdImpl: () => "run123",
    ...overrides,
    evidenceStore,
  };
};

describe("OpenCode runner model and status handling", () => {
  test("resolves the real Windows executable behind the bounded pnpm shim", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-cli-test-"));
    const pnpmHome = path.join(temporaryRoot, "pnpm");
    const shimDir = path.join(pnpmHome, "bin");
    const executable = path.join(pnpmHome, "global", "v11", "hash", "node_modules", "opencode-ai", "bin", "opencode.exe");
    // The simulated Windows resolver uses backslashes; the fixture lives on the host filesystem.
    const hostPath = (value) => value.replace(/\\/g, path.sep);
    try {
      fs.mkdirSync(path.dirname(executable), { recursive: true });
      fs.mkdirSync(shimDir, { recursive: true });
      fs.writeFileSync(executable, "binary", "utf8");
      fs.writeFileSync(
        path.join(shimDir, "opencode.cmd"),
        '@SETLOCAL\r\n@"%~dp0\\..\\global\\v11\\hash\\node_modules\\opencode-ai\\bin\\opencode.exe" %*\r\n',
        "utf8",
      );
      expect(resolveOpenCodeCommand({
        platform: "win32",
        env: { PNPM_HOME: pnpmHome },
        existsImpl: (value) => fs.existsSync(hostPath(value)),
        readFileImpl: (value, encoding) => fs.readFileSync(hostPath(value), encoding),
      })).toBe(path.win32.resolve(executable));
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  test("uses PATH resolution on non-Windows and rejects an unbounded Windows shim", () => {
    expect(resolveOpenCodeCommand({ platform: "linux", env: {} })).toBe("opencode");
    expect(() => resolveOpenCodeCommand({
      platform: "win32",
      env: { PNPM_HOME: "C:\\pnpm" },
      existsImpl: () => true,
      readFileImpl: () => '@"C:\\outside\\opencode.exe" %*',
    })).toThrow("OPENCODE_BINARY_REJECTED");
  });

  test("resolves Windows shims independently of the host path implementation", () => {
    let resolveOnPosixHost;
    jest.isolateModules(() => {
      jest.doMock("node:path", () => path.posix);
      resolveOnPosixHost = require("../scripts/run-opencode-worker.cjs").resolveOpenCodeCommand;
    });
    jest.dontMock("node:path");
    expect(resolveOnPosixHost({
      platform: "win32",
      env: { PNPM_HOME: "C:\\pnpm" },
      existsImpl: () => true,
      readFileImpl: () => '@"%~dp0\\..\\global\\v11\\hash\\node_modules\\opencode-ai\\bin\\opencode.exe" %*',
    })).toBe("C:\\pnpm\\global\\v11\\hash\\node_modules\\opencode-ai\\bin\\opencode.exe");
  });

  test("rejects a pnpm shim that targets the wrong package inside PNPM_HOME", () => {
    expect(() => resolveOpenCodeCommand({
      platform: "win32",
      env: { PNPM_HOME: "C:\\pnpm" },
      existsImpl: () => true,
      readFileImpl: () => '@"%~dp0\\..\\global\\v11\\hash\\other\\opencode.exe" %*',
    })).toThrow("OPENCODE_BINARY_REJECTED");
  });

  test("rejects malformed argument arrays", () => {
    expect(() => parseArgs(null)).toThrow("INVALID_TASK_PACKET");
    expect(() => parseArgs(["--task-file", fixturePath("task.json"), "--dry-run", "--dry-run"]))
      .toThrow("INVALID_TASK_PACKET");
  });

  test("probes version, auth and refreshed models without a shell", () => {
    const execFileSyncImpl = jest.fn((command, args) => {
      if (args[0] === "--version") return "1.18.32\n";
      if (args[0] === "auth") return "Z.AI Coding Plan\n";
      return "zai-coding-plan/glm-5.3\n";
    });
    expect(probeOpenCode({ command: "opencode.cmd", execFileSyncImpl })).toEqual({
      version: "1.18.32",
      authSummary: "Z.AI Coding Plan",
      models: ["zai-coding-plan/glm-5.3"],
    });
    expect(execFileSyncImpl).toHaveBeenCalledTimes(3);
    for (const call of execFileSyncImpl.mock.calls) {
      expect(call[2]).toEqual(expect.objectContaining({ timeout: 120_000, shell: false }));
    }
  });

  test("strips ANSI but preserves distinct model IDs", () => {
    const output = "\u001b[32mzai-coding-plan/glm-5.3\u001b[0m\n" +
      "zai-coding-plan/glm-5.3-preview\nnot a model\n";
    expect(parseExactModels(output)).toEqual([
      "zai-coding-plan/glm-5.3",
      "zai-coding-plan/glm-5.3-preview",
    ]);
  });

  test("missing exact model does not spawn the worker", async () => {
    const deps = createExecutionDeps({
      probeOpenCodeImpl: () => ({
        version: "1.18.32",
        authSummary: "Z.AI Coding Plan",
        models: ["zai-coding-plan/glm-5.2", "zai-coding-plan/glm-5.3-preview"],
      }),
    });
    const result = await executeValidatedTask(createTask(), deps);
    expect(result.status).toBe("MODEL_NOT_AVAILABLE");
    expect(deps.runProcessImpl).not.toHaveBeenCalled();
  });

  test.each([
    [{ timedOut: true, code: 1, stdout: "", stderr: "" }, "TIMEOUT"],
    [{ timedOut: false, code: 7, stdout: "", stderr: "provider unauthorized" }, "PROVIDER_AUTH_REQUIRED"],
    [{ timedOut: false, code: 7, stdout: "", stderr: "model crashed" }, "WORKER_FAILED"],
  ])("maps process result %# to %s", async (processResult, expectedStatus) => {
    const deps = createExecutionDeps({
      runProcessImpl: jest.fn(async () => ({
        signal: null,
        outputTruncated: false,
        ...processResult,
      })),
    });
    await expect(executeValidatedTask(createTask(), deps))
      .resolves.toMatchObject({ status: expectedStatus });
  });

  test("does not promote a zero-change run", async () => {
    const deps = createExecutionDeps({ listChangedPathsImpl: () => [] });
    await expect(executeValidatedTask(createTask(), deps))
      .resolves.toMatchObject({ status: "NO_CHANGES" });
  });

  test("does not audit paths until the write window is stable", async () => {
    const listChangedPathsImpl = jest.fn();
    const deps = createExecutionDeps({
      waitForStableWriteImpl: async () => ({ stable: false, fingerprint: "moving" }),
      listChangedPathsImpl,
    });
    await expect(executeValidatedTask(createTask(), deps))
      .resolves.toMatchObject({ status: "WRITE_WINDOW_UNSTABLE" });
    expect(listChangedPathsImpl).not.toHaveBeenCalled();
  });

  test.each([
    [["package.json"], "SCOPE_VIOLATION"],
    [["build/app.apk"], "SCOPE_VIOLATION"],
    [[".env.production"], "SCOPE_VIOLATION"],
  ])("rejects unsafe changed paths %#", async (changedPaths, expectedStatus) => {
    const deps = createExecutionDeps({ listChangedPathsImpl: () => changedPaths });
    await expect(executeValidatedTask(createTask(), deps))
      .resolves.toMatchObject({ status: expectedStatus });
  });

  test("returns PASS_TO_REVIEW only after scope and diff checks", async () => {
    const deps = createExecutionDeps();
    const result = await executeValidatedTask(createTask(), deps);
    expect(result).toMatchObject({
      status: "PASS_TO_REVIEW",
      changedPaths: ["markdown/plans/proof.md"],
    });
    expect(deps.runGitDiffCheckImpl).toHaveBeenCalledWith(fixturePath("worktrees", "worker-smoke"));
  });

  test("passes an argument array and inline permissions without a shell", async () => {
    const deps = createExecutionDeps({
      env: {
        Path: "C:\\safe-bin",
        PNPM_HOME: "C:\\pnpm",
        USERPROFILE: "C:\\Users\\kona",
        RIOT_TOKEN: "riot-secret",
        OPENAI_API_KEY: "openai-secret",
      },
    });
    await executeValidatedTask(createTask(), deps);
    expect(deps.runProcessImpl).toHaveBeenCalledWith(expect.objectContaining({
      command: "opencode.cmd",
      cwd: fixturePath("worktrees", "worker-smoke"),
      args: expect.arrayContaining([
        "run",
        "--model",
        "zai-coding-plan/glm-5.3",
        "--agent",
        "codex-worker",
      ]),
      env: expect.objectContaining({ OPENCODE_PERMISSION: expect.any(String) }),
    }));
    const childEnv = deps.runProcessImpl.mock.calls[0][0].env;
    expect(childEnv).toMatchObject({
      Path: "C:\\safe-bin",
      PNPM_HOME: "C:\\pnpm",
      USERPROFILE: "C:\\Users\\kona",
    });
    expect(childEnv).not.toHaveProperty("RIOT_TOKEN");
    expect(childEnv).not.toHaveProperty("OPENAI_API_KEY");
  });

  test("resolves the CLI lazily only when no explicit executable is supplied", async () => {
    const lazyResolver = jest.fn(() => "C:\\pnpm\\opencode.exe");
    const explicitDeps = createExecutionDeps({
      openCodeCommand: "C:\\explicit\\opencode.exe",
      resolveOpenCodeCommandImpl: lazyResolver,
    });
    await executeValidatedTask(createTask(), explicitDeps);
    expect(lazyResolver).not.toHaveBeenCalled();

    const lazyDeps = createExecutionDeps({
      openCodeCommand: undefined,
      resolveOpenCodeCommandImpl: lazyResolver,
    });
    await executeValidatedTask(createTask(), lazyDeps);
    expect(lazyResolver).toHaveBeenCalledWith(expect.objectContaining({ env: lazyDeps.env }));
    expect(lazyDeps.runProcessImpl.mock.calls[0][0].command).toBe("C:\\pnpm\\opencode.exe");
  });

  test("dry-run validates preflight without spawning or claiming live execution", async () => {
    const deps = createExecutionDeps({ dryRun: true });
    const result = await executeValidatedTask(createTask(), deps);
    expect(result).toMatchObject({ status: "PASS_TO_REVIEW", dryRun: true });
    expect(deps.runProcessImpl).not.toHaveBeenCalled();
  });

  test("rejects a task whose plan is missing", async () => {
    const deps = createExecutionDeps({ planExistsImpl: () => false });
    await expect(executeValidatedTask(createTask(), deps)).rejects.toThrow("INVALID_TASK_PACKET");
    expect(deps.runProcessImpl).not.toHaveBeenCalled();
  });
});

describe("OpenCode runner evidence and CLI", () => {
  test("forwards only required system environment keys", () => {
    const result = buildWorkerEnvironment({
      Path: "C:\\bin",
      SystemRoot: "C:\\Windows",
      USERPROFILE: "C:\\Users\\kona",
      LOCALAPPDATA: "C:\\Users\\kona\\AppData\\Local",
      ZAI_API_KEY: "provider-secret",
      RIOT_TOKEN: "riot-secret",
      NODE_OPTIONS: "--require malicious.js",
    }, { edit: { "*": "deny" } });
    expect(result).toEqual({
      Path: "C:\\bin",
      SystemRoot: "C:\\Windows",
      USERPROFILE: "C:\\Users\\kona",
      LOCALAPPDATA: "C:\\Users\\kona\\AppData\\Local",
      OPENCODE_PERMISSION: JSON.stringify({ edit: { "*": "deny" } }),
    });
  });
  test("sanitizes auth and process canaries before evidence writes", async () => {
    const deps = createExecutionDeps({
      probeOpenCodeImpl: () => ({
        version: "1.18.32",
        authSummary: "authorization: Bearer auth-secret",
        models: ["zai-coding-plan/glm-5.3"],
      }),
      runProcessImpl: async () => ({
        code: 0,
        signal: null,
        timedOut: false,
        stdout: "Bearer stdout-secret",
        stderr: "{\"apiKey\":\"stderr-secret\"}",
        outputTruncated: false,
      }),
    });
    await executeValidatedTask(createTask(), deps);
    const serialized = JSON.stringify(deps.evidenceStore.writes);
    expect(serialized).not.toMatch(/auth-secret|stdout-secret|stderr-secret/);
    expect(serialized).toMatch(/redacted/);
  });

  test("main rejects relative task paths before reading files", async () => {
    const stderr = { write: jest.fn() };
    await expect(main(["--task-file", "relative.json"], { stderr, stdout: { write: jest.fn() } }))
      .resolves.toBe(1);
    expect(stderr.write).toHaveBeenCalledWith(expect.stringContaining("INVALID_TASK_PACKET"));
  });

  test("main classifies invalid JSON without leaking its content", async () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-runner-test-"));
    const taskPath = path.join(temporaryRoot, "task.json");
    fs.writeFileSync(taskPath, "{Bearer secret", "utf8");
    const stderr = { write: jest.fn() };
    await expect(main(["--task-file", taskPath], { stderr, stdout: { write: jest.fn() } }))
      .resolves.toBe(1);
    expect(JSON.stringify(stderr.write.mock.calls)).not.toContain("Bearer secret");
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  test("main classifies a missing task file as invalid input", async () => {
    const stderr = { write: jest.fn() };
    await expect(main(["--task-file", path.join(os.tmpdir(), "missing-task.json")], {
      stderr,
      stdout: { write: jest.fn() },
    })).resolves.toBe(1);
    expect(stderr.write).toHaveBeenCalledWith("OPENCODE_WORKER_STATUS=INVALID_TASK_PACKET\n");
  });

  test("loadTaskFile rejects empty and oversized files", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-packet-test-"));
    const empty = path.join(temporaryRoot, "empty.json");
    const large = path.join(temporaryRoot, "large.json");
    fs.writeFileSync(empty, "", "utf8");
    fs.writeFileSync(large, "x".repeat(1024 * 1024 + 1), "utf8");
    expect(() => loadTaskFile(empty)).toThrow("INVALID_TASK_PACKET");
    expect(() => loadTaskFile(large)).toThrow("INVALID_TASK_PACKET");
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  test("main prints a successful status and evidence path", async () => {
    const task = createTask();
    const stdout = { write: jest.fn() };
    const deps = createExecutionDeps({
      stdout,
      stderr: { write: jest.fn() },
      projectRoot: fixturePath("runner"),
      loadTaskFileImpl: () => task,
      validateTaskPacketImpl: (value) => value,
    });
    await expect(main(["--task-file", fixturePath("task.json")], deps)).resolves.toBe(0);
    expect(stdout.write).toHaveBeenCalledWith("OPENCODE_WORKER_STATUS=PASS_TO_REVIEW\n");
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining("OPENCODE_WORKER_EVIDENCE="));
  });
});
