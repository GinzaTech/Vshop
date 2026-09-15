import axios, { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { installTraceInstrumentation } from "~/utils/flow-trace-instrumentation";
import type { TraceEventInput } from "~/utils/flow-trace-types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (_key, callback) => { callback?.(null, "opaque-secret"); return "opaque-secret"; }),
  setItem: jest.fn(async (_key, _value, callback) => { callback?.(null); }),
  removeItem: jest.fn(async (_key, callback) => { callback?.(null); }),
}));

describe("metadata-only instrumentation", () => {
  let enabled = true;
  let undo: () => void;
  let events: TraceEventInput[];
  let request: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
  let response: (result: AxiosResponse) => AxiosResponse;
  let reject: (error: unknown) => Promise<never>;
  const initialFetch = globalThis.fetch;
  const get = AsyncStorage.getItem;

  beforeEach(() => {
    enabled = true; events = [];
    jest.spyOn(axios.interceptors.request, "use").mockImplementation((fn) => { request = fn as typeof request; return 11; });
    jest.spyOn(axios.interceptors.response, "use").mockImplementation((fn, err) => { response = fn as typeof response; reject = err as typeof reject; return 12; });
    jest.spyOn(axios.interceptors.request, "eject");
    jest.spyOn(axios.interceptors.response, "eject");
    globalThis.fetch = jest.fn();
    undo = installTraceInstrumentation(() => enabled, (event) => events.push(event));
  });
  afterEach(() => { undo(); globalThis.fetch = initialFetch; jest.restoreAllMocks(); });

  it("observes axios metadata without retaining config, response bodies or raw errors", async () => {
    const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders({ Authorization: "Bearer opaque-secret" }), url: "https://example.test/players/private-id?token=url-secret", method: "get", data: "body-secret" };
    const result: AxiosResponse = { config, data: "response-secret", status: 200, statusText: "opaque-status-secret", headers: { cookie: "jar-secret" } };
    expect(request(config)).toBe(config);
    expect(response(result)).toBe(result);
    const error = Object.assign(new Error("error-secret"), { config });
    await expect(reject(error)).rejects.toBe(error);
    config.url = "mutated-secret";
    expect(events.map((event) => event.type)).toEqual(["API_REQUEST", "API_RESPONSE", "API_ERROR"]);
    expect(JSON.stringify(events)).not.toMatch(/opaque-secret|private-id|url-secret|body-secret|response-secret|opaque-status-secret|jar-secret|error-secret|mutated-secret/);
  });

  it("preserves storage values and callbacks but never logs their contents", async () => {
    const callback = jest.fn();
    expect(await AsyncStorage.getItem("secret-key", callback)).toBe("opaque-secret");
    expect(callback).toHaveBeenCalledWith(null, "opaque-secret");
    await AsyncStorage.setItem("secret-key", "write-secret", callback);
    await AsyncStorage.removeItem("secret-key", callback);
    expect(events.map((event) => event.type)).toEqual(["STORAGE_READ", "STORAGE_WRITE", "STORAGE_WRITE"]);
    expect(JSON.stringify(events)).not.toMatch(/opaque-secret|write-secret|secret-key/);
  });

  it("does not read or clone fetch bodies and preserves response identity", async () => {
    undo();
    const result = { ok: true, status: 200, clone: jest.fn() } as unknown as Response;
    const original = jest.fn(async () => result);
    globalThis.fetch = original;
    undo = installTraceInstrumentation(() => enabled, (event) => events.push(event));
    expect(await fetch("https://example.test/matches/private-id?token=url-secret", { body: "body-secret" })).toBe(result);
    expect(result.clone).not.toHaveBeenCalled();
    expect(JSON.stringify(events)).not.toMatch(/private-id|url-secret|body-secret/);
    expect(events).toHaveLength(2);
  });

  it("handles rejected and unsuccessful fetch calls without exposing errors", async () => {
    undo();
    const error = new Error("opaque-secret");
    const original = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({ ok: false, status: 503 });
    globalThis.fetch = original;
    undo = installTraceInstrumentation(() => enabled, (event) => events.push(event));
    await expect(fetch(new URL("https://example.test/"))).rejects.toBe(error);
    await fetch({ url: "https://example.test/", method: "GET" } as Request);
    expect(events.filter((event) => event.type === "API_ERROR")).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain("opaque-secret");
  });

  it("all installed hooks remain inert after opt-out and teardown restores originals", async () => {
    enabled = false;
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    request(config); response({ config } as AxiosResponse);
    await expect(reject("original")).rejects.toBe("original");
    await AsyncStorage.getItem("key"); await AsyncStorage.setItem("key", "value"); await AsyncStorage.removeItem("key");
    await fetch("https://example.test");
    expect(events).toEqual([]);
    undo();
    expect(AsyncStorage.getItem).toBe(get);
    expect(axios.interceptors.request.eject).toHaveBeenCalledWith(11);
    expect(axios.interceptors.response.eject).toHaveBeenCalledWith(12);
    installTraceInstrumentation(() => false, jest.fn())();
  });

  it("does not erase a later fetch wrapper during teardown", () => {
    const later = jest.fn();
    globalThis.fetch = later;
    undo();
    expect(globalThis.fetch).toBe(later);
    globalThis.fetch = undefined as unknown as typeof fetch;
    installTraceInstrumentation(() => true, jest.fn())();
  });
});
