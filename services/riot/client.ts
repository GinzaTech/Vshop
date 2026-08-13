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
  isRiotAuthenticationError,
  notifySessionAuthFailure,
} from "~/utils/session-events";

type TimedRequestConfig = InternalAxiosRequestConfig & {
  metadata?: { startTime: number };
};

const API_DEBUG_LOGGING =
  __DEV__ && process.env.EXPO_PUBLIC_API_DEBUG_LOGGING === "1";

let interceptorsInstalled = false;

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
        });
      }
      return logAxiosResponse(response);
    },
    (error) => {
      if (isRiotAuthenticationError(error)) {
        notifySessionAuthFailure({
          status: Number(error.response?.status) || 401,
          url: getRequestUrl(error),
        });
      }
      return logAxiosError(error);
    },
  );

  return riotHttpClient;
}

export const riotApiClient = installRiotInterceptors();

