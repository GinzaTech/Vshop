/* eslint-env jest, node */

const {
  RESULT_STATUS,
  WorkerPolicyError,
  buildPermissionPolicy,
  buildWorkerPrompt,
  classifyChangedPaths,
  redactEvidence,
  validateTaskPacket,
} = require("../scripts/lib/opencode-worker-policy.cjs");

const mainCheckout = "C:\\Users\\kona\\Desktop\\Project\\Vshop";

const createPacket = () => ({
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

const capturePolicyError = (run) => {
  try {
    run();
    throw new Error("EXPECTED_POLICY_ERROR");
  } catch (error) {
    return error;
  }
};

describe("OpenCode worker task packet", () => {
  test("accepts and deeply freezes the complete contract", () => {
    const result = validateTaskPacket(createPacket(), { mainCheckout });
    expect(result.model).toBe("zai-coding-plan/glm-5.3");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.allowedPaths)).toBe(true);
    expect(Object.isFrozen(result.allowedPaths[0])).toBe(true);
    expect(Object.isFrozen(result.targetedCommands[0].args)).toBe(true);
  });

  test("exposes every fail-closed status", () => {
    expect(RESULT_STATUS).toEqual(expect.objectContaining({
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
    }));
    expect(Object.isFrozen(RESULT_STATUS)).toBe(true);
  });

  test.each([
    "C:/absolute.ts",
    "../escape.ts",
    "services\\mixed.ts",
    "//server/share.ts",
    "services//double.ts",
    ".env",
    ".env.production",
    "android/release.jks",
    "credentials.json",
  ])("rejects unsafe scope path %s", (value) => {
    const packet = createPacket();
    packet.allowedPaths = [value];
    expect(capturePolicyError(() => validateTaskPacket(packet, { mainCheckout })))
      .toMatchObject({ name: "WorkerPolicyError", code: "PATH_REJECTED" });
  });

  test.each([
    "zai-coding-plan/glm-5.2",
    "zai-coding-plan/glm-5.3-preview",
    "glm-5.3",
    "zai-coding-plan/GLM 5.3",
  ])("rejects non-exact model %s", (model) => {
    const packet = createPacket();
    packet.model = model;
    expect(capturePolicyError(() => validateTaskPacket(packet, { mainCheckout })))
      .toMatchObject({ code: "MODEL_REJECTED" });
  });

  test("rejects the main checkout and unknown fields", () => {
    const mainPacket = createPacket();
    mainPacket.workspace = mainCheckout;
    expect(capturePolicyError(() => validateTaskPacket(mainPacket, { mainCheckout })))
      .toMatchObject({ code: "MAIN_CHECKOUT_REJECTED" });

    const unknownPacket = createPacket();
    unknownPacket.unplannedAuthority = true;
    expect(capturePolicyError(() => validateTaskPacket(unknownPacket, { mainCheckout })))
      .toMatchObject({ code: "TASK_PACKET_REJECTED" });
  });

  test("rejects overlapping allowed and protected scope", () => {
    const packet = createPacket();
    packet.allowedPaths = ["services/profile/cache.ts"];
    packet.protectedPaths = ["services/profile/**"];
    expect(capturePolicyError(() => validateTaskPacket(packet, { mainCheckout })))
      .toMatchObject({ code: "SCOPE_OVERLAP" });
  });

  test.each([
    ["schemaVersion", 2, "SCHEMA_VERSION_REJECTED"],
    ["workspace", "relative/worktree", "WORKSPACE_REJECTED"],
    ["allowedPaths", [], "ALLOWED_PATHS_REQUIRED"],
    ["protectedPaths", null, "PROTECTED_PATHS_REJECTED"],
    ["acceptanceCriteria", [], "ACCEPTANCE_REJECTED"],
    ["targetedCommands", null, "COMMAND_REJECTED"],
    ["taskId", "Bad Task", "TASK_ID_REJECTED"],
    ["planPath", "markdown/plans/**", "PLAN_PATH_REJECTED"],
    ["title", " ", "TITLE_REJECTED"],
  ])("rejects invalid %s", (field, value, code) => {
    const invalidPacket = createPacket();
    invalidPacket[field] = value;
    expect(capturePolicyError(() => validateTaskPacket(invalidPacket, { mainCheckout })))
      .toMatchObject({ code });
  });

  test("rejects a non-absolute or absent main checkout", () => {
    expect(capturePolicyError(() => validateTaskPacket(createPacket(), {
      mainCheckout: "relative",
    }))).toMatchObject({ code: "MAIN_CHECKOUT_REJECTED" });
    expect(capturePolicyError(() => validateTaskPacket(createPacket())))
      .toMatchObject({ code: "MAIN_CHECKOUT_REJECTED" });
  });

  test.each([
    { executable: "pnpm", args: ["run", "check"] },
    { executable: "pnpm", args: ["exec", "eslint", "scripts/file.cjs", "--max-warnings=0"] },
    { executable: "pnpm", args: ["exec", "tsc", "--noEmit"] },
  ])("accepts safe command %#", (command) => {
    const safePacket = createPacket();
    safePacket.targetedCommands = [command];
    expect(validateTaskPacket(safePacket, { mainCheckout }).targetedCommands[0])
      .toEqual(command);
  });

  test.each([
    [0, 2, "TIMEOUT_REJECTED"],
    [121, 2, "TIMEOUT_REJECTED"],
    [45, -1, "REPAIR_ROUNDS_REJECTED"],
    [45, 3, "REPAIR_ROUNDS_REJECTED"],
  ])("rejects timeout=%s repairs=%s", (timeoutMinutes, maxRepairRounds, code) => {
    const packet = createPacket();
    packet.timeoutMinutes = timeoutMinutes;
    packet.maxRepairRounds = maxRepairRounds;
    expect(capturePolicyError(() => validateTaskPacket(packet, { mainCheckout })))
      .toMatchObject({ code });
  });

  test.each([
    { executable: "powershell", args: ["-EncodedCommand", "AAAA"] },
    { executable: "pnpm", args: ["add", "left-pad"] },
    { executable: "pnpm", args: ["exec", "jest", "x.test.ts;git", "push"] },
    { executable: "pnpm", args: ["exec", "expo", "publish"] },
    { executable: "pnpm", args: ["run", "check", "extra"] },
    { executable: "pnpm", args: ["exec", "eslint", ".", "--fix"] },
    { executable: "pnpm", args: ["exec", "eslint", ".", "--fix-dry-run"] },
  ])("rejects unsafe command %#", (command) => {
    const packet = createPacket();
    packet.targetedCommands = [command];
    expect(capturePolicyError(() => validateTaskPacket(packet, { mainCheckout })))
      .toMatchObject({ code: "COMMAND_REJECTED" });
  });
});

describe("OpenCode worker permissions and evidence", () => {
  test("orders broad denies before exact edit and command allows", () => {
    const task = validateTaskPacket(createPacket(), { mainCheckout });
    const permission = buildPermissionPolicy(task);
    expect(Object.entries(permission.edit)[0]).toEqual(["*", "deny"]);
    expect(permission.edit["services/profile/cache.ts"]).toBe("allow");
    expect(permission.bash["git push*"]).toBe("deny");
    expect(permission.bash["rg *"]).toBeUndefined();
    expect(permission.bash[
      "pnpm exec jest __tests__/profile-cache.test.ts --runInBand"
    ]).toBe("allow");
    expect(permission.external_directory).toBe("deny");
    expect(permission.task).toBe("deny");
  });

  test("classifies exact, protected and out-of-scope paths", () => {
    const task = validateTaskPacket(createPacket(), { mainCheckout });
    expect(classifyChangedPaths([
      "services/profile/cache.ts",
      "__tests__/profile-cache.test.ts",
      "services/profile/credentials.ts",
      "package.json",
      "services/profile/cache.ts",
    ], task)).toEqual({
      allowed: ["__tests__/profile-cache.test.ts", "services/profile/cache.ts"],
      violations: ["package.json", "services/profile/credentials.ts"],
    });
  });

  test("builds a bounded prompt without secret material", () => {
    const task = validateTaskPacket(createPacket(), { mainCheckout });
    const prompt = buildWorkerPrompt(task);
    expect(prompt).toContain("Read AGENTS.md and the plan before editing.");
    expect(prompt).toContain("Do not commit, push, merge, release");
    expect(prompt).toContain("pnpm exec jest __tests__/profile-cache.test.ts --runInBand");
    expect(prompt).not.toMatch(/api[_-]?key|Bearer /i);
  });

  test("redacts nested authorization, cookie, key and JWT canaries", () => {
    const evidence = redactEvidence({
      nested: {
        authorization: "Bearer worker-secret",
        cookie: "ssid=cookie-secret",
        apiKey: "key-secret",
        sampleJwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
      },
    });
    expect(evidence).not.toMatch(/worker-secret|cookie-secret|key-secret|eyJhbGci/);
    expect(evidence).toMatch(/<redacted/);
  });

  test("uses typed policy errors", () => {
    const error = capturePolicyError(() => validateTaskPacket(null, { mainCheckout }));
    expect(error).toBeInstanceOf(WorkerPolicyError);
    expect(error.code).toBe("TASK_PACKET_REJECTED");
  });

  test("rejects non-array changed paths and classifies malformed entries", () => {
    const task = validateTaskPacket(createPacket(), { mainCheckout });
    expect(capturePolicyError(() => classifyChangedPaths(null, task)))
      .toMatchObject({ code: "CHANGED_PATHS_REJECTED" });
    expect(classifyChangedPaths(["services/profile/**", "../escape.ts"], task))
      .toEqual({
        allowed: [],
        violations: ["../escape.ts", "services/profile/**"],
      });
  });

  test("redacts unserializable and empty evidence safely", () => {
    expect(redactEvidence({ value: 1n })).toBe("<unserializable-evidence>");
    expect(redactEvidence(undefined)).toBe("");
  });

  test("redacts raw credential headers and assignments", () => {
    const evidence = redactEvidence([
      "Cookie: cookie-secret",
      "X-Riot-Entitlements-JWT: entitlement-secret",
      "api_key=api-secret",
      "password: password-secret",
    ].join("\n"));
    expect(evidence).not.toMatch(/cookie-secret|entitlement-secret|api-secret|password-secret/);
    expect(evidence.match(/<redacted>/g)).toHaveLength(4);
  });
});
