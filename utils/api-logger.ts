import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { sanitizeErrorForLog, sanitizeUrlForLog } from "./log-redaction";

type TimedAxiosConfig = InternalAxiosRequestConfig & { metadata?: { startTime?: number } };
type TimedAxiosResponse<T = unknown> = Omit<AxiosResponse<T>, "config"> & { config: TimedAxiosConfig };
type LogEntry = {
  ts: string; method?: string; url: string; status?: number; statusText?: string;
  durationMs?: number; responseSize?: number; error?: string;
};
const LOG_DIR = FileSystem.cacheDirectory + "api-logs/";
const LOG_FILE = LOG_DIR + "requests.log";
const MAX_LOG_ENTRIES = 500;
const MAX_LOG_SIZE = 5 * 1024 * 1024;
let logBuffer: LogEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let ioTail: Promise<void> = Promise.resolve();
let epoch = 0;
let initialized = false;
let disabledCleanup: Promise<void> | null = null;

const isEnabled = () => __DEV__ && process.env.EXPO_PUBLIC_API_LOGGING === "1" && Platform.OS !== "web";
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
const clearBuffer = () => {
  epoch += 1;
  logBuffer = [];
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = null;
};

/** Serialize deletion, initialization and writes so a late flush cannot recreate old logs. */
function enqueue(work: () => Promise<void>): Promise<void> {
  const next = ioTail.then(work);
  ioTail = next.catch(() => undefined);
  return next;
}

async function deleteLogs() {
  initialized = false;
  await FileSystem.deleteAsync(LOG_DIR, { idempotent: true });
}

function disableLogging(): Promise<void> {
  clearBuffer();
  if (Platform.OS === "web") return Promise.resolve();
  if (!disabledCleanup) {
    disabledCleanup = enqueue(deleteLogs).catch(() => {
      disabledCleanup = null; // Retry cleanup on the next call; never expose old logs.
    });
  }
  return disabledCleanup;
}

async function ensureFreshDirectory() {
  if (initialized) return;
  // Existing files may predate redaction. Start a fresh diagnostic session.
  await deleteLogs();
  await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
  initialized = true;
}

async function flushBuffer(): Promise<void> {
  if (!isEnabled()) return disableLogging();
  disabledCleanup = null;
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = null;
  const batch = logBuffer;
  logBuffer = [];
  const generation = epoch;
  await enqueue(async () => {
    if (!batch.length || generation !== epoch || !isEnabled()) return;
    try {
      await ensureFreshDirectory();
      const info = await FileSystem.getInfoAsync(LOG_FILE);
      if (info.exists && info.size > MAX_LOG_SIZE) {
        await FileSystem.deleteAsync(LOG_DIR + "requests_prev.log", { idempotent: true });
        await FileSystem.moveAsync({ from: LOG_FILE, to: LOG_DIR + "requests_prev.log" });
      }
      const existing = await FileSystem.readAsStringAsync(LOG_FILE).catch(() => "");
      if (!isEnabled() || generation !== epoch) return;
      await FileSystem.writeAsStringAsync(LOG_FILE, existing + batch.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
    } catch {
      if (isEnabled() && generation === epoch) logBuffer = [...batch, ...logBuffer].slice(-MAX_LOG_ENTRIES);
    }
  });
  if (!isEnabled()) await disableLogging();
}

export function logApiCall(entry: LogEntry) {
  if (!isEnabled()) { void disableLogging(); return; }
  disabledCleanup = null;
  // Allowlist fields and copy scalars immediately; never retain caller-owned data.
  const safe: LogEntry = {
    ts: new Date().toISOString(),
    method: entry.method && /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/i.test(entry.method) ? entry.method.toUpperCase() : undefined,
    url: sanitizeUrlForLog(entry.url), status: finite(entry.status),
    durationMs: finite(entry.durationMs), responseSize: finite(entry.responseSize),
    ...(entry.error === undefined ? {} : { error: sanitizeErrorForLog(entry.error).message }),
  };
  logBuffer = [...logBuffer, safe].slice(-MAX_LOG_ENTRIES);
  if (logBuffer.length >= MAX_LOG_ENTRIES) void flushBuffer();
  else {
    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(() => { flushTimeout = null; void flushBuffer(); }, 3000);
  }
}

export function logAxiosRequest<T extends TimedAxiosConfig>(config: T): T {
  if (!isEnabled()) { void disableLogging(); return config; }
  logApiCall({ ts: "", method: config.method, url: config.url ?? "" });
  return config;
}

export function logAxiosResponse<T>(response: TimedAxiosResponse<T>) {
  if (!isEnabled()) { void disableLogging(); return response; }
  const start = response.config.metadata?.startTime;
  logApiCall({ ts: "", method: response.config.method, url: response.config.url ?? "", status: response.status,
    durationMs: start === undefined ? undefined : Math.max(0, Date.now() - start),
    responseSize: finite(Number(response.headers?.["content-length"])),
  });
  return response;
}

export function logAxiosError(error: unknown): Promise<never> {
  if (isEnabled()) {
    const config = axiosConfig(error);
    const start = config?.metadata?.startTime;
    const safe = sanitizeErrorForLog(error);
    logApiCall({ ts: "", method: config?.method, url: config?.url ?? "", status: safe.status,
      durationMs: start === undefined ? undefined : Math.max(0, Date.now() - start), error: safe.message });
  } else void disableLogging();
  return Promise.reject(error);
}

function axiosConfig(error: unknown): TimedAxiosConfig | undefined {
  if (!error || typeof error !== "object" || !("config" in error)) return undefined;
  return error.config && typeof error.config === "object" ? error.config as TimedAxiosConfig : undefined;
}

export async function readApiLogs(): Promise<string> {
  if (Platform.OS === "web") return "Logging not available on web";
  if (!isEnabled()) { await disableLogging(); return "API logging is disabled"; }
  try {
    await initApiLogger();
    await flushBuffer();
    if (!isEnabled()) return "API logging is disabled";
    const generation = epoch;
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    if (!info.exists) return "No logs available";
    const contents = await FileSystem.readAsStringAsync(LOG_FILE);
    return generation === epoch && isEnabled() ? contents : "API logging is disabled";
  } catch { return "Failed to read logs"; }
}

export async function clearApiLogs() {
  clearBuffer();
  if (Platform.OS === "web") return;
  try { await enqueue(deleteLogs); }
  catch { /* A failed deletion must not resurrect pending entries. */ }
}

export async function initApiLogger() {
  if (!isEnabled()) return disableLogging();
  disabledCleanup = null;
  const generation = epoch;
  await enqueue(async () => {
    if (isEnabled() && generation === epoch) await ensureFreshDirectory();
  });
}

// Schedule after module evaluation so startup removes legacy files even without requests.
void Promise.resolve().then(() => { if (!isEnabled()) return disableLogging(); });
