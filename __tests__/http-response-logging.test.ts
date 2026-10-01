import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from "axios";
import { riotHttpClient, publicHttpClient, telemetryHttpClient } from "~/services/http/clients";
import { recordApiResponse, installApiResponseLogging } from "~/utils/api-response-logger";
import { riotApiClient } from "~/services/riot/client";
import { subscribeSessionAuthFailures } from "~/utils/session-events";

jest.mock("~/utils/api-logger", () => ({
  initApiLogger: () => Promise.resolve(),
  logAxiosRequest: (config: unknown) => config,
  logAxiosResponse: (response: unknown) => response,
  logAxiosError: (error: unknown) => Promise.reject(error),
}));

jest.mock("~/utils/api-response-logger", () => {
  const actual: typeof import("~/utils/api-response-logger") = jest.requireActual("~/utils/api-response-logger");
  const record = jest.fn();
  return { ...actual, recordApiResponse: record, installApiResponseLogging: (client: import("axios").AxiosInstance, source: "riot" | "public" | "telemetry") => actual.installApiResponseLogging(client, source, record) };
});

describe("isolated HTTP response recording", () => {
  it.each([["riot", riotHttpClient], ["public", publicHttpClient], ["telemetry", telemetryHttpClient]] as const)("captures %s fulfilled responses exactly once without changing identity", async (source, client) => {
    const captured = jest.fn();
    // Injectable recorder verifies the wiring without filesystem side effects.
    const isolated = client;
    installApiResponseLogging(isolated, source);
    const adapter: AxiosAdapter = async (config) => ({ config, data: { count: 1 }, status: 403, statusText: "Forbidden", headers: new AxiosHeaders() });
    isolated.interceptors.response.use((response) => { captured(response); return response; });
    const result = await isolated.get("https://example.test/resource", { adapter, validateStatus: () => true });
    expect(captured).toHaveBeenCalledWith(result);
    expect(recordApiResponse).toHaveBeenCalledTimes(1);
    expect(recordApiResponse).toHaveBeenCalledWith(result, source);
  });

  it("keeps original HTTP error identity and records its response", async () => {
    let original: AxiosError;
    const adapter: AxiosAdapter = async (config) => {
      const response: AxiosResponse = { config, data: { count: 1 }, status: 401, statusText: "Unauthorized", headers: new AxiosHeaders() };
      original = new AxiosError("private-error", "ERR_BAD_REQUEST", config, undefined, response);
      throw original;
    };
    await expect(riotHttpClient.get("https://example.test/", { adapter })).rejects.toBeDefined();
    expect(recordApiResponse).toHaveBeenCalledTimes(1);
    expect(recordApiResponse).toHaveBeenCalledWith(original!.response, "riot");
    await riotHttpClient.get("https://example.test/", { adapter }).catch((error: unknown) => expect(error).toBe(original));
  });

  it("does not invent response records for network failures", async () => {
    const adapter: AxiosAdapter = async () => { throw new AxiosError("no-response", "ERR_NETWORK"); };
    await riotHttpClient.get("https://example.test/", { adapter }).catch(() => undefined);
    await telemetryHttpClient.get("https://example.test/", { adapter }).catch(() => undefined);
    expect(recordApiResponse).not.toHaveBeenCalled();
  });

  it("keeps original response/error identities even if the recorder throws", async () => {
    jest.mocked(recordApiResponse).mockImplementationOnce(() => { throw new Error("diagnostic failure"); });
    const adapter: AxiosAdapter = async (config) => ({ config, data: null, status: 204, statusText: "", headers: new AxiosHeaders() });
    await expect(publicHttpClient.get("https://example.test/", { adapter })).resolves.toMatchObject({ status: 204 });
    const client = axios.create();
    installApiResponseLogging(client, "riot");
    const hostile = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("private-error"); } });
    await expect(client.get("https://example.test/", { adapter: async () => { throw hostile; } })).rejects.toBe(hostile);
  });

  it("preserves Riot auth events for fulfilled and rejected 401s, without adding public events", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSessionAuthFailures(listener);
    const adapter: AxiosAdapter = async (config) => ({ config, data: { errorCode: "UNAUTHORIZED" }, status: 401, statusText: "", headers: new AxiosHeaders() });
    try {
      await riotApiClient.get("https://pd.ap.a.pvp.net/store/v1/wallet/private", { adapter, validateStatus: () => true, headers: { Authorization: "Bearer synthetic-test-token" } });
      await riotApiClient.get("https://pd.ap.a.pvp.net/store/v1/wallet/private", { adapter: async (config) => { throw new AxiosError("synthetic", "ERR_BAD_REQUEST", config, undefined, await adapter(config)); } }).catch(() => undefined);
      await publicHttpClient.get("https://example.test/resource", { adapter, validateStatus: () => true });
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[0][0]).toMatchObject({ status: 401, accessToken: "synthetic-test-token" });
      expect(recordApiResponse).toHaveBeenCalledTimes(3);
    } finally { unsubscribe(); }
  });
});
