import { Platform } from "react-native";

import { isExpoGo } from "./runtime";

export const clearAllCookies = async (useWebKit = true) => {
  if (Platform.OS === "web" || isExpoGo) {
    return false;
  }

  try {
    const CookieManager = require("@react-native-cookies/cookies").default;
    await CookieManager.clearAll(useWebKit);
    return true;
  } catch (error) {
    console.warn("[cookies] Failed to clear cookies.", error);
    return false;
  }
};
