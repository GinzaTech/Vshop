// Import Platform từ React Native để kiểm tra hệ điều hành
import { Platform } from "react-native";

// Import hàm kiểm tra môi trường Expo Go
import { isExpoGo } from "./runtime";

// Định nghĩa kiểu cho module quản lý cookie của react-native-cookies
type CookieManagerModule = {
  // Hàm clearAll: xóa tất cả cookie, có tham số useWebKit (tùy chọn)
  clearAll?: (useWebKit?: boolean) => Promise<unknown> | unknown;
};

/**
 * loadCookieManager - Tải module @react-native-cookies/cookies
 * @returns {CookieManagerModule | null} Trả về đối tượng cookie manager nếu load thành công, null nếu thất bại
 */
const loadCookieManager = (): CookieManagerModule | null => {
  try {
    const cookieModule = require("@react-native-cookies/cookies");
    return cookieModule?.default ?? cookieModule ?? null;
  } catch {
    return null;
  }
};

/**
 * clearAllCookies - Xóa tất cả cookie trên thiết bị native, bỏ qua nếu là web hoặc Expo Go
 * @param {boolean} useWebKit - Có sử dụng WebKit để xóa cookie hay không (mặc định: true)
 * @returns {Promise<boolean>} Promise trả về true nếu xóa thành công, false nếu thất bại, đang ở web hoặc Expo Go
 */
export const clearAllCookies = async (useWebKit = true) => {
  // Bỏ qua nếu đang chạy trên web hoặc trong Expo Go
  if (Platform.OS === "web" || isExpoGo) {
    return false;
  }

  try {
    const cookieManager = loadCookieManager();
    // Nếu không load được module hoặc không có hàm clearAll thì thoát
    if (!cookieManager?.clearAll) {
      return false;
    }

    await cookieManager.clearAll(useWebKit);
    return true;
  } catch (error) {
    console.warn("[cookies] Failed to clear cookies.", error);
    return false;
  }
};
