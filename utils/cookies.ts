import { Platform } from "react-native";

import { isExpoGo } from "./runtime";

type CookieManagerModule = {
  clearAll?: (useWebKit?: boolean) => Promise<unknown> | unknown;
};

const loadCookieManager = (): CookieManagerModule | null => {
  try {
    const cookieModule = require("@react-native-cookies/cookies");
    return cookieModule?.default ?? cookieModule ?? null;
  } catch {
    return null;
  }
};

export const clearAllCookies = async (useWebKit = true) => {
  if (Platform.OS === "web" || isExpoGo) {
    return false;
  }

  try {
    const cookieManager = loadCookieManager();
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
