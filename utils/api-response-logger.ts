import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import type { AxiosInstance } from "axios";
import { apiResponseUtf8Bytes, sanitizeApiResponseBody, sanitizeApiResponseUrl } from "./api-response-redaction";

export type ApiResponseSource = "riot" | "public" | "telemetry";
export const API_RESPONSE_LIMITS = { maxRecordBytes: 2 * 1024 * 1024 + 16 * 1024, maxPendingBytes: 8 * 1024 * 1024, maxFileBytes: 20 * 1024 * 1024, maxEntries: 500 } as const;
const directory = `${FileSystem.cacheDirectory}api-responses/`;
const file = `${directory}responses.jsonl`;
const previous = `${directory}responses.prev.jsonl`;
type Pending = { line: string; bytes: number };
let pending: Pending[] = [];
let pendingBytes = 0;
let inFlightBytes = 0;
let droppedRecords = 0;
let diskErrors = 0;
let generation = 0;
let sequence = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let ioTail: Promise<void> = Promise.resolve();
let flushing = false;
const installed = new WeakSet<AxiosInstance>();

const storageAvailable = () => __DEV__ && Platform.OS !== "web" && !!FileSystem.cacheDirectory;
const enabled = () => storageAvailable() && process.env.EXPO_PUBLIC_API_RESPONSE_LOGGING === "1";
const own = (value: unknown, key: string): unknown => value && typeof value === "object" ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
function discardPending() {
  generation++;
  pending = []; pendingBytes = 0; droppedRecords = 0; diskErrors = 0;
  if (timer) clearTimeout(timer);
  timer = null;
}

function schedule(delay = 1000) {
  if (timer || !enabled() || (!pending.length && !droppedRecords && !diskErrors)) return;
  timer = setTimeout(() => { timer = null; void flushApiResponses(); }, delay);
}

function put(record: object) {
  const line = `${JSON.stringify(record)}\n`;
  const bytes = apiResponseUtf8Bytes(line);
  if (bytes > API_RESPONSE_LIMITS.maxRecordBytes || pending.length >= API_RESPONSE_LIMITS.maxEntries ||
    pendingBytes + inFlightBytes + bytes > API_RESPONSE_LIMITS.maxPendingBytes) {
    droppedRecords++;
  } else {
    pending = [...pending, { line, bytes }];
    pendingBytes += bytes;
  }
  schedule();
}

/** Snapshot only approved response fields synchronously, before caller mutation. */
export function recordApiResponse(response: unknown, source: ApiResponseSource): void {
  if (!enabled()) { discardPending(); return; }
  try {
    const config = own(response, "config");
    const requestUrl = own(config, "url");
    const baseUrl = own(config, "baseURL");
    const url = typeof requestUrl === "string" ?
      (typeof baseUrl === "string" && !/^https?:\/\//i.test(requestUrl) ? new URL(requestUrl, `${baseUrl.replace(/\/$/, "")}/`).toString() : requestUrl) : "";
    const status = own(response, "status");
    if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599) return;
    const method = own(config, "method");
    const startedAt = own(own(config, "metadata"), "startTime");
    const durationMs = typeof startedAt === "number" && Number.isFinite(startedAt)
      ? Math.max(0, Date.now() - startedAt) : undefined;
    const headers = own(response, "headers");
    const contentType = own(headers, "content-type") ?? own(headers, "Content-Type");
    const dataDescriptor = response && typeof response === "object" ? Object.getOwnPropertyDescriptor(response, "data") : undefined;
    const body = dataDescriptor && "value" in dataDescriptor ?
      sanitizeApiResponseBody(dataDescriptor.value, url, typeof contentType === "string" ? contentType : undefined) :
      { body: null, truncated: false, omissions: [dataDescriptor ? "accessor" : "no-body"] };
    put({
      ts: new Date().toISOString(), source, requestId: ++sequence,
      method: typeof method === "string" && /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/i.test(method) ? method.toUpperCase() : "UNKNOWN",
      url: sanitizeApiResponseUrl(url), status, durationMs, outcome: status >= 400 ? "http-error" : "response", ...body,
    });
  } catch {
    // No original object/message is kept. A bounded loss counter is emitted later.
    droppedRecords++;
    schedule();
  }
}

async function append(lines: string, epoch: number): Promise<boolean> {
  const active = () => enabled() && generation === epoch;
  if (!active()) return false;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  if (!active()) return false;
  const info = await FileSystem.getInfoAsync(file);
  if (!active()) return false;
  const bytes = apiResponseUtf8Bytes(lines);
  const size = info.exists && "size" in info ? info.size : 0;
  if (info.exists && size + bytes > API_RESPONSE_LIMITS.maxFileBytes) {
    await FileSystem.deleteAsync(previous, { idempotent: true });
    if (!active()) return false;
    await FileSystem.moveAsync({ from: file, to: previous });
  }
  if (!active()) return false;
  if (bytes > API_RESPONSE_LIMITS.maxFileBytes) throw new Error("LOG_SIZE_LIMIT");
  // Load only in opted-in native diagnostics. Native append avoids sending the
  // entire old log back across the bridge and scanning/reallocating it in JS.
  const { File } = require("expo-file-system") as typeof import("expo-file-system");
  if (!active()) return false;
  new File(file).write(lines, { append: true });
  return active();
}

async function drain(epoch: number) {
  while (enabled() && epoch === generation && (pending.length || droppedRecords || diskErrors)) {
    const batch: Pending[] = [];
    let bytes = 0;
    for (const record of pending) {
      if (bytes + record.bytes > 4 * 1024 * 1024) break;
      batch.push(record); bytes += record.bytes;
    }
    pending = pending.slice(batch.length); pendingBytes -= bytes; inFlightBytes = bytes;
    const losses = { droppedRecords, diskErrors };
    const summary = losses.droppedRecords || losses.diskErrors ?
      `${JSON.stringify({ ts: new Date().toISOString(), event: "capture-loss", ...losses })}\n` : "";
    try {
      const saved = await append(summary + batch.map((entry) => entry.line).join(""), epoch);
      if (!saved) break;
      droppedRecords -= losses.droppedRecords; diskErrors -= losses.diskErrors;
    } catch {
      if (enabled() && generation === epoch) {
        pending = [...batch, ...pending]; pendingBytes += bytes;
        diskErrors++;
      }
      break;
    } finally { inFlightBytes = 0; }
  }
  if (!enabled()) discardPending();
}

/** Interceptors never await this; one writer owns both files and queued bytes. */
export function flushApiResponses(): Promise<void> {
  if (!enabled()) { discardPending(); return Promise.resolve(); }
  if (timer) clearTimeout(timer);
  timer = null;
  if (flushing) return ioTail;
  if (!pending.length && !droppedRecords && !diskErrors) return ioTail;
  flushing = true;
  const epoch = generation;
  ioTail = ioTail.then(() => drain(epoch)).catch(() => {
    if (enabled() && generation === epoch) diskErrors++;
  }).finally(() => { flushing = false; schedule(5000); });
  return ioTail;
}

export function clearApiResponses(): Promise<void> {
  discardPending();
  if (!storageAvailable()) return Promise.resolve();
  const epoch = generation;
  const clearing = ioTail.then(async () => {
    // Explicit clearing remains available after recording is disabled. Its I/O
    // is serialized after old writes; discardPending retired those batches.
    await FileSystem.deleteAsync(directory, { idempotent: true });
  });
  ioTail = clearing.catch(() => { if (enabled() && epoch === generation) { diskErrors++; schedule(5000); } });
  return clearing.catch(() => { throw new Error("Unable to clear API response logs"); });
}

/** Logging is independent of Riot session/auth interceptors and transport adapters. */
export function installApiResponseLogging(
  client: AxiosInstance,
  source: ApiResponseSource,
  record: typeof recordApiResponse = recordApiResponse,
): void {
  if (installed.has(client)) return;
  installed.add(client);
  client.interceptors.response.use((response) => {
    try { record(response, source); } catch { /* Diagnostics cannot change HTTP behavior. */ }
    return response;
  }, (error: unknown) => {
    try {
      const response = own(error, "response");
      if (response) record(response, source);
    } catch { /* Preserve rejection identity even for hostile errors. */ }
    return Promise.reject(error);
  });
}
