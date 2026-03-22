import CookieManager from "@react-native-cookies/cookies";

export const clearAllCookies = async (useWebKit = true) => {
  try {
    await CookieManager.clearAll(useWebKit);
    return true;
  } catch (error) {
    console.warn("[cookies] Failed to clear cookies.", error);
    return false;
  }
};
