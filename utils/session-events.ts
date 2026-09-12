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

export const getRequestAccessToken = (value: unknown): string | undefined => {
  const headers = (value as HttpErrorLike | undefined)?.config?.headers;
  const authorization = headers?.Authorization ?? headers?.authorization;
  return typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;
};

export const isCurrentSessionAuthFailure = (failure: SessionAuthFailure, accessToken: string) =>
  !failure.accessToken || failure.accessToken === accessToken;

type SessionAuthFailureListener = (failure: SessionAuthFailure) => void;

const authFailureListeners = new Set<SessionAuthFailureListener>();

export const getHttpStatus = (value: unknown): number | null => {
  const status = Number((value as HttpErrorLike | undefined)?.response?.status);
  return Number.isFinite(status) ? status : null;
};

export const getRequestUrl = (value: unknown): string => {
  const error = value as HttpErrorLike | undefined;
  return String(error?.response?.config?.url || error?.config?.url || "");
};

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

const isRiotAuthUrl = (url: string) =>
  ["auth.riotgames.com", "entitlements.auth.riotgames.com"].includes(
    getTrustedHostname(url)
  );

const isRiotProtectedUrl = (url: string) =>
  isRiotAuthUrl(url) ||
  getTrustedHostname(url).endsWith(".a.pvp.net") ||
  getTrustedHostname(url) === "riot-geo.pas.si.riotgames.com";

/**
 * Riot trả 401 khi access token không còn hợp lệ. Một số endpoint auth trả
 * 403 khi cookie/session Riot đã hết hạn; 403 từ gameplay API không được coi
 * là lỗi session vì có thể chỉ là thao tác không được phép.
 */
export const isRiotAuthenticationError = (value: unknown): boolean => {
  const status = getHttpStatus(value);
  const url = getRequestUrl(value);
  return (
    (status === 401 && isRiotProtectedUrl(url)) ||
    (status === 403 && isRiotAuthUrl(url))
  );
};

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

export const subscribeSessionAuthFailures = (
  listener: SessionAuthFailureListener
) => {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
};

export const notifySessionAuthFailure = (failure: SessionAuthFailure) => {
  authFailureListeners.forEach((listener) => listener(failure));
};
