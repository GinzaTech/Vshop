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
