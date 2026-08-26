export type StorageValue = string | null;

export type AppStorage = {
  getItem: (key: string) => Promise<StorageValue> | StorageValue;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

/** Read-through migration that deletes plaintext legacy data after copying. */
export const withLegacyMigration = (
  target: AppStorage,
  fallback: AppStorage
): AppStorage => ({
  getItem: async (key) => {
    const current = await target.getItem(key);
    if (current !== null) return current;

    const legacy = await fallback.getItem(key);
    if (legacy === null) return null;

    await target.setItem(key, legacy);
    await fallback.removeItem(key);
    return legacy;
  },
  setItem: (key, value) => target.setItem(key, value),
  removeItem: async (key) => {
    await target.removeItem(key);
    await fallback.removeItem(key);
  },
});
