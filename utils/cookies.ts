type CookieManagerModule = typeof import("@react-native-cookies/cookies");

let cachedCookieManager: CookieManagerModule["default"] | null | undefined;
let didWarnUnavailable = false;

const getCookieManager = () => {
  if (cachedCookieManager !== undefined) {
    return cachedCookieManager;
  }

  try {
    const cookieModule = require("@react-native-cookies/cookies") as CookieManagerModule;
    cachedCookieManager = cookieModule.default ?? null;
  } catch (error) {
    cachedCookieManager = null;

    if (!didWarnUnavailable) {
      console.warn(
        "[cookies] Native cookie manager is unavailable on this build.",
        error
      );
      didWarnUnavailable = true;
    }
  }

  return cachedCookieManager;
};

export const clearAllCookies = async (useWebKit = true) => {
  const cookieManager = getCookieManager();
  if (!cookieManager?.clearAll) {
    return false;
  }

  try {
    await cookieManager.clearAll(useWebKit);
    return true;
  } catch (error) {
    console.warn("[cookies] Failed to clear cookies.", error);
    return false;
  }
};
