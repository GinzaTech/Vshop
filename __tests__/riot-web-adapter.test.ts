import axios, { AxiosError, CanceledError } from "axios";
import { getRiotHttpAdapter as getNativeRiotHttpAdapter } from "~/services/http/riot-adapter";
import {
  createRiotWebAdapter,
  getRiotHttpAdapter as getWebRiotHttpAdapter,
} from "~/services/http/riot-adapter.web";
import { PentestCompanionError, type RiotProxyResponse } from "~/services/pentest-companion/types";
import { isRiotAuthenticationError } from "~/utils/session-events";

const success = (overrides: Partial<RiotProxyResponse> = {}): RiotProxyResponse => ({
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json" },
  data: { ok: true },
  ...overrides,
});

describe("Riot web Axios adapter", () => {
  it("preserves the original Riot URL, method, headers and metadata", async () => {
    const proxy = jest.fn().mockResolvedValue(success());
    const client = axios.create({ adapter: createRiotWebAdapter({ proxy }) });
    const response = await client.get("https://auth.riotgames.com/userinfo", {
      headers: { Authorization: "Bearer secret-canary" },
      params: { trace: "safe" },
    });
    expect(response.config.url).toBe("https://auth.riotgames.com/userinfo");
    expect(response.config.method).toBe("get");
    expect(response.config.headers.get("Authorization")).toBe("Bearer secret-canary");
    expect(proxy).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://auth.riotgames.com/userinfo?trace=safe",
      method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer secret-canary" }),
      body: null,
      responseType: "json",
    }), expect.any(AbortSignal));
  });

  it("preserves the Riot config on a 401 AxiosError for session classification", async () => {
    const client = axios.create({
      adapter: createRiotWebAdapter({
        proxy: async () => success({ status: 401, statusText: "Unauthorized", data: {} }),
      }),
    });
    const error = await client.get("https://auth.riotgames.com/userinfo", {
      headers: { Authorization: "Bearer old-token" },
    }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AxiosError);
    expect((error as AxiosError).config?.url).toBe("https://auth.riotgames.com/userinfo");
    expect(isRiotAuthenticationError(error)).toBe(true);
  });

  it("serializes transformed JSON request bodies without double encoding", async () => {
    const proxy = jest.fn().mockResolvedValue(success());
    const client = axios.create({ adapter: createRiotWebAdapter({ proxy }) });
    await client.put("https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant", {
      id_token: "id-token-canary",
    }, {
      headers: { "Content-Type": "application/json" },
    });
    expect(proxy).toHaveBeenCalledWith(expect.objectContaining({
      method: "PUT",
      body: { id_token: "id-token-canary" },
    }), expect.any(AbortSignal));
  });

  it("decodes base64 arraybuffer responses", async () => {
    const client = axios.create({
      adapter: createRiotWebAdapter({
        proxy: async () => success({ data: "AQI=", encoding: "base64" }),
      }),
    });
    const response = await client.get("https://auth.riotgames.com/userinfo", {
      responseType: "arraybuffer",
    });
    expect(Array.from(new Uint8Array(response.data as ArrayBuffer))).toEqual([1, 2]);
  });

  it("preserves text response type and plain text request bodies", async () => {
    const proxy = jest.fn().mockResolvedValue(success({
      data: "plain-response",
      headers: { "content-type": "text/plain" },
    }));
    const client = axios.create({ adapter: createRiotWebAdapter({ proxy }) });
    const response = await client.post(
      "https://auth.riotgames.com/api/v1/authorization",
      "plain-request",
      { headers: { "Content-Type": "text/plain" }, responseType: "text" },
    );
    expect(response.data).toBe("plain-response");
    expect(proxy).toHaveBeenCalledWith(expect.objectContaining({
      body: "plain-request",
      responseType: "text",
    }), expect.any(AbortSignal));
  });

  it.each([1, true, ["value"]])("accepts JSON-compatible body %j", async (body) => {
    const proxy = jest.fn().mockResolvedValue(success());
    const client = axios.create({ adapter: createRiotWebAdapter({ proxy }) });
    await client.post("https://auth.riotgames.com/api/v1/authorization", body, {
      transformRequest: [(value) => value],
    });
    expect(proxy).toHaveBeenCalledWith(expect.objectContaining({ body }), expect.any(AbortSignal));
  });

  it("rejects invalid JSON, unsupported bodies and response types", async () => {
    const proxy = jest.fn().mockResolvedValue(success());
    const client = axios.create({ adapter: createRiotWebAdapter({ proxy }) });
    await expect(client.post(
      "https://auth.riotgames.com/api/v1/authorization",
      "{",
      {
        headers: { "Content-Type": "application/json" },
        transformRequest: [(value) => value],
      },
    )).rejects.toMatchObject({ code: "ERR_BAD_REQUEST", message: "INVALID_JSON_BODY" });
    await expect(client.post(
      "https://auth.riotgames.com/api/v1/authorization",
      new Date(),
      { transformRequest: [(value) => value] },
    )).rejects.toMatchObject({ code: "ERR_BAD_REQUEST", message: "UNSUPPORTED_REQUEST_BODY" });
    await expect(client.get("https://auth.riotgames.com/userinfo", {
      responseType: "stream",
    })).rejects.toMatchObject({ code: "ERR_BAD_OPTION_VALUE" });
  });

  it("maps malformed arraybuffer and unknown proxy errors safely", async () => {
    const malformed = axios.create({
      adapter: createRiotWebAdapter({
        proxy: async () => success({ data: { not: "base64" }, encoding: "base64" }),
      }),
    });
    await expect(malformed.get("https://auth.riotgames.com/userinfo", {
      responseType: "arraybuffer",
    })).rejects.toMatchObject({ code: "ERR_NETWORK", message: "COMPANION_UNAVAILABLE" });

    const unknown = axios.create({
      adapter: createRiotWebAdapter({ proxy: async () => { throw new Error("raw-secret"); } }),
    });
    await expect(unknown.get("https://auth.riotgames.com/userinfo"))
      .rejects.toMatchObject({ code: "ERR_NETWORK", message: "COMPANION_UNAVAILABLE" });
  });

  it("maps companion policy errors without leaking their cause", async () => {
    const client = axios.create({
      adapter: createRiotWebAdapter({
        proxy: async () => { throw new PentestCompanionError("MUTATION_BLOCKED"); },
      }),
    });
    const error = await client.post(
      "https://glz-ap-1.ap.a.pvp.net/parties/v1/parties/p/matchmaking/join",
    ).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AxiosError);
    expect(error).toMatchObject({ code: "MUTATION_BLOCKED", message: "MUTATION_BLOCKED" });
    expect((error as AxiosError).config?.url).toContain("pvp.net");
  });

  it("maps AbortSignal cancellation to CanceledError", async () => {
    const controller = new AbortController();
    const proxy = jest.fn((request, signal: AbortSignal) => new Promise<RiotProxyResponse>((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const client = axios.create({ adapter: createRiotWebAdapter({ proxy }) });
    const pending = client.get("https://auth.riotgames.com/userinfo", {
      signal: controller.signal,
    }).catch((value: unknown) => value);
    controller.abort();
    await expect(pending).resolves.toBeInstanceOf(CanceledError);
  });

  it("honors a signal that is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const client = axios.create({
      adapter: createRiotWebAdapter({
        proxy: async () => { throw new Error("aborted"); },
      }),
    });
    await expect(client.get("https://auth.riotgames.com/userinfo", {
      signal: controller.signal,
    })).rejects.toBeInstanceOf(CanceledError);
  });

  it("maps adapter timeout to ECONNABORTED", async () => {
    jest.useFakeTimers();
    try {
      const proxy = jest.fn((request, signal: AbortSignal) => new Promise<RiotProxyResponse>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("timeout-secret")), { once: true });
      }));
      const client = axios.create({ adapter: createRiotWebAdapter({ proxy }) });
      const pending = client.get("https://auth.riotgames.com/userinfo", {
        timeout: 25,
      }).catch((value: unknown) => value);
      jest.advanceTimersByTime(26);
      const error = await pending;
      expect(error).toBeInstanceOf(AxiosError);
      expect(error).toMatchObject({ code: "ECONNABORTED" });
      expect(String((error as Error).message)).not.toContain("timeout-secret");
    } finally {
      jest.useRealTimers();
    }
  });

  it("never falls back to direct Riot fetch when companion is unavailable", async () => {
    const directFetch = jest.spyOn(globalThis, "fetch");
    const client = axios.create({
      adapter: createRiotWebAdapter({
        proxy: async () => { throw new PentestCompanionError("COMPANION_UNAVAILABLE"); },
      }),
    });
    await expect(client.get("https://pd.ap.a.pvp.net/store/v1/offers"))
      .rejects.toMatchObject({ code: "COMPANION_UNAVAILABLE" });
    expect(directFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("pvp.net"),
      expect.anything(),
    );
    directFetch.mockRestore();
  });

  it("keeps the native adapter undefined", () => {
    expect(getNativeRiotHttpAdapter()).toBeUndefined();
  });

  it("memoizes the production web adapter without connecting eagerly", () => {
    expect(getWebRiotHttpAdapter()).toBe(getWebRiotHttpAdapter());
  });
});
