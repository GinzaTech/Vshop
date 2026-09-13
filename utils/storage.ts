/**
 * storage.ts — Lựa chọn backend storage cho từng loại dữ liệu.
 *
 * - appStorage: cache + tuỳ chọn (không nhạy cảm). Native dùng MMKV thường,
 *   web dùng localStorage.
 * - secureAppStorage: session/token Riot. Native dùng MMKV mã hoá AES-256
 *   với key lưu trong Keychain/Keystore; web dùng sessionStorage (chỉ sống
 *   trong tab hiện tại) vì browser không có bảo đảm Keychain/Keystore.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createMMKV, type MMKV } from "react-native-mmkv";
import {
  type AppStorage,
  withLegacyMigration,
} from "./storage-migration";

/** Backend no-op: đọc trả null, ghi/xoá không làm gì (dùng khi không có storage). */
const noopStorage: AppStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const canUseLocalStorage =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  typeof window.localStorage !== "undefined";

const canUseSessionStorage =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  typeof window.sessionStorage !== "undefined";

/** Backend localStorage cho web (no-op nếu window/localStorage không tồn tại). */
const webStorage: AppStorage = canUseLocalStorage
  ? {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
      removeItem: (key) => window.localStorage.removeItem(key),
    }
  : noopStorage;

// Browser storage cannot provide Keychain/Keystore guarantees. Keep Riot
// sessions scoped to the current tab instead of persisting bearer tokens in
// localStorage. Native builds use encrypted MMKV below.
const webSessionStorage: AppStorage = canUseSessionStorage
  ? {
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: (key) => window.sessionStorage.removeItem(key),
    }
  : noopStorage;

/** Chuyển instance MMKV về interface AppStorage (getItem trả null nếu thiếu). */
const toStorage = (storage: MMKV): AppStorage => ({
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => {
    storage.remove(key);
  },
});

/**
 * createNativeCacheStorage — Tạo storage cache native (MMKV id "vshop-cache-v1",
 * compareBeforeSet để tránh ghi dư) kèm migration dữ liệu plaintext từ
 * AsyncStorage. MMKV khởi tạo lỗi thì fallback về AsyncStorage.
 * @returns {AppStorage} Storage cache dùng cho native
 */
const createNativeCacheStorage = (): AppStorage => {
  try {
    return withLegacyMigration(
      toStorage(
        createMMKV({
          id: "vshop-cache-v1",
          compareBeforeSet: true,
        })
      ),
      AsyncStorage
    );
  } catch (error) {
    if (__DEV__) {
      console.warn("[storage] MMKV cache unavailable; using AsyncStorage", error);
    }
    return AsyncStorage;
  }
};

const ENCRYPTION_KEY_ALIAS = "vshop.mmkv.encryption-key.v1";

/**
 * getOrCreateEncryptionKey — Lấy (hoặc tạo lần đầu) key mã hoá AES-256 cho
 * MMKV secure, lưu trong Keychain/Keystore (WHEN_UNLOCKED_THIS_DEVICE_ONLY).
 * Key là 16 byte ngẫu nhiên hex-encode thành chuỗi 32 ký tự ASCII đúng chuẩn
 * AES-256; gọi đồng bộ nên chỉ được dùng lúc khởi tạo module.
 * @returns {string} Key mã hoá (32 ký tự hex)
 */
const getOrCreateEncryptionKey = (): string => {
  const options = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
  const existing = SecureStore.getItem(ENCRYPTION_KEY_ALIAS, options);
  if (existing) return existing;

  // AES-256 expects exactly 32 bytes. Hex-encoding 16 random bytes produces
  // a 32-character ASCII key without persisting the key beside the database.
  const generated = Array.from(Crypto.getRandomBytes(16), (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
  SecureStore.setItem(ENCRYPTION_KEY_ALIAS, generated, options);
  return generated;
};

/**
 * createNativeSecureStorage — Tạo storage session/token mã hoá (MMKV
 * "vshop-secure-v1", AES-256, key từ Keystore) kèm legacy migration.
 * DEV + MMKV lỗi → fallback AsyncStorage. RELEASE + MMKV lỗi → no-op:
 * tuyệt đối không ghi token plaintext xuống disk.
 * @returns {AppStorage} Storage bảo mật dùng cho native
 */
const createNativeSecureStorage = (): AppStorage => {
  try {
    const encryptionKey = getOrCreateEncryptionKey();
    return withLegacyMigration(
      toStorage(
        createMMKV({
          id: "vshop-secure-v1",
          encryptionKey,
          encryptionType: "AES-256",
          compareBeforeSet: true,
        })
      ),
      AsyncStorage
    );
  } catch (error) {
    // Expo Go and a development binary built before expo-secure-store was
    // added cannot open the encrypted store. Preserve the existing login flow
    // there. A release must never persist bearer tokens back to plaintext when
    // Keystore/Keychain is unavailable; it keeps the in-memory session only.
    if (__DEV__) {
      console.warn(
        "[storage] Encrypted storage unavailable; using AsyncStorage fallback",
        error
      );
      return AsyncStorage;
    }
    return noopStorage;
  }
};

const nativeStorage =
  Platform.OS === "web" ? noopStorage : createNativeCacheStorage();
const nativeSecureStorage =
  Platform.OS === "web" ? noopStorage : createNativeSecureStorage();

/** Non-sensitive persisted cache and preferences. */
export const appStorage: AppStorage =
  Platform.OS === "web" ? webStorage : nativeStorage;

/** Riot session/account storage encrypted with a Keystore-backed key. */
export const secureAppStorage: AppStorage =
  Platform.OS === "web" ? webSessionStorage : nativeSecureStorage;

/** Đọc một giá trị từ appStorage (trả về null nếu không có). */
export const getStoredItem = async (key: string) => appStorage.getItem(key);
/** Ghi một giá trị vào appStorage. */
export const setStoredItem = async (key: string, value: string) =>
  appStorage.setItem(key, value);
/** Xoá một giá trị khỏi appStorage. */
export const removeStoredItem = async (key: string) =>
  appStorage.removeItem(key);
