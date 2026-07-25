import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { appStorage } from "~/utils/storage";

// --- Định nghĩa store quản lý danh sách yêu thích (wishlist) skin ---
// notificationEnabled: bật/tắt thông báo khi skin trong wishlist có trong shop (mặc định false)
// setNotificationEnabled(value): bật/tắt thông báo
// skinIds: mảng chứa UUID của các skin đã thêm vào wishlist
// toggleSkin(uuid): thêm skin nếu chưa có, xóa skin nếu đã có
interface WishlistState {
  /** Bật/tắt thông báo khi skin trong wishlist xuất hiện trong shop */
  notificationEnabled: boolean;
  /** Gán giá trị cho notificationEnabled */
  setNotificationEnabled: (value: boolean) => void;
  /** Danh sách UUID của các skin đang theo dõi */
  skinIds: string[];
  /** Thêm hoặc xóa một skin khỏi danh sách theo dõi (toggle) */
  toggleSkin: (uuid: string) => void;
}

// @ts-ignore
// --- Tạo Zustand store với persist (lưu xuống storage dưới key "wishlist") ---
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      /** Mặc định tắt thông báo */
      notificationEnabled: false,
      /** Action: cập nhật trạng thái thông báo */
      setNotificationEnabled: (value) => {
        set({ notificationEnabled: value });
      },
      /** Danh sách skin yêu thích — mặc định rỗng */
      skinIds: [],
      /**
       * Action toggle: nếu uuid đã có trong danh sách thì xóa, nếu chưa thì thêm vào.
       * @param uuid - UUID của skin cần toggle
       */
      toggleSkin: (uuid: string) =>
        set((state) => ({
          skinIds: state.skinIds.includes(uuid)
            ? state.skinIds.filter((el) => el !== uuid)
            : [...state.skinIds, uuid],
        })),
    }),
    {
      name: "wishlist",
      storage: createJSONStorage(() => appStorage),
    }
  )
);
