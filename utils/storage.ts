import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

type StorageValue = string | null;

type AppStorage = {
  getItem: (key: string) => Promise<StorageValue> | StorageValue;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

const noopStorage: AppStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const canUseLocalStorage =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  typeof window.localStorage !== "undefined";

const webStorage: AppStorage = canUseLocalStorage
  ? {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => {
        window.localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        window.localStorage.removeItem(key);
      },
    }
  : noopStorage;

export const appStorage: AppStorage =
  Platform.OS === "web" ? webStorage : AsyncStorage;

export const getStoredItem = async (key: string) => appStorage.getItem(key);

export const setStoredItem = async (key: string, value: string) =>
  appStorage.setItem(key, value);

export const removeStoredItem = async (key: string) =>
  appStorage.removeItem(key);
