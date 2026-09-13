/**
 * startup-cache.ts — Dấu mốc "khởi động đã sync xong" cho từng tài khoản.
 *
 * Sau khi data-sync hoàn tất (profile + matches + shop...), metadata được
 * ghi xuống storage. Lần khởi động kế tiếp của CÙNG tài khoản, nếu metadata
 * còn hạn (72h) và profile cache còn dùng được, app có thể bỏ qua full sync
 * và render ngay từ persisted cache.
 */

import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { getAccountSessionKey } from "~/utils/saved-accounts";
import { getStoredItem, setStoredItem } from "~/utils/storage";

// Key lưu metadata trong storage.
const STARTUP_CACHE_KEY = "startup-core-sync-v1";
// Tuổi tối đa của metadata: 72 giờ. Quá hạn thì coi như chưa từng sync.
export const STARTUP_CACHE_MAX_AGE_MS = 72 * 60 * 60 * 1000;

/**
 * StartupCacheMetadata - Dấu mốc sync khởi động của một tài khoản.
 * @property {string} accountKey - Khóa tài khoản ("region|id")
 * @property {number} completedAt - Thời điểm sync hoàn tất (timestamp ms)
 */
export type StartupCacheMetadata = {
  accountKey: string;
  completedAt: number;
};

// Dữ liệu tối thiểu để xác định tài khoản khi mark/đọc cache.
type StartupAccount = {
  id: string;
  region: string;
};

/**
 * isStartupCacheMetadataUsable — Metadata startup có còn dùng được không.
 * Điều kiện: có metadata, khớp accountKey hiện tại, completedAt hợp lệ,
 * chưa quá 72h và profile cache (in-memory) vẫn có dữ liệu.
 * @param {StartupCacheMetadata | null} metadata - Metadata đọc từ storage
 * @param {string} accountKey - Khóa tài khoản hiện tại
 * @param {boolean} hasProfileCache - Profile cache của tài khoản còn tồn tại không
 * @param {number} [now] - Thời điểm đối chiếu (mặc định Date.now())
 * @returns {boolean} true nếu có thể bỏ qua full sync ở lần khởi động này
 */
export const isStartupCacheMetadataUsable = (
  metadata: StartupCacheMetadata | null,
  accountKey: string,
  hasProfileCache: boolean,
  now = Date.now()
) =>
  Boolean(
    metadata &&
      metadata.accountKey === accountKey &&
      metadata.completedAt > 0 &&
      now - metadata.completedAt <= STARTUP_CACHE_MAX_AGE_MS &&
      hasProfileCache
  );

/**
 * readMetadata — Đọc và validate metadata startup từ storage (JSON).
 * @returns {Promise<StartupCacheMetadata | null>} Metadata nếu dữ liệu hợp lệ,
 *   hoặc null nếu thiếu/hỏng (storage lỗi, JSON sai, thiếu trường...)
 */
const readMetadata = async (): Promise<StartupCacheMetadata | null> => {
  try {
    const raw = await getStoredItem(STARTUP_CACHE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<StartupCacheMetadata>;
    return typeof candidate.accountKey === "string" &&
      typeof candidate.completedAt === "number"
      ? { accountKey: candidate.accountKey, completedAt: candidate.completedAt }
      : null;
  } catch {
    return null;
  }
};

/**
 * markStartupCacheReady — Ghi dấu "khởi động đã sync xong" cho tài khoản
 * (được data-sync gọi sau khi mọi nguồn lõi thành công). Lỗi storage không
 * được làm hỏng một sync thành công nên hàm nuốt lỗi và trả false.
 * @param {StartupAccount} account - Tài khoản vừa hoàn tất sync
 * @returns {Promise<boolean>} true nếu ghi thành công, false nếu storage lỗi
 */
export const markStartupCacheReady = async (account: StartupAccount) => {
  try {
    const metadata: StartupCacheMetadata = {
      accountKey: getAccountSessionKey(account),
      completedAt: Date.now(),
    };
    await setStoredItem(STARTUP_CACHE_KEY, JSON.stringify(metadata));
    return true;
  } catch {
    // Cache eligibility is optional. A storage failure must not turn a fully
    // successful authenticated sync into a startup failure.
    return false;
  }
};

/**
 * hasUsableStartupCache — Kiểm tra tổng hợp: match cache trong store có thuộc
 * tài khoản hiện tại không (authKey trống hoặc khớp) VÀ metadata còn hạn.
 * Dùng ở AppWarmup để quyết định có bỏ qua full sync hay không.
 * @param {StartupAccount} account - Tài khoản cần kiểm tra
 * @returns {Promise<boolean>} true nếu cache khởi động còn dùng được
 */
export const hasUsableStartupCache = async (account: StartupAccount) => {
  const accountKey = getAccountSessionKey(account);
  const profileCache = useProfileCacheStore.getState().cacheByAuth[accountKey];
  const matchState = useMatchStore.getState();
  const matchCacheBelongsToAccount =
    !matchState.authKey || matchState.authKey === accountKey;

  return (
    matchCacheBelongsToAccount &&
    isStartupCacheMetadataUsable(
      await readMetadata(),
      accountKey,
      Boolean(profileCache?.updatedAt)
    )
  );
};
