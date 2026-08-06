// Import jwtDecode để decode JWT token
import { jwtDecode } from "jwt-decode";

// Import hàm tải assets, agents và client version của Valorant
import { fetchVersion, loadAgent, loadAssets } from "./valorant-assets";
// Import các hàm API Valorant: user mặc định, lấy balance, entitlements, progress, shop, v.v.
import {
  defaultUser,
  getBalances,
  getEntitlementsToken,
  getRiotClientVersionForRequests,
  getProgress,
  getRiotGeo,
  getShop,
  getUserId,
  getUsername,
  parseShop,
  reAuth,
} from "./valorant-api";
// Import helper chuẩn hóa shard (máy chủ) Valorant
import {
  getAccessTokenFromUri,
  getIdTokenFromUri,
  normalizeValorantShard,
} from "./misc";

// Số giây đệm trước khi token hết hạn (90 giây) để tránh dùng token sắp hết hạn
const ACCESS_TOKEN_BUFFER_SECONDS = 90;

// Type định nghĩa payload của access token (chỉ lấy trường exp)
type AccessTokenPayload = {
  exp?: number; // Thời điểm hết hạn (Unix timestamp)
};

/**
 * Chuẩn hóa tên region dùng normalizeValorantShard.
 * @param region - Tên region cần chuẩn hóa
 * @returns string - Region đã chuẩn hóa
 */
const normalizeRegion = (region?: string | null) =>
  normalizeValorantShard(region);

/**
 * Xác định region "live" thực tế dựa trên thông tin địa lý từ Riot.
 * Nếu không có idToken, dùng fallbackRegion.
 * @param accessToken - Access token của user
 * @param idToken - ID token của user
 * @param fallbackRegion - Region dự phòng
 * @returns Promise<string> - Region live
 */
async function resolveLiveRegion(
  accessToken: string,
  idToken: string,
  fallbackRegion: string
) {
  if (!idToken) {
    return normalizeRegion(fallbackRegion);
  }

  const geo = await getRiotGeo(accessToken, idToken).catch(() => null);
  const liveRegion = normalizeRegion(geo?.affinities?.live);

  return liveRegion || normalizeRegion(fallbackRegion);
}

/**
 * Public API: Kiểm tra xem access token có thể tái sử dụng không (còn hạn và còn buffer).
 * @param accessToken - Access token cần kiểm tra
 * @returns boolean - true nếu token còn dùng được
 */
export const hasReusableAccessToken = (accessToken?: string) => {
  if (!accessToken) {
    return false;
  }

  try {
    const payload = jwtDecode<AccessTokenPayload>(accessToken);

    if (!payload.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now() + ACCESS_TOKEN_BUFFER_SECONDS * 1000;
  } catch {
    return false;
  }
};

/**
 * Public API: Kiểm tra xem có thể tiếp tục session của user không.
 * Điều kiện: có region (hoặc regionOverride), có accessToken và token còn hạn.
 * @param user - Đối tượng user (kiểu defaultUser)
 * @param regionOverride - Region ghi đè (tuỳ chọn)
 * @returns boolean - true nếu có thể tiếp tục session
 */
export const canResumeUserSession = (
  user: typeof defaultUser,
  regionOverride?: string | null
) =>
  Boolean(
    (user.region || regionOverride) &&
      user.accessToken &&
      hasReusableAccessToken(user.accessToken)
  );

/**
 * getTimeUntilTokenExpiry — Trả về số ms còn lại trước khi token hết hạn.
 * @param accessToken - Access token cần kiểm tra
 * @returns number - ms còn lại, hoặc 0 nếu không parse được
 */
export const getTimeUntilTokenExpiry = (accessToken?: string): number => {
  if (!accessToken) return 0;
  try {
    const payload = jwtDecode<AccessTokenPayload>(accessToken);
    if (!payload.exp) return 0;
    return Math.max(0, payload.exp * 1000 - Date.now());
  } catch {
    return 0;
  }
};

/**
 * shouldProactivelyRefreshToken — Kiểm tra xem token sắp hết hạn chưa (trong 5 phút).
 * Dùng để trigger proactive reAuth trước khi token die.
 * @param accessToken - Access token cần kiểm tra
 * @returns boolean - true nếu token sẽ hết hạn trong 5 phút tới
 */
export const shouldProactivelyRefreshToken = (accessToken?: string): boolean => {
  if (!accessToken) return false;
  const remaining = getTimeUntilTokenExpiry(accessToken);
  return remaining <= 5 * 60 * 1000;
};

export class ReauthenticationRequiredError extends Error {
  readonly code = "REAUTHENTICATION_REQUIRED";

  constructor(message = "Riot session requires interactive authentication") {
    super(message);
    this.name = "ReauthenticationRequiredError";
  }
}

export const isReauthenticationRequiredError = (error: unknown) =>
  (error as { code?: string } | undefined)?.code ===
  "REAUTHENTICATION_REQUIRED";

/**
 * Xin access/id token mới bằng Riot cookie hiện có rồi tạo entitlement token
 * mới. Hàm này chỉ thay credentials; dữ liệu shop/profile được đồng bộ sau khi
 * credentials mới đã được lưu vào Zustand.
 */
export async function renewAuthenticatedSession(
  seedUser: typeof defaultUser
): Promise<typeof defaultUser> {
  const version = await fetchVersion().catch(() =>
    getRiotClientVersionForRequests()
  );
  const response = await reAuth(version);
  const callbackUri = response?.data?.response?.parameters?.uri;

  if (typeof callbackUri !== "string" || !callbackUri) {
    throw new ReauthenticationRequiredError();
  }

  let accessToken: string;
  let idToken: string;
  try {
    accessToken = getAccessTokenFromUri(callbackUri);
    idToken = getIdTokenFromUri(callbackUri);
  } catch {
    throw new ReauthenticationRequiredError();
  }

  const fallbackRegion = seedUser.region || defaultUser.region;
  const [entitlementsToken, liveRegion] = await Promise.all([
    getEntitlementsToken(accessToken),
    resolveLiveRegion(accessToken, idToken, fallbackRegion),
  ]);

  return {
    ...seedUser,
    id: getUserId(accessToken),
    region: liveRegion || fallbackRegion,
    accessToken,
    idToken,
    entitlementsToken,
  };
}

/**
 * Public API: Xây dựng đối tượng user đã được xác thực đầy đủ.
 * Lấy entitlements, region live, username, shop, progress, balances.
 * @param accessToken - Access token của user
 * @param region - Region mặc định
 * @param seedUser - User seed để merge dữ liệu cũ (tuỳ chọn)
 * @param idToken - ID token (mặc định từ seedUser)
 * @returns Promise<object> - Đối tượng user đầy đủ
 */
export async function buildAuthenticatedUser(
  accessToken: string,
  region: string,
  seedUser?: typeof defaultUser,
  idToken = seedUser?.idToken ?? ""
) {
  // Tải assets và agents song song
  const assetsPromise = loadAssets();
  const agentsPromise = loadAgent();
  const userId = getUserId(accessToken);
  // Lấy entitlements token và region live song song
  const [entitlementsToken, liveRegion] = await Promise.all([
    getEntitlementsToken(accessToken),
    resolveLiveRegion(accessToken, idToken, region),
  ]);

  // Lấy thông tin user, shop, progress, balances song song
  const [username, shop, progress, balances] = await Promise.all([
    getUsername(accessToken, entitlementsToken, userId, liveRegion),
    getShop(accessToken, entitlementsToken, liveRegion, userId),
    getProgress(accessToken, entitlementsToken, liveRegion, userId),
    getBalances(accessToken, entitlementsToken, liveRegion, userId),
    assetsPromise,
    agentsPromise,
  ]);
  // Parse dữ liệu shop, giữ lại bundle cũ từ seedUser
  const shops = await parseShop(shop, seedUser?.shops.bundles);

  return {
    ...defaultUser,
    ...seedUser,
    id: userId,
    name: username.GameName,
    TagLine: username.TagLine,
    region: liveRegion,
    shops,
    progress,
    balances,
    accessToken,
    idToken,
    entitlementsToken,
  };
}
