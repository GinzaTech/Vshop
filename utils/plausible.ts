// Import axios để gửi HTTP request
import axios from "axios";
// Import Platform từ React Native để kiểm tra hệ điều hành
import { Platform } from "react-native";

// Biến lưu User-Agent string dùng cho request, khởi tạo lazy (lần gọi capture đầu tiên)
let userAgent: string;
// Biến lưu phiên bản app, khởi tạo lazy (lần gọi capture đầu tiên)
let appVersion: string | undefined;

/**
 * getDeviceModule - Lazy-load module expo-device để lấy thông tin thiết bị
 * @returns {typeof import("expo-device")} Module expo-device
 */
function getDeviceModule() {
  return require("expo-device") as typeof import("expo-device");
}

/**
 * getApplicationModule - Lazy-load module expo-application để lấy thông tin ứng dụng
 * @returns {typeof import("expo-application")} Module expo-application
 */
function getApplicationModule() {
  return require("expo-application") as typeof import("expo-application");
}

/**
 * capture - Gửi sự kiện thống kê lên Plausible Analytics
 * Sử dụng giao thức Events API của Plausible (https://plausible.io/docs/events-api)
 * @param {"pageview" | "wishlist_check"} name - Tên sự kiện (pageview hoặc wishlist_check)
 * @param {string} [path] - Đường dẫn tương đối của trang (VD: "/home", "/shop")
 * @returns {Promise<void>} Promise void
 */
export async function capture(
  name: "pageview" | "wishlist_check",
  path?: string
) {
  // Bỏ qua nếu chưa cấu hình Plausible URL hoặc Domain trong biến môi trường
  if (
    !process.env.EXPO_PUBLIC_PLAUSIBLE_URL ||
    !process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN
  )
    return;

  // Khởi tạo User-Agent giả dạng trình duyệt từ thông tin thiết bị (chỉ 1 lần)
  if (!userAgent) {
    const Device = getDeviceModule();
    const osName =
      Platform.OS === "android"
        ? "Android"
        : Platform.OS === "ios"
        ? "iOS"
        : null;
    const os = osName ? `${osName} ${Device.osVersion ?? ""}` : null;
    const modelName = Device.modelName;
    const platform = [os, modelName].filter((i) => !!i).join("; ");

    userAgent = `Mozilla/5.0 (${platform}) Gecko/20100101 Chrome/53.0`;
  }

  // Khởi tạo phiên bản app từ expo-application (chỉ 1 lần)
  if (!appVersion) {
    const Application = getApplicationModule();
    appVersion = Application.nativeApplicationVersion || undefined;
  }

  // Gửi POST request đến Plausible Events API
  await axios.request({
    url: `${process.env.EXPO_PUBLIC_PLAUSIBLE_URL}/api/event`,
    method: "POST",
    headers: {
      "User-Agent": userAgent,
      "Content-Type": "application/json",
    },
    data: {
      name,                                  // Tên sự kiện
      domain: process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN, // Domain trên Plausible
      url: `app://localhost${path ?? ""}`,   // URL trang (dạng app://)
      props: {
        app_version: appVersion,             // Phiên bản app
      },
    },
  });
}
