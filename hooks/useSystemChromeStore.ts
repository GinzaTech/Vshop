import { create } from "zustand";

export type TopInsetTone = "light" | "dark";

/**
 * Trạng thái chia sẻ cho "chrome" hệ thống (status bar + navigation bar):
 * các screen đăng ký tone phù hợp với nền của chúng thay vì tự đổi style
 * native trực tiếp — một nơi quyết định, mọi screen nhận đồng bộ.
 */
type SystemChromeState = {
  /** Tone của icon/nội dung ở vùng status bar: "light" = icon sáng (nền tối). */
  topInsetTone: TopInsetTone;
  /** Đặt tone status bar cho vùng an toàn trên cùng. */
  setTopInsetTone: (tone: TopInsetTone) => void;
  /** Tone của thanh điều hướng (navigation) chính dưới cùng. */
  primaryNavigationTone: TopInsetTone;
  /** Đặt tone thanh điều hướng chính. */
  setPrimaryNavigationTone: (tone: TopInsetTone) => void;
  /** Ẩn thanh điều hướng chính khỏi cây accessibility (screen toàn màn hình). */
  primaryNavigationAccessibilityHidden: boolean;
  /** Bật/tắt ẩn accessibility cho thanh điều hướng chính. */
  setPrimaryNavigationAccessibilityHidden: (hidden: boolean) => void;
};

/**
 * Zustand store (không persist — chỉ trạng thái UI trong phiên chạy).
 * Mặc định: status bar tone "light", navigation tone "dark", không ẩn.
 */
export const useSystemChromeStore = create<SystemChromeState>((set) => ({
  topInsetTone: "light",
  setTopInsetTone: (topInsetTone) => set({ topInsetTone }),
  primaryNavigationTone: "dark",
  setPrimaryNavigationTone: (primaryNavigationTone) =>
    set({ primaryNavigationTone }),
  primaryNavigationAccessibilityHidden: false,
  setPrimaryNavigationAccessibilityHidden: (
    primaryNavigationAccessibilityHidden,
  ) => set({ primaryNavigationAccessibilityHidden }),
}));
