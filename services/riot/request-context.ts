import { getAssets } from "~/utils/valorant-assets";

// Import các hàm log cho axios request/response/error

// Thiết lập timeout mặc định cho axios: 10 giây (giảm từ 15s để fail-fast trên 4G)

// Khởi tạo API logger (async, không await để tránh chặn)

// Large Riot request/response logs can block the JS thread in Expo dev.
// Keep them opt-in so normal development stays responsive.
export const API_DEBUG_LOGGING =
  __DEV__ && process.env.EXPO_PUBLIC_API_DEBUG_LOGGING === "1";

// Interceptor cho request: log URL, ghi lại thời gian bắt đầu

// Interceptor cho response: log response/error và báo cho lifecycle manager
// khi Riot xác nhận session không còn hợp lệ. Cả nhánh fulfilled lẫn rejected
// đều được kiểm tra vì một số API dùng validateStatus để tự xử lý status code.

// Hàm che giấu thông tin bí mật (token, secret) khi log
// Chỉ hiện 8 ký tự đầu và 6 ký tự cuối nếu chuỗi dài > 16, nếu không thì hiện "***"
// Parameters:
//   - value: chuỗi cần che giấu
// Returns: chuỗi đã được che hoặc rỗng
export const maskSecretForLog = (value?: string | null) => {
  const text = String(value || "");
  if (!text) return "";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-6)}` : "***";
};

// Hàm log debug cho module valorant-api (chỉ log khi __DEV__ = true)
// Parameters:
//   - label: nhãn log
//   - payload: dữ liệu cần log
export const logValorantApiDebug = (
  label: string,
  payload: Record<string, unknown>
) => {
  if (API_DEBUG_LOGGING) {
    console.log(`[valorant-api] ${label}`, payload);
  }
};

export const logValorantApiResponse = (label: string, payload: unknown) => {
  if (
    __DEV__ &&
    process.env.EXPO_PUBLIC_LOG_VALORANT_RESPONSES === "1"
  ) {
    console.log(
      `[valorant-api-response] ${label}\n${JSON.stringify(payload, null, 2)}`
    );
  }
};

export const getPlayerResourceKey = (region: string, userId: string) =>
  `${region.toLowerCase()}|${userId.toLowerCase()}`;

// Hằng số: phiên bản Riot client mặc định (dùng khi chưa có dữ liệu assets hoặc override)
const DEFAULT_RIOT_CLIENT_VERSION = "release-13.00-shipping-32-4990475";

// Hằng số: platform info của Riot client (base64 encoded JSON của Windows PC)
const RIOT_CLIENT_PLATFORM =
  "eyJwbGF0Zm9ybVR5cGUiOiJQQyIsInBsYXRmb3JtT1MiOiJXaW5kb3dzIiwicGxhdGZvcm1PU1ZlcnNpb24iOiIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwicGxhdGZvcm1DaGlwc2V0IjoiVW5rbm93biJ9";

// Biến override phiên bản Riot client (có thể được set từ session)
let riotClientVersionOverride: string | null = null;

// Export hàm ghi đè phiên bản Riot client
// Nếu version hợp lệ (string không rỗng) thì set override, nếu không thì xóa override
// Parameters:
//   - version: phiên bản mới hoặc null/undefined để xóa
// Returns: phiên bản đã set hoặc null nếu xóa
export const setRiotClientVersionOverride = (version?: string | null) => {
  const normalizedVersion = typeof version === "string" ? version.trim() : "";

  if (!normalizedVersion) {
    riotClientVersionOverride = null;
    return null;
  }

  riotClientVersionOverride = normalizedVersion;
  return riotClientVersionOverride;
};

// Export hàm lấy phiên bản Riot client cho requests
// Ưu tiên: override > assets > default
// Returns: chuỗi phiên bản
export const getRiotClientVersionForRequests = () =>
  riotClientVersionOverride ||
  getAssets().riotClientVersion ||
  DEFAULT_RIOT_CLIENT_VERSION;

// Hàm nội bộ: tạo headers phụ (extra) cho các request API Riot
// Bao gồm: ClientVersion, ClientPlatform, Accept-Encoding (gzip), Connection keep-alive
// Accept-Encoding gzip giảm 60-80% payload trên 4G
export const extraHeaders = () => ({
  "X-Riot-ClientVersion": getRiotClientVersionForRequests(),
  "X-Riot-ClientPlatform": RIOT_CLIENT_PLATFORM,
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
});
