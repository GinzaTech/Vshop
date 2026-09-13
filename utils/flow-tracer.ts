/**
 * flow-tracer.ts — Công cụ trace luồng chạy của app chỉ dùng trong DEV.
 *
 * Ghi lại các sự kiện (UI, state, HTTP request/response, storage, navigation)
 * vào một FlowTrace rồi gửi qua WebSocket (mặc định ws://127.0.0.1:8787) cho
 * tool debug bên ngoài. Mọi thứ đều no-op khi không ở __DEV__, nên build
 * release không có chi phí nào. Dữ liệu nhạy cảm (token, cookie, password)
 * được che trước khi rời khỏi thiết bị.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
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

type TracedAxiosConfig = InternalAxiosRequestConfig & {
  flowTraceStartTime?: number;
  metadata?: { startTime?: number };
};

type TracedAxiosError = {
  message?: string;
  config?: TracedAxiosConfig;
  response?: {
    status?: number;
    statusText?: string;
    headers?: unknown;
    data?: unknown;
  };
};

type StorageCallback = (error?: Error | null) => void;
type StorageValueCallback = (
  error?: Error | null,
  value?: string | null,
) => void;

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

// Giới hạn của tracer: tránh flood WebSocket hoặc clone object khổng lồ.
const defaultUrl = "ws://127.0.0.1:8787";   // URL WebSocket mặc định
const maxTraceEvents = 300;                 // Số event tối đa giữ trong 1 trace
const traceFlushDelayMs = 400;              // Debounce giữa 2 lần gửi trace
const traceStringLimit = 8000;              // Độ dài chuỗi tối đa được giữ
const maxLoggedBodyBytes = 256_000;         // Body HTTP lớn hơn sẽ bị bỏ qua
const traceArrayLimit = 40;                 // Số phần tử mảng tối đa
const traceObjectKeyLimit = 60;             // Số key object tối đa
const traceDepthLimit = 6;                  // Độ sâu đệ quy tối đa

/**
 * maskSensitiveData — Duyệt đệ quy dữ liệu, che giá trị các key nhạy cảm.
 * Key được so khớp không phân biệt hoa thường với danh sách sensitiveKeys.
 * @template T - Kiểu dữ liệu đầu vào (giữ nguyên kiểu ở đầu ra)
 * @param {T} value - Dữ liệu cần che (object, mảng hoặc giá trị nguyên thủy)
 * @returns {T} Bản sao dữ liệu với giá trị nhạy cảm thay bằng "********"
 */
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

/**
 * FlowTracer — Lớp chính quản lý trace: thu thập event, gửi qua WebSocket và
 * cài đặt interceptor toàn cục (axios, fetch, AsyncStorage, Zustand).
 * Chỉ hoạt động trong __DEV__; mọi method đều thoát ngay nếu không phải DEV.
 */
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

  /**
   * connect — Mở kết nối WebSocket tới tool debug (nếu chưa mở và đang DEV).
   * Khi bridge mở: xả hàng đợi message chưa gửi kịp, gửi trace hiện tại và
   * chụp snapshot AsyncStorage. Khi lỗi/đóng: đặt socket = null để lần
   * connect sau thử lại; message mới tiếp tục vào queue.
   * @param {string} [url] - URL WebSocket (mặc định env EXPO_PUBLIC_FLOW_TRACE_WS
   *   hoặc ws://127.0.0.1:8787)
   */
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

  /**
   * installGlobalTracing — Cài đặt một lần toàn bộ interceptor toàn cục:
   * axios, fetch và AsyncStorage. Mỗi installer tự chống cài trùng bằng flag.
   */
  installGlobalTracing() {
    this.installAxiosTracing();
    this.installFetchTracing();
    this.installAsyncStorageTracing();
  }

  /**
   * traceZustandStore — Theo dõi một Zustand store: mỗi lần state thay đổi,
   * ghi event STATE_UPDATE kèm danh sách key đổi và snapshot trước/sau.
   * Chỉ subscribe một lần cho mỗi tên store (tránh listener trùng).
   * @template TState - Kiểu state của store
   * @param {string} name - Tên store (dùng làm nhãn event và chống trùng)
   * @param {object} store - Store Zustand (cần getState + subscribe)
   */
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

  /**
   * startTrace — Bắt đầu một trace mới (reset event sequence, timestamp gốc)
   * và gửi metadata trace ngay tới tool debug, kèm snapshot AsyncStorage.
   * @param {string} name - Tên trace (VD: tên luồng đang được phân tích)
   * @param {string} [description] - Mô tả trace
   */
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

  /**
   * snapshotAsyncStorage — Chụp toàn bộ key/value trong AsyncStorage thành
   * một event STORAGE_READ để xem state persisted tại thời điểm đó.
   * Guards: chỉ chạy ở DEV, chỉ 1 lần cho mỗi trace (theo trace id) và không
   * chạy chồng nhau (storageSnapshotInFlight).
   * @param {string} [label] - Nhãn mô tả snapshot
   */
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

  /**
   * track — Ghi một event vào trace hiện tại (tự tạo trace "Untitled" nếu
   * chưa có). Input/output/state được summarize + mask trước khi lưu; nếu
   * vượt maxTraceEvents thì các event cũ nhất bị loại. Sau đó lên lịch gửi.
   * @param {TraceEventInput} event - Dữ kiện event (type, label, dữ liệu...)
   */
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

  /**
   * endTrace — Kết thúc trace hiện tại: gửi lần cuối rồi trả về trace và
   * xóa trace đang chạy (các track() sau đó sẽ tạo trace mới).
   * @returns {FlowTrace | null} Trace vừa kết thúc, hoặc null nếu không ở DEV
   */
  endTrace() {
    if (!__DEV__) return null;

    this.sendCurrentTrace();
    const trace = this.currentTrace;
    this.currentTrace = null;
    return trace;
  }

  /**
   * sendCurrentTrace — Gửi trace hiện tại qua WebSocket ngay lập tức. Nếu
   * socket chưa mở, message được đẩy vào queue (giữ tối đa 5 message cuối).
   */
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

  /**
   * scheduleCurrentTraceSend — Lên lịch gửi trace sau traceFlushDelayMs
   * (debounce) để gom nhiều event trong cùng một frame chỉ tốn 1 lần gửi.
   */
  private scheduleCurrentTraceSend() {
    if (this.sendTimeout) return;

    this.sendTimeout = setTimeout(() => {
      this.sendTimeout = null;
      this.sendCurrentTrace();
    }, traceFlushDelayMs);
  }

  /**
   * installAxiosTracing — Cài interceptor axios toàn cục (một lần duy nhất):
   * - request: stamp thời điểm bắt đầu + ghi event API_REQUEST.
   * - response: ghi event API_RESPONSE kèm status, headers, duration, size.
   * - error: ghi event API_ERROR kèm thông tin request/response rồi reject lại.
   */
  private installAxiosTracing() {
    if (!__DEV__ || this.axiosInstalled) return;
    this.axiosInstalled = true;

    axios.interceptors.request.use((config) => {
      const tracedConfig = config as TracedAxiosConfig;
      tracedConfig.flowTraceStartTime = Date.now();
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
          (response.config as TracedAxiosConfig).flowTraceStartTime ||
          (response.config as TracedAxiosConfig).metadata?.startTime;
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
      (error: unknown) => {
        const tracedError =
          typeof error === "object" && error !== null
            ? (error as TracedAxiosError)
            : {};
        const startedAt =
          tracedError.config?.flowTraceStartTime ||
          tracedError.config?.metadata?.startTime;
        this.track({
          type: "API_ERROR",
          label: `${tracedError.response?.status || "ERR"} ${tracedError.config?.url || tracedError.message || String(error)}`,
          durationMs: startedAt ? Date.now() - startedAt : undefined,
          status: "error",
          input: {
            request: tracedError.config
              ? buildAxiosRequestTrace(tracedError.config)
              : undefined,
          },
          output: {
            response: {
              status: tracedError.response?.status,
              statusText: tracedError.response?.statusText,
              headers: normalizeHeaders(tracedError.response?.headers),
              url: tracedError.config?.url,
              responseSize: getPayloadSize(
                tracedError.response?.data,
                tracedError.response?.headers
              ),
              data: tracedError.response?.data,
            },
          },
          error: {
            message: tracedError.message || String(error),
            code: tracedError.response?.status,
          },
          tool: "Axios",
        });

        return Promise.reject(error);
      }
    );
  }

  /**
   * installFetchTracing — Bọc (monkey-patch) globalThis.fetch một lần duy nhất
   * để trace mọi request/response fetch (kể cả response body nếu là text và
   * còn dưới maxLoggedBodyBytes). Error được log rồi throw lại nguyên vẹn.
   */
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

  /**
   * installAsyncStorageTracing — Bọc getItem/setItem/removeItem của
   * AsyncStorage (một lần, đánh dấu __flowTracerPatched) để ghi event
   * STORAGE_READ/STORAGE_WRITE; callback style cũ vẫn được gọi đúng.
   */
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

    storage.getItem = async (key: string, callback?: StorageValueCallback) => {
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

    storage.setItem = async (key: string, value: string, callback?: StorageCallback) => {
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

    storage.removeItem = async (key: string, callback?: StorageCallback) => {
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

/** Instance dùng chung toàn app của FlowTracer (singleton). */
export const flowTracer = new FlowTracer();

/**
 * pickChangedState — Trích các key đã thay đổi khỏi một state record.
 * @param {Record<string, unknown>} state - State đầy đủ (trước hoặc sau)
 * @param {string[]} changedKeys - Danh sách key cần trích
 * @returns {Record<string, unknown>} Object chỉ chứa các key đã đổi
 */
function pickChangedState(state: Record<string, unknown>, changedKeys: string[]) {
  return Object.fromEntries(changedKeys.map((key) => [key, state[key]]));
}

/**
 * sanitizeForTrace — Làm sạch dữ liệu trước khi lưu vào trace: summarize
 * (giới hạn kích thước/độ sâu) rồi mask dữ liệu nhạy cảm.
 * @param {unknown} value - Dữ liệu bất kỳ cần làm sạch
 * @returns {unknown} Dữ liệu đã an toàn để ghi trace
 */
function sanitizeForTrace(value: unknown) {
  return maskSensitiveData(summarizeValue(value));
}

/**
 * buildAxiosRequestTrace — Chuyển config axios thành object trace gọn gàng:
 * method uppercase, url, params, headers đã normalize và body đã parse JSON.
 * @param {AxiosRequestConfig} config - Config của request axios
 * @returns {object} Mô tả request dùng cho event API_REQUEST
 */
function buildAxiosRequestTrace(config: AxiosRequestConfig) {
  return {
    method: String(config.method || "GET").toUpperCase(),
    baseURL: config.baseURL,
    url: config.url,
    params: config.params,
    headers: normalizeHeaders(config.headers),
    data: normalizeHttpBody(config.data),
  };
}

/**
 * buildFetchRequestTrace — Chuyển input của fetch thành object trace gọn
 * (method, url, headers, body). Header lấy từ init trước, fallback sang
 * object Request nếu caller truyền Request thay vì string/URL.
 * @param {RequestInfo | URL} input - Tham số đầu của fetch
 * @param {RequestInit | undefined} init - Tham số init của fetch
 * @param {string} url - URL đã chuẩn hóa (caller tự suy ra từ input)
 * @param {string} method - HTTP method đã suy ra
 * @returns {object} Mô tả request dùng cho event trace
 */
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

/**
 * readFetchResponseBody — Đọc body của fetch response để log, clone response
 * nên không ảnh hưởng luồng đọc của caller. Body nhị phân hoặc quá lớn
 * (maxLoggedBodyBytes) chỉ ghi metadata, không đọc nội dung.
 * @param {Response} response - Response fetch cần đọc
 * @returns {Promise<unknown>} Body đã parse JSON (nếu được) hoặc mô tả lý do bỏ qua
 */
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

/**
 * normalizeHeaders — Chuẩn hóa nhiều dạng header (Headers, mảng cặp
 * [key, value], object có toJSON/forEach, object thường) thành record
 * { key: value } để dễ serialize vào trace.
 * @param {unknown} headers - Header ở bất kỳ dạng nào
 * @returns {unknown} Record header đã normalize, undefined nếu rỗng,
 *   hoặc chuỗi nếu dạng không nhận diện được
 */
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

/**
 * normalizeHttpBody — Chuẩn hóa body HTTP cho trace: chuỗi JSON được parse
 * thành object, FormData (dạng _parts của RN) được mô tả dạng có cấu trúc.
 * @param {unknown} body - Body thô của request
 * @returns {unknown} Body đã normalize (object JSON, FormData mô tả, hoặc nguyên bản)
 */
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

/**
 * parseMaybeJson — Thử parse chuỗi thành JSON nếu content-type là JSON hoặc
 * chuỗi bắt đầu bằng { / [. Parse thất bại thì trả về chuỗi gốc.
 * @param {string} text - Chuỗi cần parse
 * @param {string | null} [contentType] - Content-Type của dữ liệu (nếu có)
 * @returns {unknown} Object/array đã parse, hoặc chuỗi gốc
 */
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

/**
 * parseStorageValue — Parse một giá trị đọc từ AsyncStorage để hiển thị
 * trong snapshot: giá trị quá dài (2x traceStringLimit) được summarize,
 * còn lại thử parse JSON.
 * @param {string | null} value - Giá trị raw từ AsyncStorage
 * @returns {unknown} Giá trị đã parse/summarize, hoặc null
 */
function parseStorageValue(value: string | null): unknown {
  if (value === null) return null;
  if (value.length > traceStringLimit * 2) {
    return summarizeValue(value);
  }
  return parseMaybeJson(value);
}

/**
 * summarizeValue — Rút gọn dữ liệu đệ quy để trace không phình to:
 * - Chuỗi quá traceStringLimit bị cắt kèm chú thích số ký tự đã bỏ.
 * - Mảng/object vượt giới hạn (số phần tử, số key, độ sâu) bị cắt bớt.
 * @param {unknown} value - Dữ liệu cần rút gọn
 * @param {number} [depth] - Độ sâu đệ quy hiện tại (mặc định 0)
 * @returns {unknown} Bản rút gọn của dữ liệu
 */
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

/**
 * getContentLength — Đọc header content-length từ headers đã/ chưa normalize.
 * @param {unknown} headers - Headers ở bất kỳ dạng nào
 * @returns {number | undefined} Kích thước (byte), undefined nếu không có/không hợp lệ
 */
function getContentLength(headers: unknown) {
  const normalized = normalizeHeaders(headers);
  if (!normalized || typeof normalized !== "object") return undefined;

  const record = normalized as Record<string, unknown>;
  const rawValue = record["content-length"] ?? record["Content-Length"];
  const contentLength = Number(rawValue);
  return Number.isFinite(contentLength) ? contentLength : undefined;
}

/**
 * getPayloadSize — Xác định kích thước payload của response: ưu tiên header
 * content-length, sau đó đo độ dài chuỗi hoặc byteLength của binary.
 * @param {unknown} value - Body response (chuỗi, ArrayBuffer, TypedArray...)
 * @param {unknown} [headers] - Headers của response (nếu có)
 * @returns {number | undefined} Kích thước (byte), hoặc undefined nếu không đo được
 */
function getPayloadSize(value: unknown, headers?: unknown) {
  const contentLength = getContentLength(headers);
  if (contentLength !== undefined) return contentLength;
  if (typeof value === "string") return value.length;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return undefined;
}
