// Import hàm kiểm tra môi trường Expo Go từ module runtime
import { isExpoGo } from "./runtime";

// Định nghĩa kiểu cho module quản lý cookie của react-native-cookies
type CookieManagerModule = {
  // Hàm clearAll: xóa tất cả cookie, có tham số useWebKit (tùy chọn)
  clearAll?: (useWebKit?: boolean) => Promise<unknown> | unknown;
};

/**
 * loadCookieManager - Tải cookie manager hỗ trợ React Native New Architecture
 * @returns {CookieManagerModule | null} Trả về đối tượng cookie manager nếu load thành công, null nếu thất bại
 */
const loadCookieManager = (): CookieManagerModule | null => {
  try {
    const cookieModule = require("@preeternal/react-native-cookie-manager");
    return cookieModule?.default ?? cookieModule ?? null;
  } catch {
    return null;
  }
};

/**
 * clearAllCookies - Xóa tất cả cookie trên thiết bị native (Android/iOS)
 * @param {boolean} useWebKit - Có sử dụng WebKit để xóa cookie hay không (mặc định: true)
 * @returns {Promise<boolean>} Promise trả về true nếu xóa thành công, false nếu thất bại hoặc đang ở Expo Go
 */
export const clearAllCookies = async (useWebKit = true) => {
  // Nếu đang chạy trong Expo Go thì không hỗ trợ xóa cookie native
  if (isExpoGo) {
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
