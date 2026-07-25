// Import Platform để kiểm tra hệ điều hành hiện tại (web, iOS, Android)
import { Platform } from "react-native";

// Kiểu dữ liệu cho giá trị lưu trữ: có thể là string hoặc null
type StorageValue = string | null;

// Interface định nghĩa các phương thức của hệ thống lưu trữ
type AppStorage = {
  getItem: (key: string) => Promise<StorageValue> | StorageValue;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

// Đối tượng storage rỗng (no-op) dùng làm fallback
const noopStorage: AppStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// ===== Web storage (localStorage) =====
const canUseLocalStorage =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  typeof window.localStorage !== "undefined";

const webStorage: AppStorage = canUseLocalStorage
  ? {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => { window.localStorage.setItem(key, value); },
      removeItem: (key) => { window.localStorage.removeItem(key); },
    }
  : noopStorage;

// ===== Native storage (MMKV — sync, ultra-fast) =====
let mmkvInstance: { getInstance: () => any } | null = null;
try {
  // Lazy require để tránh crash trên web/Expo Go
  if (Platform.OS !== "web") {
    mmkvInstance = require("react-native-mmkv");
  }
} catch {
  // MMKV chưa cài native module — fallback AsyncStorage
}

let mmkvStorage: any = null;
if (mmkvInstance) {
  try {
    mmkvStorage = new (mmkvInstance as any).MMKV({
      id: "vshop-mmkv",
      encryptionMode: "none",
    });
  } catch {
    // Fallback
  }
}

// AsyncStorage fallback (nếu MMKV không khả dụng)
let asyncStorageFallback: AppStorage = noopStorage;
try {
  if (Platform.OS !== "web" && !mmkvStorage) {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    asyncStorageFallback = AsyncStorage;
  }
} catch {
  // Fallback
}

// ===== Export appStorage — MMKV trên native, localStorage trên web =====
const nativeStorage: AppStorage = mmkvStorage
  ? {
      getItem: (key) => mmkvStorage.getString(key) ?? null,   // Sync! Không Promise
      setItem: (key, value) => { mmkvStorage.set(key, value); }, // Sync!
      removeItem: (key) => { mmkvStorage.delete(key); },         // Sync!
    }
  : asyncStorageFallback;

export const appStorage: AppStorage =
  Platform.OS === "web" ? webStorage : nativeStorage;

// Export hàm tiện ích
export const getStoredItem = async (key: string) => appStorage.getItem(key);
export const setStoredItem = async (key: string, value: string) => appStorage.setItem(key, value);
export const removeStoredItem = async (key: string) => appStorage.removeItem(key);
