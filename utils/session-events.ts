type HttpErrorLike = {
  code?: string;
  message?: string;
  config?: { url?: string };
  response?: {
    status?: number;
    config?: { url?: string };
  };
};

export type SessionAuthFailure = {
  status: number;
  url: string;
};

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

const isRiotAuthUrl = (url: string) =>
  url.includes("auth.riotgames.com") ||
  url.includes("entitlements.auth.riotgames.com");

const isRiotProtectedUrl = (url: string) =>
  isRiotAuthUrl(url) ||
  url.includes(".a.pvp.net") ||
  url.includes("riot-geo.pas.si.riotgames.com");

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

  if (getHttpStatus(value) !== null) return false;

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
