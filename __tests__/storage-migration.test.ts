import {
  type AppStorage,
  withLegacyMigration,
} from "~/utils/storage-migration";

const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  const storage: AppStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  return { storage, values };
};

describe("storage migration", () => {
  it("does not resurrect a removed session when a legacy read completes late", async () => {
    const encrypted = createMemoryStorage();
    let resolve!: (value: string) => void;
    const legacy = createMemoryStorage();
    legacy.storage.getItem = () => new Promise<string>((done) => { resolve = done; });
    const storage = withLegacyMigration(encrypted.storage, legacy.storage);
    const reading = storage.getItem("user-session");
    await new Promise<void>((done) => setImmediate(done));
    await storage.removeItem("user-session");
    resolve("old-session");
    await expect(reading).resolves.toBeNull();
    expect(encrypted.values.has("user-session")).toBe(false);
  });

  it("does not hydrate an old value after a new store snapshot was written", async () => {
    const encrypted = createMemoryStorage();
    let resolve!: (value: string) => void;
    encrypted.storage.getItem = () => new Promise<string>((done) => { resolve = done; });
    const storage = withLegacyMigration(encrypted.storage, createMemoryStorage().storage);
    const reading = storage.getItem("match-history-cache");
    await new Promise<void>((done) => setImmediate(done));
    await storage.setItem("match-history-cache", "empty-after-logout");
    resolve("old-account-matches");
    await expect(reading).resolves.toBeNull();
    expect(encrypted.values.get("match-history-cache")).toBe("empty-after-logout");
  });

  it("serializes logout behind an already-started migration copy", async () => {
    const encrypted = createMemoryStorage();
    const legacy = createMemoryStorage({ account: "old" });
    let finish!: () => void;
    encrypted.storage.setItem = async (key, value) => {
      await new Promise<void>((done) => { finish = done; });
      encrypted.values.set(key, value);
    };
    const storage = withLegacyMigration(encrypted.storage, legacy.storage);
    const reading = storage.getItem("account");
    await new Promise<void>((done) => setImmediate(done));
    const removing = storage.removeItem("account");
    finish();
    await removing;
    await expect(reading).resolves.toBeNull();
    expect(encrypted.values.has("account")).toBe(false);
  });

  it("copies a legacy session once and removes its plaintext source", async () => {
    const encrypted = createMemoryStorage();
    const legacy = createMemoryStorage({ "user-session": "legacy-session" });
    const storage = withLegacyMigration(encrypted.storage, legacy.storage);

    await expect(storage.getItem("user-session")).resolves.toBe(
      "legacy-session"
    );
    expect(encrypted.values.get("user-session")).toBe("legacy-session");
    expect(legacy.values.has("user-session")).toBe(false);
  });

  it("does not overwrite an existing encrypted value", async () => {
    const encrypted = createMemoryStorage({ "user-session": "encrypted" });
    const legacy = createMemoryStorage({ "user-session": "legacy" });
    const storage = withLegacyMigration(encrypted.storage, legacy.storage);

    await expect(storage.getItem("user-session")).resolves.toBe("encrypted");
    expect(legacy.values.get("user-session")).toBe("legacy");
  });

  it("removes a key from both current and legacy stores", async () => {
    const encrypted = createMemoryStorage({ account: "encrypted" });
    const legacy = createMemoryStorage({ account: "legacy" });
    const storage = withLegacyMigration(encrypted.storage, legacy.storage);

    await storage.removeItem("account");
    expect(encrypted.values.has("account")).toBe(false);
    expect(legacy.values.has("account")).toBe(false);
  });

  it("writes new values only to the current store", async () => {
    const encrypted = createMemoryStorage();
    const legacy = createMemoryStorage();
    const storage = withLegacyMigration(encrypted.storage, legacy.storage);

    await storage.setItem("account", "current");
    expect(encrypted.values.get("account")).toBe("current");
    expect(legacy.values.has("account")).toBe(false);
    await expect(storage.getItem("missing")).resolves.toBeNull();
  });
});
