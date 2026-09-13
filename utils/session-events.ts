/**
 * session-events.ts — Phân loại lỗi HTTP + kênh sự kiện phiên (session).
 *
 * Mục tiêu: quyết định một lỗi nào đó có phải là "hết phiên Riot" (401/403
 * từ host Riot hợp lệ) hay chỉ là lỗi mạng tạm thời, rồi phát sự kiện qua
 * listener thay vì để từng screen tự redirect về /reauth.
 */

// Shape tối thiểu của một axios-like error mà các helper đọc được.
type HttpErrorLike = {
  code?: string;
  message?: string;
  config?: { url?: string; headers?: { Authorization?: unknown; authorization?: unknown } };
  response?: {
    status?: number;
    config?: { url?: string };
  };
};

export type SessionAuthFailure = {
  status: number;
  url: string;
  /** Used only in memory to discard errors from superseded requests. Never log. */
  accessToken?: string;
};

/**
 * getRequestAccessToken — Trích access token từ header Authorization của
 * request gây lỗi. Chỉ dùng trong bộ nhớ để loại bỏ lỗi từ request cũ bị
 * thay thế (superseded); KHÔNG BAO GIỜ log giá trị này.
 * @param {unknown} value - Error bất kỳ (thường là axios error)
 * @returns {string | undefined} Access token (bỏ tiền tố "Bearer "),
 *   hoặc undefined nếu không tìm thấy
 */
export const getRequestAccessToken = (value: unknown): string | undefined => {
  const headers = (value as HttpErrorLike | undefined)?.config?.headers;
  const authorization = headers?.Authorization ?? headers?.authorization;
  return typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;
};

/**
 * isCurrentSessionAuthFailure — Kiểm tra lỗi xác thực có thuộc phiên hiện tại
 * không. Lỗi không kèm token được coi là của phiên hiện tại (an toàn); lỗi
 * kèm token chỉ được nhận nếu token khớp phiên đang chạy (bỏ lỗi "ma" từ
 * request cũ trước khi renew token).
 * @param {SessionAuthFailure} failure - Lỗi xác thực đã bắt được
 * @param {string} accessToken - Access token của phiên hiện tại
 * @returns {boolean} true nếu lỗi thuộc phiên hiện tại
 */
export const isCurrentSessionAuthFailure = (failure: SessionAuthFailure, accessToken: string) =>
  !failure.accessToken || failure.accessToken === accessToken;

type SessionAuthFailureListener = (failure: SessionAuthFailure) => void;

// Tập listener nhận sự kiện lỗi xác thực phiên (đăng ký qua subscribe...).
const authFailureListeners = new Set<SessionAuthFailureListener>();

/**
 * getHttpStatus — Đọc mã trạng thái HTTP từ một error bất kỳ.
 * @param {unknown} value - Error (thường là axios error)
 * @returns {number | null} Mã HTTP (VD: 401, 403, 500), hoặc null nếu không có
 */
export const getHttpStatus = (value: unknown): number | null => {
  const status = Number((value as HttpErrorLike | undefined)?.response?.status);
  return Number.isFinite(status) ? status : null;
};

/**
 * getRequestUrl — Lấy URL của request gây lỗi (ưu tiên response.config,
 * fallback request.config).
 * @param {unknown} value - Error bất kỳ
 * @returns {string} URL của request, hoặc chuỗi rỗng nếu không xác định được
 */
export const getRequestUrl = (value: unknown): string => {
  const error = value as HttpErrorLike | undefined;
  return String(error?.response?.config?.url || error?.config?.url || "");
};

/**
 * getTrustedHostname — Trích hostname từ URL, chỉ chấp nhận https, không
 * có username/password trong URL; kết quả lowercase và bỏ dấu "." cuối.
 * @param {string} value - URL cần kiểm tra
 * @returns {string} Hostname tin cậy, hoặc "" nếu URL lỗi/không an toàn
 */
const getTrustedHostname = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.hostname.toLowerCase().replace(/\.$/, "")
      : "";
  } catch {
    return "";
  }
};

/** Kiểm tra URL có thuộc host auth/entitlements của Riot không. */
const isRiotAuthUrl = (url: string) =>
  ["auth.riotgames.com", "entitlements.auth.riotgames.com"].includes(
    getTrustedHostname(url)
  );

/** URL có phải endpoint Riot được bảo vệ (auth hoặc gameplay .a.pvp.net)? */
const isRiotProtectedUrl = (url: string) =>
  isRiotAuthUrl(url) ||
  getTrustedHostname(url).endsWith(".a.pvp.net") ||
  getTrustedHostname(url) === "riot-geo.pas.si.riotgames.com";

/**
 * Riot trả 401 khi access token không còn hợp lệ. Một số endpoint auth trả
 * 403 khi cookie/session Riot đã hết hạn; 403 từ gameplay API không được coi
 * là lỗi session vì có thể chỉ là thao tác không được phép.
 */
/**
 * isRiotAuthenticationError — Xác định một lỗi có phải là "hết phiên Riot"
 * (cần re-auth) hay không. 401/403 từ host lạ KHÔNG được coi là lỗi phiên.
 * @param {unknown} value - Error bất kỳ
 * @returns {boolean} true nếu là lỗi xác thực Riot (cần làm mới phiên)
 */
export const isRiotAuthenticationError = (value: unknown): boolean => {
  const status = getHttpStatus(value);
  const url = getRequestUrl(value);
  return (
    (status === 401 && isRiotProtectedUrl(url)) ||
    (status === 403 && isRiotAuthUrl(url))
  );
};

/**
 * isTransientNetworkError — Kiểm tra lỗi có tạm thời (mạng, timeout, rate
 * limit, upstream outage) hay không. Lỗi tạm thời KHÔNG được buộc đăng xuất
 * hay xoá cache — giữ phiên hiện tại và chờ retry.
 * @param {unknown} value - Error bất kỳ
 * @returns {boolean} true nếu là lỗi mạng tạm thời có thể phục hồi
 */
export const isTransientNetworkError = (value: unknown): boolean => {
  const error = value as HttpErrorLike | undefined;
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const status = getHttpStatus(value);

  // Rate limits, request timeouts and upstream outages are recoverable and
  // should retain the current session/cache instead of forcing a login.
  if (status !== null) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  return (
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    message.includes("network error") ||
    message.includes("timeout") ||
    message.includes("internet connection")
  );
};

/**
 * subscribeSessionAuthFailure — Đăng ký listener nhận sự kiện lỗi xác thực
 * phiên. Thay cho việc từng screen tự bắt 401 và redirect lẻ tẻ.
 * @param {SessionAuthFailureListener} listener - Callback nhận SessionAuthFailure
 * @returns {() => boolean} Hàm hủy đăng ký (gọi khi unmount để tránh leak)
 */
export const subscribeSessionAuthFailures = (
  listener: SessionAuthFailureListener
) => {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
};

/**
 * notifySessionAuthFailure — Phát sự kiện lỗi xác thực phiên tới toàn bộ
 * listener đang đăng ký (gọi từ HTTP client khi phát hiện 401/403 Riot).
 * @param {SessionAuthFailure} failure - Thông tin lỗi (status, url, token trong bộ nhớ)
 */
export const notifySessionAuthFailure = (failure: SessionAuthFailure) => {
  authFailureListeners.forEach((listener) => listener(failure));
};
