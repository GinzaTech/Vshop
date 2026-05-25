import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

const LOG_DIR = FileSystem.cacheDirectory + "api-logs/";
const LOG_FILE = LOG_DIR + "requests.log";
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB before rotation
const MAX_LOG_ENTRIES = 500;

type LogEntry = {
  ts: string;
  method?: string;
  url: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  responseSize?: number;
  error?: string;
};

let logBuffer: LogEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let initPromise: Promise<void> | null = null;

async function ensureDir() {
  if (Platform.OS === "web") return;
  const info = await FileSystem.getInfoAsync(LOG_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
  }
}

async function rotateIfNeeded() {
  if (Platform.OS === "web") return;
  try {
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    if (info.exists && info.size && info.size > MAX_LOG_SIZE) {
      await FileSystem.moveAsync({
        from: LOG_FILE,
        to: LOG_DIR + "requests_prev.log",
      });
    }
  } catch {}
}

async function flushBuffer() {
  if (Platform.OS === "web" || logBuffer.length === 0) return;
  try {
    await ensureDir();
    await rotateIfNeeded();

    const newLines = logBuffer.map((e) => JSON.stringify(e)).join("\n") + "\n";
    const existing = await FileSystem.readAsStringAsync(LOG_FILE).catch(() => "");
    await FileSystem.writeAsStringAsync(LOG_FILE, existing + newLines);
    logBuffer = [];
  } catch {}
}

function scheduleFlush() {
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(() => {
    flushBuffer();
  }, 3000);
}

export function logApiCall(entry: LogEntry) {
  if (Platform.OS === "web") return;
  logBuffer.push(entry);

  if (logBuffer.length >= MAX_LOG_ENTRIES) {
    flushBuffer();
  } else {
    scheduleFlush();
  }
}

export function logAxiosRequest(config: any) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    method: config.method?.toUpperCase(),
    url: config.url || "",
  };
  logApiCall(entry);
  return config;
}

export function logAxiosResponse(response: any) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    method: response.config?.method?.toUpperCase(),
    url: response.config?.url || "",
    status: response.status,
    statusText: response.statusText,
    durationMs: response.config?.metadata?.startTime
      ? Date.now() - response.config.metadata.startTime
      : undefined,
    responseSize: JSON.stringify(response.data).length,
  };
  logApiCall(entry);
  return response;
}

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

export async function clearApiLogs() {
  if (Platform.OS === "web") return;
  try {
    await flushBuffer();
    await FileSystem.deleteAsync(LOG_DIR, { idempotent: true });
  } catch {}
}

export async function initApiLogger() {
  if (Platform.OS === "web") return;
  if (!initPromise) {
    initPromise = ensureDir();
  }
  return initPromise;
}
