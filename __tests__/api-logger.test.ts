import { Platform } from "react-native";
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { clearApiLogs, initApiLogger, logApiCall, logAxiosError, logAxiosRequest, logAxiosResponse, readApiLogs } from "~/utils/api-logger";

const mockGetInfoAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockMoveAsync = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  moveAsync: (...args: unknown[]) => mockMoveAsync(...args),
}));

describe("API logger", () => {
  const initialDev = __DEV__;
  const initialPlatform = Platform.OS;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_LOGGING = "1";
    jest.useFakeTimers();
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });
    mockReadAsStringAsync.mockResolvedValue("");
    mockWriteAsStringAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockMoveAsync.mockResolvedValue(undefined);
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await clearApiLogs();
    delete process.env.EXPO_PUBLIC_API_LOGGING;
    Object.defineProperty(globalThis, "__DEV__", { value: initialDev, configurable: true });
    Object.defineProperty(Platform, "OS", { value: initialPlatform, configurable: true });
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("records response time for failed requests", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1_750);
    const error = {
      config: {
        method: "get",
        url: "https://example.test/resource",
        metadata: { startTime: 1_000 },
      },
      response: { status: 503, statusText: "Service Unavailable" },
      message: "Request failed",
    };

    await expect(logAxiosError(error)).rejects.toBe(error);
    await readApiLogs();

    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    const writtenLog = mockWriteAsStringAsync.mock.calls[0]?.[1];
    expect(typeof writtenLog).toBe("string");
    expect(JSON.parse(String(writtenLog).trim())).toMatchObject({
      method: "GET",
      status: 503,
      durationMs: 750,
      error: "Operation failed",
    });
  });

  it("requires explicit debug opt-in and cleans up previous logs when disabled", async () => {
    delete process.env.EXPO_PUBLIC_API_LOGGING;
    await initApiLogger();
    logApiCall({ ts: "now", url: "https://example.test/secret" });
    expect(await readApiLogs()).toBe("API logging is disabled");
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
    expect(mockDeleteAsync).toHaveBeenCalledWith("file:///cache/api-logs/", { idempotent: true });
  });

  it("sanitizes dynamic identifiers and credentials before buffering", async () => {
    const entry = { ts: "now", url: "https://pd.ap.a.pvp.net/match-details/v1/matches/private-id?token=query-secret", error: "arbitrary-error-secret" };
    logApiCall(entry);
    entry.url = "https://example.test/mutated-secret";
    await readApiLogs();
    const written = String(mockWriteAsStringAsync.mock.calls[0]?.[1]);
    expect(written).not.toMatch(/private-id|query-secret|arbitrary-error-secret|mutated-secret/);
    expect(written).toContain("/match-details/v1/matches/[REDACTED]");
  });

  it("is disabled in production even with the flag set", async () => {
    Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true });
    const config = { headers: new AxiosHeaders(), url: "https://example.test/" };
    expect(logAxiosRequest(config)).toBe(config);
    expect(logAxiosResponse({ config } as AxiosResponse)).toMatchObject({ config });
    await expect(logAxiosError("raw-secret")).rejects.toBe("raw-secret");
    expect(await readApiLogs()).toBe("API logging is disabled");
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  });

  it("keeps interceptors transparent and records only numeric request metadata", async () => {
    const config: InternalAxiosRequestConfig & { metadata: { startTime: number } } = {
      headers: new AxiosHeaders(), method: "post", url: "https://example.test/players/account-secret", metadata: { startTime: Date.now() - 50 },
    };
    const response: AxiosResponse = { config, data: "body-secret", headers: { "content-length": "123" }, status: 200, statusText: "status-secret" };
    expect(logAxiosRequest(config)).toBe(config); expect(logAxiosResponse(response)).toBe(response);
    await expect(logAxiosError(null)).rejects.toBeNull();
    await readApiLogs();
    const written = String(mockWriteAsStringAsync.mock.calls[0]?.[1]);
    expect(written).not.toMatch(/body-secret|status-secret|account-secret/);
    expect(written).toContain('"responseSize":123');
  });

  it("discarding logs cancels buffered writes instead of flushing them", async () => {
    logApiCall({ ts: "now", url: "/players/private-id" });
    await clearApiLogs();
    jest.runOnlyPendingTimers();
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  });

  it("retains sanitized entries after a failed write and rotates large logs", async () => {
    mockWriteAsStringAsync.mockRejectedValueOnce(new Error("disk full"));
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 6 * 1024 * 1024 });
    logApiCall({ ts: "now", url: "/players/private-id" });
    await readApiLogs();
    await readApiLogs();
    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(2);
    expect(mockMoveAsync).toHaveBeenCalledWith({ from: "file:///cache/api-logs/requests.log", to: "file:///cache/api-logs/requests_prev.log" });
    expect(JSON.stringify(mockWriteAsStringAsync.mock.calls)).not.toContain("private-id");
  });

  it("returns safe messages for missing or unreadable logs", async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    expect(await readApiLogs()).toBe("No logs available");
    mockGetInfoAsync.mockRejectedValueOnce(new Error("private path"));
    expect(await readApiLogs()).toBe("Failed to read logs");
  });

  it("does not recreate files when disabled while a flush is waiting on disk", async () => {
    let finishRead!: (value: string) => void;
    let started!: () => void;
    const readStarted = new Promise<void>((resolve) => { started = resolve; });
    mockReadAsStringAsync.mockImplementationOnce(() => new Promise<string>((resolve) => { finishRead = resolve; started(); }));
    logApiCall({ ts: "now", url: "/players/private-id" });
    const reading = readApiLogs();
    await readStarted;
    delete process.env.EXPO_PUBLIC_API_LOGGING;
    finishRead("");
    expect(await reading).toBe("API logging is disabled");
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
    expect(mockDeleteAsync).toHaveBeenCalled();
  });

  it("retries a failed disabled cleanup without revealing legacy logs", async () => {
    await initApiLogger();
    delete process.env.EXPO_PUBLIC_API_LOGGING;
    mockDeleteAsync.mockRejectedValueOnce(new Error("filesystem failure"));
    expect(await readApiLogs()).toBe("API logging is disabled");
    expect(await readApiLogs()).toBe("API logging is disabled");
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
  });

  it("does not access the filesystem on web", async () => {
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    await initApiLogger(); logApiCall({ ts: "now", url: "/players/private-id" });
    await clearApiLogs();
    expect(await readApiLogs()).toBe("Logging not available on web");
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });
});
