// Import Platform từ React Native để kiểm tra hệ điều hành
import { Platform } from "react-native";

// Import hàm kiểm tra môi trường Expo Go
import { isExpoGo } from "./runtime";

// Định nghĩa kiểu cho module quản lý cookie của react-native-cookies
type CookieManagerModule = {
  get?: (
    url: string,
    useWebKit?: boolean
  ) => Promise<Record<string, RiotAuthCookie>>;
  getAsArray?: (
    url: string,
    useWebKit?: boolean
  ) => Promise<readonly RiotAuthCookie[]>;
  getAll?: (useWebKit?: boolean) => Promise<Record<string, RiotAuthCookie>>;
  getAllAsArray?: (
    useWebKit?: boolean
  ) => Promise<readonly RiotAuthCookie[]>;
  set?: (
    url: string,
    cookie: RiotAuthCookie,
    useWebKit?: boolean
  ) => Promise<boolean>;
  // Hàm clearAll: xóa tất cả cookie, có tham số useWebKit (tùy chọn)
  clearAll?: (useWebKit?: boolean) => Promise<unknown> | unknown;
  clearAllStores?: () => Promise<unknown> | unknown;
  flush?: () => Promise<void>;
};

export type RiotAuthCookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  version?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

export type RiotCookieCaptureSource = "network" | "webview";

const RIOT_COOKIE_DOMAINS = ["riotgames.com", "playvalorant.com"];
const RIOT_AUTH_COOKIE_TARGET = {
  url: "https://auth.riotgames.com/api/v1/authorization",
  domain: "auth.riotgames.com",
} as const;

const normalizeCookieDomain = (domain?: string) =>
  String(domain || "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();

const isRiotCookieDomain = (domain?: string) => {
  const normalizedDomain = normalizeCookieDomain(domain);
  return RIOT_COOKIE_DOMAINS.some(
    (allowedDomain) =>
      normalizedDomain === allowedDomain ||
      normalizedDomain.endsWith(`.${allowedDomain}`)
  );
};

const isCookieExpired = (cookie: RiotAuthCookie) => {
  if (!cookie.expires) return false;
  const expiresAt = Date.parse(cookie.expires);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
};

const getCookieKey = (cookie: RiotAuthCookie) =>
  [
    normalizeCookieDomain(cookie.domain),
    cookie.path || "/",
    cookie.name,
  ].join("|");

const getCookieUrl = (cookie: RiotAuthCookie) => {
  const domain = normalizeCookieDomain(cookie.domain);
  const path = cookie.path?.startsWith("/") ? cookie.path : "/";
  return `https://${domain}${path}`;
};

const readCookies = async (
  cookieManager: CookieManagerModule,
  useWebKit: boolean
): Promise<readonly RiotAuthCookie[]> => {
  if (cookieManager.getAllAsArray) {
    return cookieManager.getAllAsArray(useWebKit);
  }
  if (cookieManager.getAll) {
    return Object.values(await cookieManager.getAll(useWebKit));
  }
  return [];
};

const readCookiesForUrl = async (
  cookieManager: CookieManagerModule,
  url: string
): Promise<readonly RiotAuthCookie[]> => {
  if (cookieManager.getAsArray) {
    return cookieManager.getAsArray(url, false);
  }
  if (cookieManager.get) {
    return Object.values(await cookieManager.get(url, false));
  }
  return [];
};

/**
 * loadCookieManager - Tải cookie manager hỗ trợ React Native New Architecture
 * @returns {CookieManagerModule | null} Trả về đối tượng cookie manager nếu load thành công, null nếu thất bại
 */
const loadCookieManager = (): CookieManagerModule | null => {
  try {
    const cookieModule = require("@preeternal/react-native-cookie-manager");
    return cookieModule?.default ?? cookieModule ?? null;
  } catch {
    return null;
  }
};

/**
 * clearAllCookies - Xóa tất cả cookie trên thiết bị native, bỏ qua nếu là web hoặc Expo Go
 * @param {boolean} useWebKit - Có sử dụng WebKit để xóa cookie hay không (mặc định: true)
 * @returns {Promise<boolean>} Promise trả về true nếu xóa thành công, false nếu thất bại, đang ở web hoặc Expo Go
 */
export const clearAllCookies = async (useWebKit = true) => {
  // Bỏ qua nếu đang chạy trên web hoặc trong Expo Go
  if (Platform.OS === "web" || isExpoGo) {
    return false;
  }

  try {
    const cookieManager = loadCookieManager();
    if (cookieManager?.clearAllStores) {
      try {
        const cleared = await cookieManager.clearAllStores();
        if (cleared !== false) return true;
      } catch {
        // Binary cũ có thể chưa expose clearAllStores; thử API tương thích cũ.
      }
    }
    // Nếu không load được module hoặc không có hàm clearAll thì thoát
    if (!cookieManager?.clearAll) {
      return false;
    }

    const stores = Platform.OS === "ios" ? [false, true] : [useWebKit];
    let clearedAll = true;
    for (const store of stores) {
      const cleared = await cookieManager.clearAll(store);
      if (cleared === false) clearedAll = false;
    }
    return clearedAll;
  } catch (error) {
    console.warn("[cookies] Failed to clear cookies.", error);
    return false;
  }
};

/**
 * Chụp các cookie Riot đang hoạt động để gắn với đúng tài khoản đã lưu.
 * WebView được ưu tiên sau login; native networking được ưu tiên sau silent
 * re-auth vì hai kho cookie là tách biệt trên iOS.
 */
export const captureRiotAuthCookies = async (
  source: RiotCookieCaptureSource = "network"
): Promise<RiotAuthCookie[]> => {
  if (Platform.OS === "web" || isExpoGo) return [];

  const cookieManager = loadCookieManager();
  if (!cookieManager) return [];

  try {
    if (Platform.OS === "android") {
      // Android không hỗ trợ getAll/getAllAsArray. Đọc đúng URL silent-renew
      // cũng chỉ lấy các cookie thực sự sẽ được gửi đến endpoint đó. WebView
      // cũ có thể thiếu metadata domain, nên gắn host đã truy vấn để snapshot
      // vẫn khôi phục được trên cùng endpoint.
      const cookies = await readCookiesForUrl(
        cookieManager,
        RIOT_AUTH_COOKIE_TARGET.url
      );
      const cookiesByKey = new Map<string, RiotAuthCookie>();
      for (const cookie of cookies) {
        const normalizedCookie = cookie.domain
          ? cookie
          : { ...cookie, domain: RIOT_AUTH_COOKIE_TARGET.domain };
        if (
          !normalizedCookie.name ||
          !normalizedCookie.value ||
          !isRiotCookieDomain(normalizedCookie.domain) ||
          isCookieExpired(normalizedCookie)
        ) {
          continue;
        }
        cookiesByKey.set(getCookieKey(normalizedCookie), {
          ...normalizedCookie,
        });
      }
      return [...cookiesByKey.values()].sort((left, right) =>
        getCookieKey(left).localeCompare(getCookieKey(right))
      );
    }

    const storeOrder =
      Platform.OS === "ios"
        ? source === "webview"
          ? [true, false]
          : [false, true]
        : [false];
    const cookiesByKey = new Map<string, RiotAuthCookie>();

    for (const useWebKit of storeOrder) {
      const cookies = await readCookies(cookieManager, useWebKit);
      for (const cookie of cookies) {
        if (
          !cookie.name ||
          !cookie.value ||
          !isRiotCookieDomain(cookie.domain) ||
          isCookieExpired(cookie)
        ) {
          continue;
        }

        const key = getCookieKey(cookie);
        if (!cookiesByKey.has(key)) {
          cookiesByKey.set(key, { ...cookie });
        }
      }
    }

    return [...cookiesByKey.values()].sort((left, right) =>
      getCookieKey(left).localeCompare(getCookieKey(right))
    );
  } catch (error) {
    if (__DEV__) {
      console.warn("[cookies] Failed to capture Riot cookies.", error);
    }
    return [];
  }
};

/**
 * Thay cookie jar hiện tại bằng snapshot của một tài khoản. Trên iOS cookie
 * được đưa vào cả Foundation (Axios) và WebKit (login WebView); Android dùng
 * chung một cookie store.
 */
export const restoreRiotAuthCookies = async (
  cookies: readonly RiotAuthCookie[]
): Promise<boolean> => {
  if (Platform.OS === "web" || isExpoGo) return false;

  const cookieManager = loadCookieManager();
  if (!cookieManager?.set) return false;

  const restorableCookies = cookies.filter(
    (cookie) =>
      Boolean(cookie.name && cookie.value) &&
      isRiotCookieDomain(cookie.domain) &&
      !isCookieExpired(cookie)
  );

  try {
    const cleared = await clearAllCookies(true);
    if (!cleared || restorableCookies.length === 0) return false;

    const stores = Platform.OS === "ios" ? [false, true] : [false];
    for (const cookie of restorableCookies) {
      const url = getCookieUrl(cookie);
      for (const useWebKit of stores) {
        const stored = await cookieManager.set(url, { ...cookie }, useWebKit);
        if (!stored) {
          await clearAllCookies(true);
          return false;
        }
      }
    }

    await cookieManager.flush?.();
    return true;
  } catch (error) {
    await clearAllCookies(true);
    if (__DEV__) {
      console.warn("[cookies] Failed to restore Riot cookies.", error);
    }
    return false;
  }
};
