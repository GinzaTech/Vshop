import axios, {
  AxiosError,
  AxiosHeaders,
  CanceledError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import { getPentestCompanionClient } from "~/services/pentest-companion/client.web";
import {
  PentestCompanionError,
  type PentestCompanionClient,
  type RiotProxyRequest,
  type RiotProxyResponse,
  type RiotProxyResponseType,
} from "~/services/pentest-companion/types";

type ProxyDependency = Pick<PentestCompanionClient, "proxy">;

const normalizeResponseType = (
  value: InternalAxiosRequestConfig["responseType"],
): RiotProxyResponseType => {
  if (!value || value === "json") return "json";
  if (value === "text" || value === "arraybuffer") return value;
  throw new AxiosError("UNSUPPORTED_RESPONSE_TYPE", "ERR_BAD_OPTION_VALUE");
};

const normalizeHeaders = (headers: InternalAxiosRequestConfig["headers"]) => {
  const values = AxiosHeaders.from(headers).toJSON(true);
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) =>
      typeof value === "string" ? [[key.toLowerCase(), value]] : []
    ),
  );
};

const normalizeBody = (config: InternalAxiosRequestConfig): unknown => {
  const { data } = config;
  if (data === undefined || data === null) return null;
  if (typeof data === "string") {
    const contentType = String(
      AxiosHeaders.from(config.headers).getContentType() || "",
    );
    if (contentType.toLowerCase().includes("json")) {
      try {
        return JSON.parse(data) as unknown;
      } catch {
        throw new AxiosError("INVALID_JSON_BODY", "ERR_BAD_REQUEST", config);
      }
    }
    return data;
  }
  if (
    typeof data === "number" ||
    typeof data === "boolean" ||
    Array.isArray(data) ||
    (typeof data === "object" && Object.getPrototypeOf(data) === Object.prototype)
  ) return data;
  throw new AxiosError("UNSUPPORTED_REQUEST_BODY", "ERR_BAD_REQUEST", config);
};

const toProxyRequest = (config: InternalAxiosRequestConfig): RiotProxyRequest => ({
  url: axios.getUri(config),
  method: String(config.method || "GET").toUpperCase(),
  headers: normalizeHeaders(config.headers),
  body: normalizeBody(config),
  responseType: normalizeResponseType(config.responseType),
});

const decodeArrayBuffer = (value: unknown) => {
  if (typeof value !== "string") throw new Error("INVALID_ARRAYBUFFER_RESPONSE");
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer;
};

const decodeResponseData = (
  upstream: RiotProxyResponse,
  responseType: RiotProxyResponseType,
) => {
  if (responseType === "arraybuffer") {
    if (upstream.encoding !== "base64") throw new Error("INVALID_ARRAYBUFFER_RESPONSE");
    return decodeArrayBuffer(upstream.data);
  }
  return upstream.data;
};

const linkAbortSignal = (
  source: InternalAxiosRequestConfig["signal"],
  controller: AbortController,
) => {
  const abort = () => controller.abort();
  if (source?.aborted) controller.abort();
  else source?.addEventListener?.("abort", abort, { once: true });
  return () => source?.removeEventListener?.("abort", abort);
};

export function createRiotWebAdapter({ proxy }: ProxyDependency): AxiosAdapter {
  return async (config) => {
    const controller = new AbortController();
    const detach = linkAbortSignal(config.signal, controller);
    let timedOut = false;
    const timeout = Number(config.timeout) > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, Number(config.timeout))
      : undefined;
    try {
      const request = toProxyRequest(config);
      const upstream = await proxy(request, controller.signal);
      const response: AxiosResponse = {
        data: decodeResponseData(upstream, request.responseType),
        status: upstream.status,
        statusText: upstream.statusText,
        headers: AxiosHeaders.from(upstream.headers),
        config,
        request: undefined,
      };
      if (!config.validateStatus || config.validateStatus(response.status)) return response;
      throw new AxiosError(
        `Request failed with status code ${response.status}`,
        response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        response,
      );
    } catch (error) {
      if (error instanceof AxiosError) throw error;
      if (config.signal?.aborted) throw new CanceledError(undefined, config);
      if (timedOut) {
        throw new AxiosError(
          `timeout of ${config.timeout}ms exceeded`,
          AxiosError.ECONNABORTED,
          config,
        );
      }
      if (error instanceof PentestCompanionError) {
        throw new AxiosError(error.code, error.code, config);
      }
      throw new AxiosError("COMPANION_UNAVAILABLE", AxiosError.ERR_NETWORK, config);
    } finally {
      if (timeout) clearTimeout(timeout);
      detach();
    }
  };
}

let adapter: AxiosAdapter | null = null;

export const getRiotHttpAdapter = (): AxiosAdapter => {
  if (!adapter) {
    adapter = createRiotWebAdapter({
      proxy: (request, signal) => getPentestCompanionClient().proxy(request, signal),
    });
  }
  return adapter;
};
