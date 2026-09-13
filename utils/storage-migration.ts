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
