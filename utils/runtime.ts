// Import Constants từ expo-constants để lấy thông tin môi trường chạy
import Constants from "expo-constants";
// Import Platform từ react-native để xác định hệ điều hành đang chạy
import { Platform } from "react-native";

/**
 * isExpoGo - Biến xác định ứng dụng có đang chạy trong môi trường Expo Go hay không
 * Kiểm tra executionEnvironment === "storeClient" hoặc appOwnership === "expo"
 * @type {boolean}
 */
export const isExpoGo =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo";

// Platform helpers – xác định nền tảng đang chạy
export const isWeb = Platform.OS === "web";
export const isAndroid = Platform.OS === "android";
export const isIOS = Platform.OS === "ios";
export const isNative = Platform.OS !== "web";
