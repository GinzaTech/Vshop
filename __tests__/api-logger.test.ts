import { logAxiosError, readApiLogs } from "~/utils/api-logger";

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
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 0 });
    mockReadAsStringAsync.mockResolvedValue("");
    mockWriteAsStringAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
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
      error: "Request failed",
    });
  });
});
