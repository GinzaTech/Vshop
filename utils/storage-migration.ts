/** Giá trị lưu trong storage: chuỗi, hoặc null khi key không tồn tại. */
export type StorageValue = string | null;

/**
 * AppStorage - Interface storage tối thiểu dùng chung cho app (tương thích
 * AsyncStorage và MMKV adapter). Mỗi method có thể trả về trực tiếp (MMKV
 * đồng bộ) hoặc Promise (AsyncStorage).
 */
export type AppStorage = {
  getItem: (key: string) => Promise<StorageValue> | StorageValue;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

/**
 * withLegacyMigration — Bọc storage đích với migration đọc-qua (read-through)
 * từ storage cũ: getItem đọc target trước, miss thì đọc fallback, sao chép
 * giá trị sang target rồi XOÁ bản plaintext cũ trên fallback (chuyển dần dữ
 * liệu AsyncStorage cũ sang MMKV mã hoá mà không mất dữ liệu).
 * @param {AppStorage} target - Storage đích (mới), nơi dữ liệu được chuẩn hoá về
 * @param {AppStorage} fallback - Storage cũ, chỉ đọc để migrate rồi xoá key
 * @returns {AppStorage} Storage wrapper có hành vi migration tự động
 */
export const withLegacyMigration = (
  target: AppStorage,
  fallback: AppStorage
): AppStorage => {
  const revisions = new Map<string, number>();
  const writes = new Map<string, Promise<unknown>>();
  const revision = (key: string) => revisions.get(key) ?? 0;
  const invalidate = (key: string) => revisions.set(key, revision(key) + 1);
  const enqueue = <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    const result = (writes.get(key) ?? Promise.resolve()).then(operation);
    const tail = result.catch(() => undefined);
    writes.set(key, tail);
    void tail.then(() => { if (writes.get(key) === tail) writes.delete(key); });
    return result;
  };

  return {
    getItem: async (key) => {
      const startedAt = revision(key);
      const isCurrent = () => revision(key) === startedAt;
      await writes.get(key);
      if (!isCurrent()) return null;
      const current = await target.getItem(key);
      if (!isCurrent()) return null;
      if (current !== null) return current;

      const legacy = await fallback.getItem(key);
      if (!isCurrent() || legacy === null) return null;
      // Serialize copying with user writes/removals. A late migration cannot
      // resurrect a logged-out session, including when its disk write started.
      await enqueue(key, async () => {
        if (!isCurrent()) return;
        await target.setItem(key, legacy);
        await fallback.removeItem(key);
      });
      return isCurrent() ? legacy : null;
    },
    setItem: (key, value) => {
      invalidate(key);
      return enqueue(key, async () => { await target.setItem(key, value); });
    },
    removeItem: (key) => {
      invalidate(key);
      return enqueue(key, async () => {
        await Promise.all([target.removeItem(key), fallback.removeItem(key)]);
      });
    },
  };
};
