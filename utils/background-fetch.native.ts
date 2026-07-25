// Import helper kiểm tra môi trường Expo Go
import { isExpoGo } from "./runtime";

/**
 * Đối tượng fallback của BackgroundFetch dùng khi đang ở Expo Go.
 * Các phương thức đều là no-op (không làm gì) để tránh crash.
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
 * Nếu đang ở Expo Go, dùng fallback để tránh lỗi native module.
 * Nếu không, require thật từ react-native-background-fetch.
 */
// Biến lưu instance BackgroundFetch (fallback nếu là Expo Go, thật nếu là native)
const BackgroundFetch = isExpoGo
  ? fallbackBackgroundFetch
  : require("react-native-background-fetch").default;

// Export module BackgroundFetch mặc định
export default BackgroundFetch;
