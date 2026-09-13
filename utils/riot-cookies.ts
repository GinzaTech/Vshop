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

/**
 * RiotAuthCookie - Một cookie Riot đã capture/khôi phục.
 * @property {string} [expires] - Hết hạn (ISO; trống = cookie phiên không hết hạn)
 */
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

/**
 * Nguồn cookie khi capture: "network" = kho cookie của native networking
 * (axios/TCP), "webview" = kho WebKit của login WebView (chỉ tách biệt trên iOS).
 */
export type RiotCookieCaptureSource = "network" | "webview";

// Chỉ cookie thuộc các domain Riot này mới được capture/khôi phục.
const RIOT_COOKIE_DOMAINS = ["riotgames.com", "playvalorant.com"];
// Endpoint xác thực dùng làm URL truy vấn cookie trên Android (không có getAll).
const RIOT_AUTH_COOKIE_TARGET = {
  url: "https://auth.riotgames.com/api/v1/authorization",
  domain: "auth.riotgames.com",
} as const;

/**
 * normalizeCookieDomain — Chuẩn hóa domain cookie: bỏ dấu "." đầu, trim,
 * lowercase để so khớp nhất quán ("." + ".riotgames.com" như nhau).
 * @param {string} [domain] - Domain gốc của cookie
 * @returns {string} Domain đã chuẩn hóa ("" nếu rỗng)
 */
const normalizeCookieDomain = (domain?: string) =>
  String(domain || "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();

/**
 * isRiotCookieDomain — Cookie có thuộc domain Riot được phép lưu không
 * (so khớp chính xác hoặc subdomain của riotgames.com/playvalorant.com).
 * @param {string} [domain] - Domain cần kiểm tra
 * @returns {boolean} true nếu domain thuộc Riot
 */
const isRiotCookieDomain = (domain?: string) => {
  const normalizedDomain = normalizeCookieDomain(domain);
  return RIOT_COOKIE_DOMAINS.some(
    (allowedDomain) =>
      normalizedDomain === allowedDomain ||
      normalizedDomain.endsWith(`.${allowedDomain}`)
  );
};

/**
 * isCookieExpired — Cookie đã hết hạn chưa (theo trường expires). Cookie
 * phiên (không có expires) luôn được coi là còn hạn.
 * @param {RiotAuthCookie} cookie - Cookie cần kiểm tra
 * @returns {boolean} true nếu expires hợp lệ và đã qua thời điểm hiện tại
 */
const isCookieExpired = (cookie: RiotAuthCookie) => {
  if (!cookie.expires) return false;
  const expiresAt = Date.parse(cookie.expires);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
};

/**
 * getCookieKey — Khóa định danh duy nhất của một cookie ("domain|path|name")
 * dùng để dedupe khi gộp cookie từ nhiều nguồn/kho.
 * @param {RiotAuthCookie} cookie - Cookie cần tạo khóa
 * @returns {string} Chuỗi khóa định danh
 */
const getCookieKey = (cookie: RiotAuthCookie) =>
  [
    normalizeCookieDomain(cookie.domain),
    cookie.path || "/",
    cookie.name,
  ].join("|");

/**
 * getCookieUrl — Dựng URL để set lại cookie vào cookie manager (cần https +
 * domain + path). Path không hợp lệ được thay bằng "/".
 * @param {RiotAuthCookie} cookie - Cookie cần dựng URL
 * @returns {string} URL dạng "https://domain/path"
 */
const getCookieUrl = (cookie: RiotAuthCookie) => {
  const domain = normalizeCookieDomain(cookie.domain);
  const path = cookie.path?.startsWith("/") ? cookie.path : "/";
  return `https://${domain}${path}`;
};

/**
 * readCookies — Đọc toàn bộ cookie từ cookie manager, ưu tiên API dạng mảng
 * (getAllAsArray), fallback về dạng record (getAll) rồi chuyển values.
 * @param {CookieManagerModule} cookieManager - Cookie manager đã load
 * @param {boolean} useWebKit - true: kho WebKit (iOS WebView), false: kho native
 * @returns {Promise<readonly RiotAuthCookie[]>} Danh sách cookie (rỗng nếu không hỗ trợ)
 */
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

/**
 * readCookiesForUrl — Đọc cookie cho MỘT URL cụ thể (cách duy nhất Android
 * hỗ trợ). Ưu tiên getAsArray, fallback get dạng record.
 * @param {CookieManagerModule} cookieManager - Cookie manager đã load
 * @param {string} url - URL cần truy vấn cookie
 * @returns {Promise<readonly RiotAuthCookie[]>} Cookie sẽ được gửi tới URL đó
 */
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
