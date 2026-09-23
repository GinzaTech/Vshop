import {
  isStartupCacheMetadataUsable,
  clearStartupCache,
  getStartupCacheFallback,
  markStartupCacheReady,
  STARTUP_CACHE_MAX_AGE_MS,
} from "~/utils/startup-cache";
import { getStoredItem, removeStoredItem, setStoredItem } from "~/utils/storage";
import { invalidateSessionOperations } from "~/utils/session-operations";

const mockMatchState = { authKey: "ap|player" };
const mockProfileState: { cacheByAuth: Record<string, { updatedAt: number }> } = {
  cacheByAuth: { "ap|player": { updatedAt: 1 } },
};

jest.mock("~/hooks/useMatchStore", () => ({
  useMatchStore: { getState: () => mockMatchState },
}));
jest.mock("~/hooks/useProfileCacheStore", () => ({
  useProfileCacheStore: { getState: () => mockProfileState },
}));
jest.mock("~/utils/storage", () => ({
  getStoredItem: jest.fn(),
  setStoredItem: jest.fn(),
  removeStoredItem: jest.fn(),
}));

describe("startup cache policy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchState.authKey = "ap|player";
    mockProfileState.cacheByAuth = { "ap|player": { updatedAt: 1 } };
    jest.mocked(getStoredItem).mockResolvedValue(JSON.stringify({
      accountKey: "ap|player", completedAt: Date.now(),
    }));
  });

  it.each([Infinity, NaN, -1, 0, 1_000_001])("rejects invalid or future timestamp %s", (completedAt) => {
    expect(isStartupCacheMetadataUsable({ accountKey: "ap|player", completedAt }, "ap|player", true, 1_000_000)).toBe(false);
  });

  it("accepts matching hydrated stores and recent metadata", async () => {
    await expect(getStartupCacheFallback({ id: "player", region: "ap" }))
      .resolves.toEqual({ completedAt: expect.any(Number) });
    mockMatchState.authKey = "eu|other";
    await expect(getStartupCacheFallback({ id: "player", region: "ap" }))
      .resolves.toBeNull();
    mockMatchState.authKey = "";
    mockProfileState.cacheByAuth = {};
    await expect(getStartupCacheFallback({ id: "player", region: "ap" }))
      .resolves.toBeNull();
  });

  it.each([null, "{broken", "null", "1", "{}", '{"accountKey":2,"completedAt":1}'])("rejects missing or corrupt disk metadata %s", async (raw) => {
    jest.mocked(getStoredItem).mockResolvedValueOnce(raw);
    await expect(getStartupCacheFallback({ id: "player", region: "ap" }))
      .resolves.toBeNull();
  });

  it("tolerates storage read failure", async () => {
    jest.mocked(getStoredItem).mockRejectedValueOnce(new Error("disk unavailable"));
    await expect(getStartupCacheFallback({ id: "player", region: "ap" }))
      .resolves.toBeNull();
  });

  it.each(["session", "profile", "matches"])("rechecks %s ownership after the asynchronous disk read", async (changed) => {
    let resolve!: (value: string) => void;
    jest.mocked(getStoredItem).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const reading = getStartupCacheFallback({ id: "player", region: "ap" });
    if (changed === "session") invalidateSessionOperations();
    if (changed === "profile") mockProfileState.cacheByAuth = {};
    if (changed === "matches") mockMatchState.authKey = "eu|other";
    resolve(JSON.stringify({ accountKey: "ap|player", completedAt: Date.now() }));
    await expect(reading).resolves.toBeNull();
  });

  it("does not write queued metadata after its session was invalidated", async () => {
    let resolve!: () => void;
    jest.mocked(setStoredItem).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const running = markStartupCacheReady({ id: "player", region: "ap" });
    await new Promise<void>((done) => setImmediate(done));
    const queued = markStartupCacheReady({ id: "other", region: "eu" });
    invalidateSessionOperations();
    resolve();
    await expect(running).resolves.toBe(true);
    await expect(queued).resolves.toBe(false);
    expect(setStoredItem).toHaveBeenCalledTimes(1);
  });

  it("accepts only a recent complete cache for the active account", () => {
    const now = 1_000_000;
    expect(
      isStartupCacheMetadataUsable(
        { accountKey: "ap|player", completedAt: now - 1_000 },
        "ap|player",
        true,
        now
      )
    ).toBe(true);
    expect(
      isStartupCacheMetadataUsable(
        { accountKey: "eu|other", completedAt: now - 1_000 },
        "ap|player",
        true,
        now
      )
    ).toBe(false);
    expect(
      isStartupCacheMetadataUsable(
        { accountKey: "ap|player", completedAt: now - STARTUP_CACHE_MAX_AGE_MS - 1 },
        "ap|player",
        true,
        now
      )
    ).toBe(false);
    expect(
      isStartupCacheMetadataUsable(
        { accountKey: "ap|player", completedAt: now - 1_000 },
        "ap|player",
        false,
        now
      )
    ).toBe(false);
  });

  it("offers an old complete same-account snapshot only as a maintenance fallback", async () => {
    const now = 10_000_000_000;
    const completedAt = now - STARTUP_CACHE_MAX_AGE_MS - 1;
    jest.mocked(getStoredItem).mockResolvedValueOnce(JSON.stringify({
      accountKey: "ap|player",
      completedAt,
    }));

    await expect(
      getStartupCacheFallback({ id: "player", region: "ap" }, now)
    ).resolves.toEqual({ completedAt });

    jest.mocked(getStoredItem).mockResolvedValueOnce(JSON.stringify({
      accountKey: "eu|other",
      completedAt,
    }));
    await expect(
      getStartupCacheFallback({ id: "player", region: "ap" }, now)
    ).resolves.toBeNull();
  });

  it("does not fail startup when the optional cache marker cannot be stored", async () => {
    jest.mocked(setStoredItem).mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      markStartupCacheReady({ id: "player", region: "ap" })
    ).resolves.toBe(false);
  });

  it("clears metadata after an already-running disk write finishes", async () => {
    let resolve!: () => void;
    const operations: string[] = [];
    jest.mocked(setStoredItem).mockImplementationOnce(async () => {
      await new Promise<void>((done) => { resolve = done; });
      operations.push("write");
    });
    jest.mocked(removeStoredItem).mockImplementationOnce(async () => { operations.push("remove"); });
    const writing = markStartupCacheReady({ id: "player", region: "ap" });
    await new Promise<void>((done) => setImmediate(done));
    const clearing = clearStartupCache();
    resolve();
    await Promise.all([writing, clearing]);
    expect(operations).toEqual(["write", "remove"]);
    expect(removeStoredItem).toHaveBeenCalledWith("startup-core-sync-v1");
  });
});
