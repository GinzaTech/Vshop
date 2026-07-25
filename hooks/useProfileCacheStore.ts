import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ProfileWarmCache } from "~/utils/profile-cache";
import { appStorage } from "~/utils/storage";

// Số lượng profile cache tối đa được lưu (giữ 3 auth gần nhất)
const MAX_PROFILE_CACHES = 3;

// --- Định nghĩa store quản lý cache profile (làm ấm dữ liệu profile) ---
// cacheByAuth: object lưu cache theo authKey (authKey -> ProfileWarmCache)
// setProfileCache(cache): thêm/cập nhật cache, tự động xóa entry cũ nhất nếu vượt quá MAX_PROFILE_CACHES
// resetProfileCache(): xóa toàn bộ cache
interface ProfileCacheState {
  /** Cache profile theo authKey */
  cacheByAuth: Record<string, ProfileWarmCache>;
  /** Thêm hoặc cập nhật cache, giới hạn số lượng entry, sắp xếp theo updatedAt giảm dần */
  setProfileCache: (cache: ProfileWarmCache) => void;
  /** Reset toàn bộ cache về rỗng */
  resetProfileCache: () => void;
}

// --- Tạo Zustand store với persist (lưu xuống storage dưới key "profile-warm-cache") ---
export const useProfileCacheStore = create<ProfileCacheState>()(
  persist(
    (set) => ({
      /** Khởi tạo: cache rỗng */
      cacheByAuth: {},
      /**
       * Thêm cache mới, sắp xếp theo thời gian cập nhật (mới nhất trước),
       * chỉ giữ lại MAX_PROFILE_CACHES entry.
       * @param cache - đối tượng ProfileWarmCache cần lưu
       */
      setProfileCache: (cache) =>
        set((state) => {
          const nextCache = {
            ...state.cacheByAuth,
            [cache.authKey]: cache,
          };
          const cacheByAuth = Object.fromEntries(
            Object.entries(nextCache)
              .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
              .slice(0, MAX_PROFILE_CACHES)
          );

          return { cacheByAuth };
        }),
      /** Xóa toàn bộ cache profile */
      resetProfileCache: () => set({ cacheByAuth: {} }),
    }),
    {
      name: "profile-warm-cache",
      storage: createJSONStorage(() => appStorage),
      /** Chỉ persist cacheByAuth (không lưu hàm) */
      partialize: (state) => ({ cacheByAuth: state.cacheByAuth }),
    }
  )
);
