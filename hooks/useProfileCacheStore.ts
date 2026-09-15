import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ProfileWarmCache } from "~/utils/profile-cache";
import { appStorage } from "~/utils/storage";

// Số lượng profile cache tối đa được lưu (giữ 3 auth gần nhất — đủ cho việc
// quay lại tài khoản vừa switch mà không phải fetch lại từ đầu).
const MAX_PROFILE_CACHES = 3;

// --- Định nghĩa store quản lý cache profile (làm ấm dữ liệu profile) ---
// Persist xuống appStorage (không secure — chỉ dữ liệu profile công khai).
// authKey của ProfileWarmCache được dùng làm key tra cứu: mỗi tài khoản một
// slot, giúp switch account hiển thị ngay dữ liệu cũ trong lúc làm mới.
// cacheByAuth: object lưu cache theo authKey (authKey -> ProfileWarmCache)
// setProfileCache(cache): thêm/cập nhật cache, tự động xóa entry cũ nhất nếu vượt quá MAX_PROFILE_CACHES
// resetProfileCache(): xóa toàn bộ cache
interface ProfileCacheState {
  /** Cache profile theo authKey (dữ liệu đã được làm ấm từ lần đăng nhập trước) */
  cacheByAuth: Record<string, ProfileWarmCache>;
  /** Thêm hoặc cập nhật cache, giới hạn số lượng entry, sắp xếp theo updatedAt giảm dần */
  setProfileCache: (cache: ProfileWarmCache) => void;
  /** Reset toàn bộ cache về rỗng (gọi khi sign-out để tránh lộ dữ liệu) */
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
