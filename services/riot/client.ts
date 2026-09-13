import type { InternalAxiosRequestConfig } from "axios";

import { riotHttpClient } from "~/services/http/clients";
import {
  initApiLogger,
  logAxiosError,
  logAxiosRequest,
  logAxiosResponse,
} from "~/utils/api-logger";
import {
  getRequestUrl,
  getRequestAccessToken,
  isRiotAuthenticationError,
  notifySessionAuthFailure,
} from "~/utils/session-events";

type TimedRequestConfig = InternalAxiosRequestConfig & {
  metadata?: { startTime: number };
};

// Bật log chi tiết request/response chỉ khi dev + biến môi trường EXPO_PUBLIC_API_DEBUG_LOGGING=1.
const API_DEBUG_LOGGING =
  __DEV__ && process.env.EXPO_PUBLIC_API_DEBUG_LOGGING === "1";

// Cờ chống cài interceptor trùng (module có thể được import nhiều lần / HMR).
let interceptorsInstalled = false;

/**
 * Cài interceptor cho riotHttpClient (idempotent — gọi nhiều lần chỉ cài 1 lần):
 *  - Request: gắn metadata.startTime để đo độ trễ + log qua api-logger.
 *  - Response: phát hiện 401/403 từ Riot host hợp lệ → phát sự kiện phiên hết
 *    hạn (notifySessionAuthFailure) qua cơ chế session-event thống nhất; các
 *    screen KHÔNG tự redirect khi gặp 401 mà lắng nghe sự kiện này.
 * @returns riotHttpClient đã cài interceptor (export thường dùng bên dưới).
 */
export function installRiotInterceptors() {
  if (interceptorsInstalled) return riotHttpClient;
  interceptorsInstalled = true;
  void initApiLogger();

  riotHttpClient.interceptors.request.use(
    (config) => {
      if (API_DEBUG_LOGGING) {
        console.log(`${config.method?.toUpperCase()} ${config.url}`);
      }
      (config as TimedRequestConfig).metadata = { startTime: Date.now() };
      return logAxiosRequest(config);
    },
    (error) => Promise.reject(error),
  );

  riotHttpClient.interceptors.response.use(
    (response) => {
      const errorLike = { config: response.config, response };
      if (isRiotAuthenticationError(errorLike)) {
        notifySessionAuthFailure({
          status: response.status,
          url: getRequestUrl(errorLike),
          accessToken: getRequestAccessToken(errorLike),
        });
      }
      return logAxiosResponse(response);
    },
    (error) => {
      if (isRiotAuthenticationError(error)) {
        notifySessionAuthFailure({
          status: Number(error.response?.status) || 401,
          url: getRequestUrl(error),
          accessToken: getRequestAccessToken(error),
        });
      }
      return logAxiosError(error);
    },
  );

  return riotHttpClient;
}

// Instance axios mặc định của mọi API Riot: đã cài sẵn interceptor log +
// phát hiện lỗi phiên. Các file trong services/riot import hằng số này.
export const riotApiClient = installRiotInterceptors();
