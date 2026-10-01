import { Platform } from "react-native";
import { recordApiResponse, flushApiResponses, clearApiResponses, API_RESPONSE_LIMITS } from "~/utils/api-response-logger";

const mockInfo = jest.fn();
const mockRead = jest.fn();
const mockWrite = jest.fn();
const mockMkdir = jest.fn();
const mockDelete = jest.fn();
const mockMove = jest.fn();
const mockAppend = jest.fn();
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    write(value: string, options: { append: boolean }) { mockAppend(this.uri, value, options); }
  },
}));
jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  getInfoAsync: (...args: unknown[]) => mockInfo(...args),
  readAsStringAsync: (...args: unknown[]) => mockRead(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWrite(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMkdir(...args),
  deleteAsync: (...args: unknown[]) => mockDelete(...args),
  moveAsync: (...args: unknown[]) => mockMove(...args),
}));

const response = (data: unknown = { count: 1 }) => ({ config: { method: "get", url: "https://pd.ap.a.pvp.net/store/v1/wallet/private?token=secret", headers: { Authorization: "Bearer header-secret" }, data: "request-secret" }, headers: { "content-type": "application/json", "set-cookie": "cookie-secret" }, status: 200, statusText: "status-secret", data });
const written = () => [...mockWrite.mock.calls, ...mockAppend.mock.calls].map((call: unknown[]) => String(call[1])).join("");
describe("dev response JSONL logger", () => {
  const dev = __DEV__;
  const platform = Platform.OS;
  beforeEach(async () => {
    process.env.EXPO_PUBLIC_API_RESPONSE_LOGGING = "1";
    Object.defineProperty(globalThis, "__DEV__", { value: true, configurable: true });
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    mockInfo.mockResolvedValue({ exists: false, size: 0 });
    mockRead.mockResolvedValue("");
    mockWrite.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockMove.mockResolvedValue(undefined);
    mockAppend.mockReset().mockReturnValue(undefined);
    await clearApiResponses();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(async () => {
    await clearApiResponses();
    jest.useRealTimers();
    delete process.env.EXPO_PUBLIC_API_RESPONSE_LOGGING;
    Object.defineProperty(globalThis, "__DEV__", { value: dev, configurable: true });
    Object.defineProperty(Platform, "OS", { value: platform, configurable: true });
    jest.restoreAllMocks();
  });

  it("appends only the new batch without reading or rewriting a large existing log", async () => {
    mockInfo.mockResolvedValue({ exists: true, size: 18 * 1024 * 1024 });
    recordApiResponse(response(), "riot");
    await flushApiResponses();
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockAppend).toHaveBeenCalledWith("file:///cache/api-responses/responses.jsonl", expect.any(String), { append: true });
    expect(Buffer.byteLength(written())).toBeLessThan(1024);
  });

  it("records numeric request duration without retaining request metadata", async () => {
    jest.spyOn(Date, "now").mockReturnValue(5000);
    const value = response();
    recordApiResponse({ ...value, config: { ...value.config, metadata: { startTime: 4700, secret: "metadata-secret" } } }, "riot");
    await flushApiResponses();
    expect(JSON.parse(written()).durationMs).toBe(300);
    expect(written()).not.toContain("metadata-secret");
  });

  it.each(["flag", "production", "web"])("does zero I/O when disabled by %s", async (mode) => {
    if (mode === "flag") delete process.env.EXPO_PUBLIC_API_RESPONSE_LOGGING;
    if (mode === "production") Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true });
    if (mode === "web") Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    const getter = jest.fn();
    recordApiResponse(Object.defineProperty({}, "data", { get: getter }), "riot");
    await flushApiResponses();
    // An explicit native DEV clear is deliberately allowed with only the flag
    // disabled; production/web remain zero-I/O even for that explicit request.
    if (mode !== "flag") await clearApiResponses();
    expect(getter).not.toHaveBeenCalled();
    for (const mock of [mockInfo, mockRead, mockWrite, mockMkdir, mockDelete, mockMove, mockAppend]) expect(mock).not.toHaveBeenCalled();
  });

  it("writes a detached sanitized record, without configs, headers or console", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const source = { count: 1, token: "body-secret" };
    recordApiResponse(response(source), "riot");
    source.count = 9;
    await flushApiResponses();
    expect(mockAppend.mock.calls[0][0]).toBe("file:///cache/api-responses/responses.jsonl");
    expect(JSON.parse(written())).toMatchObject({ source: "riot", status: 200, method: "GET", body: { count: 1, token: "[REDACTED]" }, truncated: false });
    expect(written()).not.toMatch(/header-secret|cookie-secret|body-secret|request-secret|status-secret|private|token=secret/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("captures an HTTP error body and handles poisoned input safely", async () => {
    recordApiResponse({ ...response({ errorCode: "BAD_REQUEST", token: "secret" }), status: 403 }, "public");
    expect(() => recordApiResponse(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("secret"); } }), "riot")).not.toThrow();
    await flushApiResponses();
    const records = written().trim().split("\n").map((line) => JSON.parse(line));
    expect(records).toContainEqual(expect.objectContaining({ status: 403, outcome: "http-error", body: expect.objectContaining({ errorCode: "BAD_REQUEST" }) }));
    expect(records).toContainEqual(expect.objectContaining({ event: "capture-loss", droppedRecords: 1 }));
  });

  it("writes automatically on the bounded flush timer", async () => {
    recordApiResponse(response(), "riot");
    await jest.advanceTimersByTimeAsync(1000);
    await flushApiResponses();
    expect(mockAppend).toHaveBeenCalledTimes(1);
  });

  it("records parsed Riot JSON despite text/plain MIME while redacting credentials", async () => {
    recordApiResponse({ ...response({ count: 3, token: "mime-token-secret" }), headers: { "content-type": "text/plain; charset=utf-8" } }, "riot");
    await flushApiResponses();
    expect(JSON.parse(written())).toMatchObject({ body: { count: 3, token: "[REDACTED]" }, omissions: ["credential-field"] });
    expect(written()).not.toContain("mime-token-secret");
  });

  it("reports disk failure on retry without affecting callers", async () => {
    mockAppend.mockImplementationOnce(() => { throw new Error("disk-secret"); });
    recordApiResponse(response(), "riot");
    await expect(flushApiResponses()).resolves.toBeUndefined();
    await flushApiResponses();
    expect(written()).toContain('"diskErrors":1');
    expect(written()).not.toContain("disk-secret");
  });

  it("rotates before adding a record that would exceed the file limit", async () => {
    mockInfo.mockResolvedValue({ exists: true, size: API_RESPONSE_LIMITS.maxFileBytes - 1 });
    recordApiResponse(response(), "riot");
    await flushApiResponses();
    expect(mockMove).toHaveBeenCalledWith({ from: "file:///cache/api-responses/responses.jsonl", to: "file:///cache/api-responses/responses.prev.jsonl" });
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("explicitly marks oversized payloads and buffer overflow", async () => {
    const data = Array.from({ length: 500 }, () => ({ displayName: "界😀".repeat(1000) }));
    const entry = response(data);
    for (let i = 0; i < 8; i++) recordApiResponse({ ...entry, config: { ...entry.config, url: "https://valorant-api.com/v1/weapons" } }, "public");
    await flushApiResponses();
    expect(written().includes('"truncated":true')).toBe(true);
    expect(written().includes('"droppedRecords":')).toBe(true);
    for (const call of mockAppend.mock.calls) expect(Buffer.byteLength(String(call[1]))).toBeLessThanOrEqual(API_RESPONSE_LIMITS.maxFileBytes);
  });

  it("discards pending writes when the live flag is turned off", async () => {
    let release!: (value: { exists: true; size: number }) => void;
    let started!: () => void;
    const reading = new Promise<void>((resolve) => { started = resolve; });
    mockInfo.mockResolvedValue({ exists: true, size: 100 });
    mockInfo.mockImplementationOnce(() => new Promise<{ exists: true; size: number }>((resolve) => { release = resolve; started(); }));
    recordApiResponse(response(), "riot");
    const flushing = flushApiResponses();
    await reading;
    delete process.env.EXPO_PUBLIC_API_RESPONSE_LOGGING;
    release({ exists: true, size: 100 });
    await flushing;
    expect(mockAppend).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("clearing cancels buffered and queued writes", async () => {
    recordApiResponse(response(), "riot");
    await clearApiResponses();
    await jest.advanceTimersByTimeAsync(1000);
    await flushApiResponses();
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it("explicit clearing deletes old captures after the recording flag is disabled", async () => {
    recordApiResponse(response(), "riot");
    await flushApiResponses();
    mockAppend.mockClear();
    delete process.env.EXPO_PUBLIC_API_RESPONSE_LOGGING;
    await clearApiResponses();
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockDelete).toHaveBeenCalledWith("file:///cache/api-responses/", { idempotent: true });
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it("reports explicit clear failure without exposing a private disk path when capture is off", async () => {
    delete process.env.EXPO_PUBLIC_API_RESPONSE_LOGGING;
    mockDelete.mockRejectedValueOnce(new Error("private-disk-path"));
    await expect(clearApiResponses()).rejects.toThrow("Unable to clear API response logs");
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it("disabled clear waits for in-flight I/O and prevents its old batch from reappearing", async () => {
    let release!: (value: { exists: true; size: number }) => void;
    let started!: () => void;
    const reading = new Promise<void>((resolve) => { started = resolve; });
    mockInfo.mockImplementationOnce(() => new Promise<{ exists: true; size: number }>((resolve) => { release = resolve; started(); }));
    recordApiResponse(response(), "riot");
    const flushing = flushApiResponses();
    await reading;
    delete process.env.EXPO_PUBLIC_API_RESPONSE_LOGGING;
    const clearing = clearApiResponses();
    release({ exists: true, size: 100 });
    await flushing; await clearing;
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it("handles missing/accessor bodies and relative URLs without inspecting headers", async () => {
    const getter = jest.fn();
    const noBody = { status: 204, config: { method: "invalid", url: "items", baseURL: "https://example.test/v1" } };
    recordApiResponse(noBody, "telemetry");
    recordApiResponse(Object.defineProperty({ ...noBody, status: 200 }, "data", { get: getter }), "public");
    recordApiResponse({ ...response(), status: 999 }, "riot");
    recordApiResponse({ status: 200, data: null }, "riot");
    await flushApiResponses();
    const records = written().trim().split("\n").map((line) => JSON.parse(line));
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ method: "UNKNOWN", url: "https://example.test/v1/items", body: null, omissions: ["no-body"] });
    expect(records[1].omissions).toEqual(["accessor"]);
    expect(getter).not.toHaveBeenCalled();
  });

  it("bounds record count and reports a failed clear on the next successful flush", async () => {
    for (let i = 0; i < API_RESPONSE_LIMITS.maxEntries + 2; i++) recordApiResponse(response(), "riot");
    await flushApiResponses();
    expect(written().includes('"droppedRecords":2')).toBe(true);
    mockDelete.mockRejectedValueOnce(new Error("private-disk-path"));
    await expect(clearApiResponses()).rejects.toThrow("Unable to clear API response logs");
    await flushApiResponses();
    expect(written().includes('"diskErrors":1')).toBe(true);
    expect(written().includes("private-disk-path")).toBe(false);
  });

  it("serializes overlapping flushes and permits clear during an in-flight read", async () => {
    let release!: (value: { exists: true; size: number }) => void;
    let started!: () => void;
    const reading = new Promise<void>((resolve) => { started = resolve; });
    mockInfo.mockResolvedValue({ exists: true, size: 100 });
    mockInfo.mockImplementationOnce(() => new Promise<{ exists: true; size: number }>((resolve) => { release = resolve; started(); }));
    recordApiResponse(response(), "riot");
    const first = flushApiResponses();
    await reading;
    expect(flushApiResponses()).toBe(first);
    const clearing = clearApiResponses();
    release({ exists: true, size: 100 });
    await first; await clearing;
    expect(mockAppend).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
