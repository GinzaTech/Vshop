import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultUser } from "~/utils/valorant-api";
import { shouldAcceptSessionUpdate } from "~/utils/saved-accounts";
import { secureAppStorage } from "~/utils/storage";

// --- Định nghĩa store quản lý thông tin user (phiên đăng nhập) ---
// Persist xuống secureAppStorage vì user chứa access/id/entitlements token.
// user: đối tượng user hiện tại (token, region, id...) — mặc định là defaultUser
// hydrated: đánh dấu đã rehydrate dữ liệu từ storage xong (dùng để tránh render sớm)
// setUser(user): cập nhật user mới — CHỈ nhận khi request vẫn thuộc phiên hiện
//   tại (shouldAcceptSessionUpdate): kết quả của request nền cũ không được
//   ghi đè lên phiên vừa đổi tài khoản.
// activateUser(user): gán không điều kiện — chỉ dùng cho login/chuyển phiên
//   CÓ CHỦ ĐÍCH (caller đã xác nhận người dùng muốn thay phiên hiện tại).
// resetUser(): reset user về defaultUser
// setHydrated(hydrated): cập nhật trạng thái hydrated
interface UserState {
  /** Thông tin user hiện tại (bao gồm token, region, id...) */
  user: typeof defaultUser;
  /** Đã rehydrate từ storage xong chưa (true sau khi persist load lại) */
  hydrated: boolean;
  /** Cập nhật thông tin user (có guard theo phiên — xem ghi chú interface) */
  setUser: (user: typeof defaultUser) => void;
  /** Chuyển phiên có chủ đích sau login hoặc chọn tài khoản đã lưu */
  activateUser: (user: typeof defaultUser) => void;
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
      /** Gán dữ liệu mới chỉ khi request vẫn thuộc phiên hiện tại */
      setUser: (user) =>
        set((state) =>
          shouldAcceptSessionUpdate(state.user.id, user.id)
            ? { user }
            : state
        ),
      /** Cho phép login/chuyển tài khoản thay toàn bộ phiên hiện tại */
      activateUser: (user) => set({ user }),
      /** Reset về user mặc định */
      resetUser: () => set({ user: defaultUser }),
      /** Cập nhật trạng thái hydrated */
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "user-session",
      storage: createJSONStorage(() => secureAppStorage),
      /** Chỉ lưu trường user xuống storage */
      partialize: (state) => ({ user: state.user }),
      /** Sau khi rehydrate từ storage, đánh dấu hydrated = true */
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
