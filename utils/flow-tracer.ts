import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Platform } from "react-native";

type TraceEventType =
  | "UI_EVENT"
  | "COMPONENT_RENDER"
  | "FUNCTION_CALL"
  | "SERVICE_CALL"
  | "API_REQUEST"
  | "API_RESPONSE"
  | "API_ERROR"
  | "STORAGE_READ"
  | "STORAGE_WRITE"
  | "STATE_ACTION"
  | "STATE_UPDATE"
  | "NAVIGATION"
  | "ERROR";

type TraceEventStatus = "idle" | "active" | "success" | "warning" | "error";

type FlowTool =
  | "Reactotron"
  | "Redux DevTools"
  | "Zustand"
  | "Axios"
  | "AsyncStorage"
  | "React Navigation"
  | "React Native DevTools"
  | "Madge"
  | "Manual";

type TraceEventInput = {
  type: TraceEventType;
  label: string;
  description?: string;
  durationMs?: number;
  status?: TraceEventStatus;
  source?: {
    file?: string;
    functionName?: string;
    componentName?: string;
    line?: number;
  };
  input?: unknown;
  output?: unknown;
  stateBefore?: unknown;
  stateAfter?: unknown;
  error?: {
    message: string;
    stack?: string;
    code?: string | number;
  };
  tool?: FlowTool;
  codeSnippet?: string;
  highlightedLines?: number[];
};

type TraceEvent = Required<Pick<TraceEventInput, "type" | "label">> &
  Omit<TraceEventInput, "type" | "label"> & {
    id: string;
    traceId: string;
    order: number;
    timestamp: number;
    status: TraceEventStatus;
  };

type FlowTrace = {
  id: string;
  name: string;
  description: string;
  platform: "android" | "ios" | "web" | "mock";
  framework: "react-native";
  stateManager?: "redux" | "zustand" | "context" | "none";
  events: TraceEvent[];
  createdAt: string;
};

const sensitiveKeys = new Set([
  "password",
  "pass",
  "token",
  "accesstoken",
  "entitlementstoken",
  "idtoken",
  "refreshtoken",
  "authorization",
  "x-riot-entitlements-jwt",
  "secret",
  "apikey",
  "cookie",
  "session",
]);

const defaultUrl = "ws://127.0.0.1:8787";
const maxTraceEvents = 300;
const traceFlushDelayMs = 400;
const traceStringLimit = 8000;
const maxLoggedBodyBytes = 256_000;
const traceArrayLimit = 40;
const traceObjectKeyLimit = 60;
const traceDepthLimit = 6;

function maskSensitiveData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveData(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        if (sensitiveKeys.has(key.toLowerCase())) {
          return [key, "********"];
        }

        return [key, maskSensitiveData(entry)];
      })
    ) as T;
  }

  return value;
}

class FlowTracer {
  private socket: WebSocket | null = null;
  private currentTrace: FlowTrace | null = null;
  private traceStartedAt = 0;
  private queue: string[] = [];
  private axiosInstalled = false;
  private fetchInstalled = false;
  private asyncStorageInstalled = false;
  private tracedStores = new Set<string>();
  private storageSnapshotTraceIds = new Set<string>();
  private storageSnapshotInFlight = false;
  private eventSequence = 0;
  private sendTimeout: ReturnType<typeof setTimeout> | null = null;

  connect(url = process.env.EXPO_PUBLIC_FLOW_TRACE_WS || defaultUrl) {
    if (!__DEV__ || this.socket) return;

    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      const queued = [...this.queue];
      this.queue = [];
      queued.forEach((message) => this.socket?.send(message));
      this.sendCurrentTrace();
      void this.snapshotAsyncStorage("AsyncStorage snapshot after bridge connected");
    };
    this.socket.onerror = () => {
      this.socket = null;
    };
    this.socket.onclose = () => {
      this.socket = null;
    };
  }

  installGlobalTracing() {
    this.installAxiosTracing();
    this.installFetchTracing();
    this.installAsyncStorageTracing();
  }

  traceZustandStore<TState extends object>(
    name: string,
    store: {
      getState: () => TState;
      subscribe: (listener: (state: TState, previousState: TState) => void) => () => void;
    }
  ) {
    if (!__DEV__ || this.tracedStores.has(name)) return;
    this.tracedStores.add(name);

    store.subscribe((state, previousState) => {
      const stateRecord = state as Record<string, unknown>;
      const previousRecord = previousState as Record<string, unknown>;
      const changedKeys = Object.keys(stateRecord).filter(
        (key) => stateRecord[key] !== previousRecord[key]
      );

      if (changedKeys.length === 0) return;

      this.track({
        type: "STATE_UPDATE",
        label: `${name} updated: ${changedKeys.join(", ")}`,
        source: {
          file: `hooks/${name}.ts`,
          functionName: "zustand.set",
        },
        input: {
          store: name,
          changedKeys,
        },
        stateBefore: pickChangedState(previousRecord, changedKeys),
        stateAfter: pickChangedState(stateRecord, changedKeys),
        tool: "Zustand",
      });
    });
  }

  startTrace(name: string, description = `${name} captured from Vshop.`) {
    if (!__DEV__) return;

    const id = `trace_${Date.now()}`;
    this.traceStartedAt = Date.now();
    this.eventSequence = 0;
    this.currentTrace = {
      id,
      name,
      description,
      platform: Platform.OS === "ios" ? "ios" : Platform.OS === "web" ? "web" : "android",
      framework: "react-native",
      stateManager: "zustand",
      events: [],
      createdAt: new Date().toISOString(),
    };
    this.sendCurrentTrace();
    void this.snapshotAsyncStorage("AsyncStorage snapshot");
  }

  async snapshotAsyncStorage(label = "AsyncStorage snapshot") {
    if (!__DEV__ || this.storageSnapshotInFlight || !this.currentTrace) return;
    if (this.storageSnapshotTraceIds.has(this.currentTrace.id)) return;

    this.storageSnapshotInFlight = true;
    this.storageSnapshotTraceIds.add(this.currentTrace.id);

    try {
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys);
      const values = Object.fromEntries(
        pairs.map(([key, value]) => [key, parseStorageValue(value)])
      );

      this.track({
        type: "STORAGE_READ",
        label,
        source: {
          file: "@react-native-async-storage/async-storage",
          functionName: "getAllKeys/multiGet",
        },
        output: {
          keyCount: keys.length,
          keys,
          values,
        },
        tool: "AsyncStorage",
      });
    } catch (error) {
      this.track({
        type: "ERROR",
        label: "AsyncStorage snapshot failed",
        status: "error",
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
        tool: "AsyncStorage",
      });
    } finally {
      this.storageSnapshotInFlight = false;
    }
  }

  track(event: TraceEventInput) {
    if (!__DEV__) return;
    if (!this.currentTrace) {
      this.startTrace("Untitled Vshop Flow");
    }

    const trace = this.currentTrace;
    if (!trace) return;

    this.eventSequence += 1;
    trace.events.push({
      ...event,
      id: `${trace.id}_event_${this.eventSequence}`,
      traceId: trace.id,
      order: this.eventSequence,
      timestamp: Math.max(Date.now() - this.traceStartedAt, 0),
      status: event.status ?? "success",
      input: sanitizeForTrace(event.input),
      output: sanitizeForTrace(event.output),
      stateBefore: sanitizeForTrace(event.stateBefore),
      stateAfter: sanitizeForTrace(event.stateAfter),
    });

    if (trace.events.length > maxTraceEvents) {
      trace.events.splice(0, trace.events.length - maxTraceEvents);
    }

    this.scheduleCurrentTraceSend();
  }

  endTrace() {
    if (!__DEV__) return null;

    this.sendCurrentTrace();
    const trace = this.currentTrace;
    this.currentTrace = null;
    return trace;
  }

  private sendCurrentTrace() {
    if (this.sendTimeout) {
      clearTimeout(this.sendTimeout);
      this.sendTimeout = null;
    }
    if (!this.currentTrace) return;

    const message = JSON.stringify({
      kind: "FLOW_TRACE",
      trace: this.currentTrace,
    });

    if (this.socket?.readyState === 1) {
      this.socket.send(message);
    } else {
      this.queue = [...this.queue.slice(-4), message];
    }
  }

  private scheduleCurrentTraceSend() {
    if (this.sendTimeout) return;

    this.sendTimeout = setTimeout(() => {
      this.sendTimeout = null;
      this.sendCurrentTrace();
    }, traceFlushDelayMs);
  }

  private installAxiosTracing() {
    if (!__DEV__ || this.axiosInstalled) return;
    this.axiosInstalled = true;

    axios.interceptors.request.use((config) => {
      (config as any).flowTraceStartTime = Date.now();
      const request = buildAxiosRequestTrace(config);
      this.track({
        type: "API_REQUEST",
        label: `${request.method} ${request.url || ""}`,
        input: { request },
        tool: "Axios",
      });

      return config;
    });

    axios.interceptors.response.use(
      (response) => {
        const startedAt =
          (response.config as any).flowTraceStartTime ||
          (response.config as any).metadata?.startTime;
        this.track({
          type: "API_RESPONSE",
          label: `${response.status} ${response.config.url || ""}`,
          durationMs: startedAt ? Date.now() - startedAt : undefined,
          input: {
            request: buildAxiosRequestTrace(response.config),
          },
          output: {
            response: {
              status: response.status,
              statusText: response.statusText,
              headers: normalizeHeaders(response.headers),
              url: response.config.url,
              responseSize: getPayloadSize(response.data, response.headers),
              data: response.data,
            },
          },
          tool: "Axios",
        });

        return response;
      },
      (error) => {
        const startedAt =
          (error.config as any)?.flowTraceStartTime ||
          (error.config as any)?.metadata?.startTime;
        this.track({
          type: "API_ERROR",
          label: `${error.response?.status || "ERR"} ${error.config?.url || error.message}`,
          durationMs: startedAt ? Date.now() - startedAt : undefined,
          status: "error",
          input: {
            request: error.config ? buildAxiosRequestTrace(error.config) : undefined,
          },
          output: {
            response: {
              status: error.response?.status,
              statusText: error.response?.statusText,
              headers: normalizeHeaders(error.response?.headers),
              url: error.config?.url,
              responseSize: getPayloadSize(
                error.response?.data,
                error.response?.headers
              ),
              data: error.response?.data,
            },
          },
          error: {
            message: error.message || String(error),
            code: error.response?.status,
          },
          tool: "Axios",
        });

        return Promise.reject(error);
      }
    );
  }

  private installFetchTracing() {
    if (!__DEV__ || this.fetchInstalled || typeof globalThis.fetch !== "function") {
      return;
    }

    this.fetchInstalled = true;
    const originalFetch = globalThis.fetch.bind(globalThis);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const startedAt = Date.now();
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method || (typeof input === "object" && "method" in input ? input.method : "GET");
      const request = buildFetchRequestTrace(input, init, url, method);

      this.track({
        type: "API_REQUEST",
        label: `${method.toUpperCase()} ${url}`,
        input: { request },
        tool: "Manual",
      });

      try {
        const response = await originalFetch(input, init);
        const responseData = await readFetchResponseBody(response);
        this.track({
          type: response.ok ? "API_RESPONSE" : "API_ERROR",
          label: `${response.status} ${url}`,
          durationMs: Date.now() - startedAt,
          status: response.ok ? "success" : "error",
          input: { request },
          output: {
            response: {
              status: response.status,
              statusText: response.statusText,
              headers: normalizeHeaders(response.headers),
              url,
              responseSize: getPayloadSize(responseData),
              data: responseData,
            },
          },
          tool: "Manual",
        });
        return response;
      } catch (error) {
        this.track({
          type: "API_ERROR",
          label: `Fetch error ${url}`,
          durationMs: Date.now() - startedAt,
          status: "error",
          input: { request },
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
          tool: "Manual",
        });
        throw error;
      }
    };
  }

  private installAsyncStorageTracing() {
    if (!__DEV__ || this.asyncStorageInstalled) return;
    this.asyncStorageInstalled = true;

    const storage = AsyncStorage as typeof AsyncStorage & {
      __flowTracerPatched?: boolean;
    };

    if (storage.__flowTracerPatched) return;
    storage.__flowTracerPatched = true;

    const originalGetItem = storage.getItem.bind(storage);
    const originalSetItem = storage.setItem.bind(storage);
    const originalRemoveItem = storage.removeItem.bind(storage);

    storage.getItem = async (key: string, callback?: any) => {
      const value = await originalGetItem(key);
      this.track({
        type: "STORAGE_READ",
        label: `AsyncStorage.getItem('${key}')`,
        source: {
          file: "@react-native-async-storage/async-storage",
          functionName: "getItem",
        },
        input: { key },
        output: { key, value },
        tool: "AsyncStorage",
      });
      callback?.(null, value);
      return value;
    };

    storage.setItem = async (key: string, value: string, callback?: any) => {
      this.track({
        type: "STORAGE_WRITE",
        label: `AsyncStorage.setItem('${key}')`,
        source: {
          file: "@react-native-async-storage/async-storage",
          functionName: "setItem",
        },
        input: { key, value },
        tool: "AsyncStorage",
      });
      await originalSetItem(key, value);
      callback?.(null);
    };

    storage.removeItem = async (key: string, callback?: any) => {
      this.track({
        type: "STORAGE_WRITE",
        label: `AsyncStorage.removeItem('${key}')`,
        source: {
          file: "@react-native-async-storage/async-storage",
          functionName: "removeItem",
        },
        input: { key },
        tool: "AsyncStorage",
      });
      await originalRemoveItem(key);
      callback?.(null);
    };
  }
}

export const flowTracer = new FlowTracer();

function pickChangedState(state: Record<string, unknown>, changedKeys: string[]) {
  return Object.fromEntries(changedKeys.map((key) => [key, state[key]]));
}

function sanitizeForTrace(value: unknown) {
  return maskSensitiveData(summarizeValue(value));
}

function buildAxiosRequestTrace(config: any) {
  return {
    method: String(config.method || "GET").toUpperCase(),
    baseURL: config.baseURL,
    url: config.url,
    params: config.params,
    headers: normalizeHeaders(config.headers),
    data: normalizeHttpBody(config.data),
  };
}

function buildFetchRequestTrace(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  url: string,
  method: string
) {
  const requestLike = typeof input === "object" && !(input instanceof URL) ? input : undefined;

  return {
    method: method.toUpperCase(),
    url,
    headers: normalizeHeaders(init?.headers ?? requestLike?.headers),
    data: normalizeHttpBody(init?.body),
  };
}

async function readFetchResponseBody(response: Response) {
  try {
    const contentType = response.headers?.get?.("content-type") ?? undefined;
    const contentLength = getContentLength(response.headers);
    const isTextBody =
      !contentType ||
      contentType.includes("json") ||
      contentType.startsWith("text/") ||
      contentType.includes("xml") ||
      contentType.includes("javascript");

    if (!isTextBody || (contentLength && contentLength > maxLoggedBodyBytes)) {
      return {
        omitted: true,
        contentType,
        contentLength,
        reason: !isTextBody ? "binary response" : "response body too large",
      };
    }

    const text = await response.clone().text();
    return parseMaybeJson(text, contentType);
  } catch (error) {
    return {
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeHeaders(headers: unknown): unknown {
  if (!headers) return undefined;

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value: string, key: string) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  if (typeof headers === "object") {
    const maybeHeaders = headers as {
      toJSON?: () => unknown;
      forEach?: (callback: (value: unknown, key: string) => void) => void;
    };

    if (typeof maybeHeaders.toJSON === "function") {
      return maybeHeaders.toJSON();
    }

    if (typeof maybeHeaders.forEach === "function") {
      const result: Record<string, unknown> = {};
      maybeHeaders.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }

    return Object.fromEntries(Object.entries(headers as Record<string, unknown>));
  }

  return String(headers);
}

function normalizeHttpBody(body: unknown): unknown {
  if (typeof body === "string") {
    return parseMaybeJson(body);
  }

  if (body && typeof body === "object") {
    const maybeFormData = body as { _parts?: unknown[] };
    if (Array.isArray(maybeFormData._parts)) {
      return {
        kind: "FormData",
        parts: maybeFormData._parts,
      };
    }
  }

  return body;
}

function parseMaybeJson(text: string, contentType?: string | null): unknown {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (contentType?.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }

  return text;
}

function parseStorageValue(value: string | null): unknown {
  if (value === null) return null;
  if (value.length > traceStringLimit * 2) {
    return summarizeValue(value);
  }
  return parseMaybeJson(value);
}

function summarizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value.length > traceStringLimit
      ? `${value.slice(0, traceStringLimit)}... [truncated ${value.length - traceStringLimit} chars]`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (depth >= traceDepthLimit) {
    if (Array.isArray(value)) return `[Array(${value.length})]`;
    if (typeof value === "object") return "[Object]";
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, traceArrayLimit).map((item) => summarizeValue(item, depth + 1));
    if (value.length > traceArrayLimit) {
      items.push(`[truncated ${value.length - traceArrayLimit} items]`);
    }
    return items;
  }

  if (typeof value === "object") {
    const allEntries = Object.entries(value as Record<string, unknown>);
    const entries = allEntries.slice(0, traceObjectKeyLimit);
    const result = Object.fromEntries(
      entries.map(([key, entry]) => [key, summarizeValue(entry, depth + 1)])
    );
    if (allEntries.length > traceObjectKeyLimit) {
      result.__truncatedKeys = allEntries.length - traceObjectKeyLimit;
    }
    return result;
  }

  return String(value);
}

function getContentLength(headers: unknown) {
  const normalized = normalizeHeaders(headers);
  if (!normalized || typeof normalized !== "object") return undefined;

  const record = normalized as Record<string, unknown>;
  const rawValue = record["content-length"] ?? record["Content-Length"];
  const contentLength = Number(rawValue);
  return Number.isFinite(contentLength) ? contentLength : undefined;
}

function getPayloadSize(value: unknown, headers?: unknown) {
  const contentLength = getContentLength(headers);
  if (contentLength !== undefined) return contentLength;
  if (typeof value === "string") return value.length;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return undefined;
}
