import { create } from "zustand";

// --- Định nghĩa store quản lý các tính năng phụ trợ (Feature) ---
// screenshotModeEnabled: bật/tắt chế độ chụp màn hình (mặc định false)
// toggleScreenshotMode(): đảo ngược trạng thái screenshotModeEnabled
interface FeatureState {
  /** Bật/tắt chế độ chụp màn hình */
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
