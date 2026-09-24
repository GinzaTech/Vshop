import {
  clearRecoveryUpdateFailure,
  markRecoveryStartupFailure,
  runRecoveryUpdate,
  type RecoveryStorage,
  type RecoveryUpdateDependencies,
  type RecoveryUpdateState,
} from "~/utils/recovery-update";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

const ATTEMPT_KEY = "recovery-update-attempt-v1";

function createMemoryStorage(initial?: string): RecoveryStorage & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(ATTEMPT_KEY, initial);
  return {
    values,
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
}

function makeDependencies(
  options: {
    available?: boolean;
    currentVersion?: string;
    environment?: RecoveryUpdateDependencies["environment"];
    fetchIsNew?: boolean;
    latestVersion?: string;
    latestUrl?: string;
    rejectAt?: "check" | "fetch" | "reload" | "release";
    storageValue?: string;
    updateId?: string;
  } = {},
) {
  const storage = createMemoryStorage(options.storageValue);
  const updates = {
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => {
      if (options.rejectAt === "check") throw new Error("secret-check-token");
      return {
        isAvailable: options.available ?? true,
        manifest: { id: options.updateId ?? "update-b" },
      };
    }),
    fetchUpdateAsync: jest.fn(async () => {
      if (options.rejectAt === "fetch") throw new Error("secret-fetch-token");
      return { isNew: options.fetchIsNew ?? true };
    }),
    reloadAsync: jest.fn(async () => {
      if (options.rejectAt === "reload") throw new Error("secret-reload-token");
    }),
  };
  const dependencies: RecoveryUpdateDependencies = {
    currentVersion: options.currentVersion ?? "4.1.9",
    environment: options.environment ?? "standalone",
    getLatestRelease: jest.fn(async () => {
      if (options.rejectAt === "release") throw new Error("secret-release-token");
      return {
        version: options.latestVersion ?? "4.1.9",
        url:
          options.latestUrl ??
          "https://github.com/GinzaTech/Vshop/releases/latest",
      };
    }),
    storage,
    updates,
  };
  return { dependencies, storage, updates };
}

describe("recovery update", () => {
  it("checks, downloads, records and reloads a compatible OTA", async () => {
    const { dependencies, storage, updates } = makeDependencies();
    const states: RecoveryUpdateState[] = [];

    const result = await runRecoveryUpdate(dependencies, (state) => {
      states.push(state);
    });

    expect(states.map((state) => state.kind)).toEqual([
      "checking",
      "downloading",
      "restarting",
    ]);
    expect(result).toEqual({ kind: "restarting" });
    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.values.get(ATTEMPT_KEY) ?? "null")).toEqual({
      failures: 0,
      updateId: "update-b",
    });
  });

  it("blocks the same update after two startup failures", async () => {
    const { dependencies, updates } = makeDependencies({
      storageValue: JSON.stringify({ failures: 2, updateId: "update-b" }),
    });

    await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
      kind: "error",
      message:
        "This update failed to start more than once. Install a newer native release or retry later.",
    });
    expect(updates.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it("allows a different update after an older update failed", async () => {
    const { dependencies, updates } = makeDependencies({
      storageValue: JSON.stringify({ failures: 5, updateId: "update-a" }),
      updateId: "update-b",
    });

    await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
      kind: "restarting",
    });
    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it("preserves the prior failure count while retrying the same allowed update", async () => {
    const { dependencies, storage } = makeDependencies({
      storageValue: JSON.stringify({ failures: 1, updateId: "update-b" }),
    });

    await runRecoveryUpdate(dependencies, jest.fn());

    expect(JSON.parse(storage.values.get(ATTEMPT_KEY) ?? "null")).toEqual({
      failures: 1,
      updateId: "update-b",
    });
  });

  it.each([
    ["check", "Unable to check for updates right now."],
    ["fetch", "Unable to download the update right now."],
    ["reload", "The update downloaded but VShop could not restart."],
  ] as const)("returns a safe error when %s fails", async (stage, message) => {
    const { dependencies } = makeDependencies({ rejectAt: stage });

    const result = await runRecoveryUpdate(dependencies, jest.fn());

    expect(result).toEqual({ kind: "error", message });
    expect(JSON.stringify(result)).not.toContain("secret-");
  });

  it("returns up-to-date when no OTA or newer native release exists", async () => {
    const { dependencies } = makeDependencies({ available: false });

    await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
      kind: "up-to-date",
    });
  });

  it("returns the trusted native release when GitHub is newer", async () => {
    const { dependencies } = makeDependencies({
      available: false,
      latestVersion: "4.2.0",
    });

    await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
      kind: "native-update",
      releaseUrl: "https://github.com/GinzaTech/Vshop/releases/latest",
    });
  });

  it("rejects a lookalike native release URL", async () => {
    const { dependencies } = makeDependencies({
      available: false,
      latestUrl: "https://github.example/GinzaTech/Vshop/releases/latest",
      latestVersion: "4.2.0",
    });

    await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
      kind: "native-update",
      releaseUrl: "https://github.com/GinzaTech/Vshop/releases/latest",
    });
  });

  it("returns a safe error when neither OTA nor release metadata is available", async () => {
    const { dependencies } = makeDependencies({
      available: false,
      rejectAt: "release",
    });

    await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
      kind: "error",
      message: "Unable to check for updates right now.",
    });
  });

  it("returns a native fallback when OTA checking fails but GitHub is newer", async () => {
    const { dependencies } = makeDependencies({
      latestVersion: "4.2.0",
      rejectAt: "check",
    });

    await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
      kind: "native-update",
      releaseUrl: "https://github.com/GinzaTech/Vshop/releases/latest",
    });
  });

  it("does not reload when fetch reports no new update", async () => {
    const { dependencies, storage, updates } = makeDependencies({
      fetchIsNew: false,
    });

    await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
      kind: "up-to-date",
    });
    expect(updates.reloadAsync).not.toHaveBeenCalled();
    expect(storage.values.has(ATTEMPT_KEY)).toBe(false);
  });

  it("does not count transient download failures as startup failures", async () => {
    const { dependencies, storage, updates } = makeDependencies({
      rejectAt: "fetch",
    });

    await runRecoveryUpdate(dependencies, jest.fn());
    await runRecoveryUpdate(dependencies, jest.fn());

    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storage.values.get(ATTEMPT_KEY) ?? "null")).toEqual({
      failures: 0,
      updateId: "update-b",
    });
  });

  it("does not count a failed reload as a post-reload startup failure", async () => {
    const { dependencies, storage } = makeDependencies({
      rejectAt: "reload",
    });

    await runRecoveryUpdate(dependencies, jest.fn());

    expect(JSON.parse(storage.values.get(ATTEMPT_KEY) ?? "null")).toEqual({
      failures: 0,
      updateId: "update-b",
    });
  });

  it.each(["development", "expo-go", "web"] as const)(
    "fails closed in %s",
    async (environment) => {
      const { dependencies, updates } = makeDependencies({ environment });

      await expect(runRecoveryUpdate(dependencies, jest.fn())).resolves.toEqual({
        kind: "error",
        message: "Recovery updates are available only in an installed production build.",
      });
      expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
    },
  );

  it("ignores malformed attempt data", async () => {
    const { dependencies, updates } = makeDependencies({
      storageValue: "{broken",
    });

    await runRecoveryUpdate(dependencies, jest.fn());

    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it.each(["null", "{}"])(
    "ignores invalid structured attempt data: %s",
    async (storageValue) => {
      const { dependencies, updates } = makeDependencies({ storageValue });

      await runRecoveryUpdate(dependencies, jest.fn());

      expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    },
  );

  it("uses a stable fallback id when an available manifest has no id", async () => {
    const { dependencies, storage } = makeDependencies();
    jest.mocked(dependencies.updates!.checkForUpdateAsync).mockResolvedValue({
      isAvailable: true,
      manifest: null,
    });

    await runRecoveryUpdate(dependencies, jest.fn());

    expect(JSON.parse(storage.values.get(ATTEMPT_KEY) ?? "null")).toEqual({
      failures: 0,
      updateId: "unknown-update",
    });
  });

  it("marks startup failure and clears the guard after success", async () => {
    const storage = createMemoryStorage(
      JSON.stringify({ failures: 0, updateId: "update-b" }),
    );

    await markRecoveryStartupFailure(storage);
    expect(JSON.parse(storage.values.get(ATTEMPT_KEY) ?? "null")).toEqual({
      failures: 1,
      updateId: "update-b",
    });

    await clearRecoveryUpdateFailure(storage);
    expect(storage.values.has(ATTEMPT_KEY)).toBe(false);
  });

  it("does not create a failure marker when no update attempt exists", async () => {
    const storage = createMemoryStorage();

    await markRecoveryStartupFailure(storage);

    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
