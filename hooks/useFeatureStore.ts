import { create } from "zustand";

// --- Định nghĩa store quản lý các tính năng phụ trợ (Feature) ---
// Store nhỏ, KHÔNG persist: chỉ trạng thái UI trong phiên chạy hiện tại.
// screenshotModeEnabled: bật/tắt chế độ chụp màn hình ẩn thông tin nhạy cảm
//   (số dư, tên người dùng...) khi người dùng muốn share ảnh màn hình game.
// toggleScreenshotMode(): đảo ngược trạng thái screenshotModeEnabled
interface FeatureState {
  /** Bật/tắt chế độ chụp màn hình (ẩn dữ liệu nhạy cảm trên UI) */
  screenshotModeEnabled: boolean;
  /** Hàm toggle chế độ chụp màn hình (true <-> false) */
  toggleScreenshotMode: () => void;
}

// --- Tạo Zustand store ---
export const useFeatureStore = create<FeatureState>((set) => ({
  /** Khởi tạo: chế độ chụp màn hình tắt */
  screenshotModeEnabled: false,
  /** Action: đảo ngược giá trị screenshotModeEnabled */
  toggleScreenshotMode: () =>
    set((state) => ({ screenshotModeEnabled: !state.screenshotModeEnabled })),
}));
