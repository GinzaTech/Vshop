// Import thư viện FileSystem của expo để làm việc với file hệ thống
import * as FileSystem from "expo-file-system";
// Import Platform từ react-native để kiểm tra platform (web, ios, android)
import { Platform } from "react-native";

// Đường dẫn thư mục chứa file log API
const LOG_DIR = FileSystem.cacheDirectory + "api-logs/";
// Đường dẫn file log chính
const LOG_FILE = LOG_DIR + "requests.log";
// Dung lượng tối đa của file log trước khi rotate (5MB)
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB before rotation
// Số lượng entry tối đa lưu trong bộ đệm trước khi ghi file
const MAX_LOG_ENTRIES = 500;

// Type định nghĩa cấu trúc một entry log
type LogEntry = {
  ts: string;         // Timestamp (ISO string)
  method?: string;    // Phương thức HTTP (GET, POST,...)
  url: string;         // URL của request
  status?: number;    // Mã trạng thái HTTP response
  statusText?: string;// Text mô tả trạng thái HTTP
  durationMs?: number;// Thời gian thực thi request (ms)
  responseSize?: number;// Kích thước response (bytes)
  error?: string;     // Thông báo lỗi nếu có
};

// Bộ đệm lưu các log entry chưa được ghi xuống file
let logBuffer: LogEntry[] = [];
// Timeout cho việc lên lịch ghi log (debounce 3 giây)
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
// Promise đảm bảo thư mục log đã được khởi tạo
let initPromise: Promise<void> | null = null;
// Promise theo dõi quá trình ghi log xuống file
let flushPromise: Promise<void> | null = null;

/**
 * Đảm bảo thư mục log đã tồn tại, nếu chưa thì tạo mới.
 * Không làm gì trên nền tảng web.
 */
async function ensureDir() {
  if (Platform.OS === "web") return;
  const info = await FileSystem.getInfoAsync(LOG_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
  }
}

/**
 * Kiểm tra và thực hiện xoay vòng (rotate) file log nếu kích thước vượt quá MAX_LOG_SIZE.
 * File cũ được đổi tên thành requests_prev.log.
 * Không làm gì trên nền tảng web.
 */
async function rotateIfNeeded() {
  if (Platform.OS === "web") return;
  try {
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    if (info.exists && info.size && info.size > MAX_LOG_SIZE) {
      await FileSystem.deleteAsync(LOG_DIR + "requests_prev.log", {
        idempotent: true,
      });
      await FileSystem.moveAsync({
        from: LOG_FILE,
        to: LOG_DIR + "requests_prev.log",
      });
    }
  } catch {}
}

/**
 * Ghi toàn bộ dữ liệu trong bộ đệm (logBuffer) xuống file log.
 * Sử dụng cơ chế batch để tránh ghi trùng lặp đồng thời.
 * Nếu ghi thất bại, dữ liệu được giữ lại trong bộ đệm (giới hạn MAX_LOG_ENTRIES).
 */
async function flushBuffer(): Promise<void> {
  if (Platform.OS === "web") return;
  if (flushPromise) {
    await flushPromise;
    if (logBuffer.length > 0) {
      await flushBuffer();
    }
    return;
  }
  if (logBuffer.length === 0) return;

  const batch = logBuffer;
  logBuffer = [];
  flushPromise = (async () => {
    try {
      await ensureDir();
      await rotateIfNeeded();

      const newLines = batch.map((e) => JSON.stringify(e)).join("\n") + "\n";
      const existing = await FileSystem.readAsStringAsync(LOG_FILE).catch(() => "");
      await FileSystem.writeAsStringAsync(LOG_FILE, existing + newLines);
    } catch {
      // Nếu ghi thất bại, append ngược lại vào buffer, giới hạn MAX_LOG_ENTRIES entry cuối
      logBuffer = [...batch, ...logBuffer].slice(-MAX_LOG_ENTRIES);
    }
  })().finally(() => {
    flushPromise = null;
  });

  await flushPromise;
}

/**
 * Lên lịch ghi log sau 3 giây (debounce).
 * Gọi lại flushBuffer() nếu không có lịch nào đang chờ.
 */
function scheduleFlush() {
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    void flushBuffer();
  }, 3000);
}

/**
 * Public API: Thêm một entry log vào bộ đệm.
 * Nếu bộ đệm đầy (>= MAX_LOG_ENTRIES), ghi ngay lập tức, nếu không thì lên lịch sau 3s.
 * @param entry - LogEntry cần ghi log
 */
export function logApiCall(entry: LogEntry) {
  if (Platform.OS === "web") return;
  logBuffer.push(entry);

  if (logBuffer.length >= MAX_LOG_ENTRIES) {
    void flushBuffer();
  } else {
    scheduleFlush();
  }
}

/**
 * Public API: Ghi log một Axios request.
 * Thường được dùng làm interceptor request.
 * @param config - Cấu hình Axios request
 * @returns config - Trả về chính config để chain interceptor
 */
export function logAxiosRequest(config: any) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    method: config.method?.toUpperCase(),
    url: config.url || "",
  };
  logApiCall(entry);
  return config;
}

/**
 * Public API: Ghi log một Axios response.
 * Thường được dùng làm interceptor response.
 * Ghi lại status, thời gian thực thi, kích thước response.
 * @param response - Đối tượng response từ Axios
 * @returns response - Trả về chính response để chain interceptor
 */
export function logAxiosResponse(response: any) {
  const contentLength = Number(
    response.headers?.["content-length"] ??
      response.headers?.get?.("content-length")
  );
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    method: response.config?.method?.toUpperCase(),
    url: response.config?.url || "",
    status: response.status,
    statusText: response.statusText,
    durationMs: response.config?.metadata?.startTime
      ? Date.now() - response.config.metadata.startTime
      : undefined,
    responseSize: Number.isFinite(contentLength)
      ? contentLength
      : typeof response.data === "string"
        ? response.data.length
        : undefined,
  };
  logApiCall(entry);
  return response;
}

/**
 * Public API: Ghi log một Axios error.
 * Thường được dùng làm interceptor error.
 * @param error - Đối tượng lỗi từ Axios
 * @returns Promise.reject(error) - Trả về Promise bị reject để chain interceptor
 */
export function logAxiosError(error: any) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    method: error.config?.method?.toUpperCase(),
    url: error.config?.url || "",
    status: error.response?.status,
    statusText: error.response?.statusText,
    error: error.message || String(error),
  };
  logApiCall(entry);
  return Promise.reject(error);
}

/**
 * Public API: Đọc toàn bộ nội dung file log.
 * Đảm bảo dữ liệu trong bộ đệm được ghi trước khi đọc.
 * @returns Promise<string> - Nội dung file log hoặc thông báo
 */
export async function readApiLogs(): Promise<string> {
  if (Platform.OS === "web") return "Logging not available on web";
  try {
    await flushBuffer();
    const exists = await FileSystem.getInfoAsync(LOG_FILE);
    if (exists.exists) {
      return await FileSystem.readAsStringAsync(LOG_FILE);
    }
    return "No logs available";
  } catch {
    return "Failed to read logs";
  }
}

/**
 * Public API: Xóa toàn bộ thư mục log.
 * Ghi dữ liệu đệm trước khi xóa để tránh mất log.
 */
export async function clearApiLogs() {
  if (Platform.OS === "web") return;
  try {
    await flushBuffer();
    await FileSystem.deleteAsync(LOG_DIR, { idempotent: true });
  } catch {}
}

/**
 * Public API: Khởi tạo API Logger (tạo thư mục log nếu chưa có).
 * Sử dụng initPromise để tránh khởi tạo nhiều lần.
 */
export async function initApiLogger() {
  if (Platform.OS === "web") return;
  if (!initPromise) {
    initPromise = ensureDir();
  }
  return initPromise;
}
