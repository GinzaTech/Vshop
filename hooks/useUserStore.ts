import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultUser } from "~/utils/valorant-api";
import { appStorage } from "~/utils/storage";

// --- Định nghĩa store quản lý thông tin user (phiên đăng nhập) ---
// user: đối tượng user hiện tại (token, region, id...) — mặc định là defaultUser
// hydrated: đánh dấu đã rehydrate dữ liệu từ storage xong (dùng để tránh render sớm)
// setUser(user): cập nhật user mới
// resetUser(): reset user về defaultUser
// setHydrated(hydrated): cập nhật trạng thái hydrated
interface UserState {
  /** Thông tin user hiện tại (bao gồm token, region, id...) */
  user: typeof defaultUser;
  /** Đã rehydrate từ storage xong chưa (true sau khi persist load lại) */
  hydrated: boolean;
  /** Cập nhật thông tin user */
  setUser: (user: typeof defaultUser) => void;
  /** Reset user về giá trị mặc định */
  resetUser: () => void;
  /** Đánh dấu trạng thái hydrated */
  setHydrated: (hydrated: boolean) => void;
}

// --- Tạo Zustand store với persist (lưu user xuống storage dưới key "user-session") ---
// Chỉ persist user (không persist hydrated flag)
// Khi rehydrate xong, tự động setHydrated(true) để thông báo cho toàn app
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      /** User mặc định (chưa đăng nhập) */
      user: defaultUser,
      /** Chưa rehydrate */
      hydrated: false,
      /** Gán user mới */
      setUser: (user) => set({ user }),
      /** Reset về user mặc định */
      resetUser: () => set({ user: defaultUser }),
      /** Cập nhật trạng thái hydrated */
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "user-session",
      storage: createJSONStorage(() => appStorage),
      /** Chỉ lưu trường user xuống storage */
      partialize: (state) => ({ user: state.user }),
      /** Sau khi rehydrate từ storage, đánh dấu hydrated = true */
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
