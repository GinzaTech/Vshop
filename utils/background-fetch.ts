// Import Platform từ react-native để kiểm tra môi trường web
import { Platform } from "react-native";

// Import helper kiểm tra môi trường Expo Go
import { isExpoGo } from "./runtime";

/**
 * Đối tượng fallback của BackgroundFetch dùng khi ở web hoặc Expo Go.
 * Các phương thức đều là no-op (không làm gì) để tránh lỗi native module.
 */
const fallbackBackgroundFetch = {
  NETWORK_TYPE_ANY: 0,               // Hằng số loại mạng (bất kỳ)
  registerHeadlessTask: () => {},    // Đăng ký task headless (no-op)
  finish: () => {},                  // Đánh dấu task hoàn thành (no-op)
  configure: async () => 0,          // Cấu hình BackgroundFetch (no-op)
  stop: async () => {},              // Dừng BackgroundFetch (no-op)
};

/**
 * Module BackgroundFetch thực tế.
 * Trên web hoặc Expo Go: dùng fallback (no-op).
 * Native: require thật từ react-native-background-fetch.
 */
// Biến lưu instance BackgroundFetch tuỳ theo môi trường
const BackgroundFetch =
  Platform.OS === "web" || isExpoGo
    ? fallbackBackgroundFetch
    : require("react-native-background-fetch").default;

// Export module BackgroundFetch mặc định
export default BackgroundFetch;
