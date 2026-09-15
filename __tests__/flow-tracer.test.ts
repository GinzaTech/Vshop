import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => '{"accessToken":"storage-secret"}'),
  setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined),
  getAllKeys: jest.fn(async () => ["user-storage", "secure-storage"]),
  multiGet: jest.fn(async () => [["secure-storage", "encrypted-secret"]]),
}));

describe("flow tracing privacy", () => {
  const initialDev = __DEV__;
  const initialFetch = globalThis.fetch;
  const initialWebSocket = globalThis.WebSocket;
  const originalGetItem = AsyncStorage.getItem;
  const originalSetItem = AsyncStorage.setItem;
  const originalRemoveItem = AsyncStorage.removeItem;
  const initialFlag = process.env.EXPO_PUBLIC_FLOW_TRACING;
  const socket = { readyState: 1, send: jest.fn(), close: jest.fn(), onopen: null as null | (() => void) };
  let tracer: typeof import("~/utils/flow-tracer").flowTracer;

  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env.EXPO_PUBLIC_FLOW_TRACING;
    Object.defineProperty(globalThis, "__DEV__", { value: true, configurable: true });
    globalThis.WebSocket = jest.fn(() => socket) as unknown as typeof WebSocket;
    jest.isolateModules(() => { tracer = require("~/utils/flow-tracer").flowTracer; });
  });
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_FLOW_TRACING;
    tracer.endTrace();
    jest.clearAllTimers();
    jest.useRealTimers();
    Object.defineProperty(globalThis, "__DEV__", { value: initialDev, configurable: true });
    if (initialFlag === undefined) delete process.env.EXPO_PUBLIC_FLOW_TRACING;
    else process.env.EXPO_PUBLIC_FLOW_TRACING = initialFlag;
    globalThis.fetch = initialFetch;
    globalThis.WebSocket = initialWebSocket;
    AsyncStorage.getItem = originalGetItem;
    AsyncStorage.setItem = originalSetItem;
    AsyncStorage.removeItem = originalRemoveItem;
    delete (AsyncStorage as typeof AsyncStorage & { __flowTracerPatched?: boolean }).__flowTracerPatched;
    jest.restoreAllMocks();
  });

  it.each([undefined, "0", "true"])("every public entry point is inert without explicit opt-in (%s)", async (flag) => {
    if (flag !== undefined) process.env.EXPO_PUBLIC_FLOW_TRACING = flag;
    const store = { getState: jest.fn(), subscribe: jest.fn() };
    const intercept = jest.spyOn(axios.interceptors.request, "use");
    tracer.connect(); tracer.installGlobalTracing();
    tracer.traceZustandStore("user", store);
    tracer.startTrace("disabled");
    tracer.track({ type: "ERROR", label: "disabled" });
    await tracer.snapshotAsyncStorage();
    expect(tracer.endTrace()).toBeNull();
    expect(globalThis.WebSocket).not.toHaveBeenCalled();
    expect(store.subscribe).not.toHaveBeenCalled();
    expect(AsyncStorage.getAllKeys).not.toHaveBeenCalled();
    expect(intercept).not.toHaveBeenCalled();
  });

  it("cannot enable tracing in production", () => {
    process.env.EXPO_PUBLIC_FLOW_TRACING = "1";
    Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true });
    tracer.connect(); tracer.installGlobalTracing(); tracer.startTrace("disabled");
    expect(tracer.endTrace()).toBeNull();
    expect(globalThis.WebSocket).not.toHaveBeenCalled();
  });

  it("never reads storage values for snapshots even when enabled", async () => {
    process.env.EXPO_PUBLIC_FLOW_TRACING = "1";
    tracer.startTrace("snapshot");
    await Promise.resolve(); await Promise.resolve();
    await tracer.snapshotAsyncStorage();
    expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
    expect(JSON.stringify(tracer.endTrace())).not.toContain("encrypted-secret");
  });

  it("sanitizes all event fields and retains no reference to credential-bearing input", () => {
    process.env.EXPO_PUBLIC_FLOW_TRACING = "1";
    const payload = { accessToken: "original-secret", safe: true };
    tracer.startTrace("https://example.test/?access_token=name-secret");
    tracer.track({ type: "ERROR", label: "Cookie: ssid=label-secret", description: "Bearer description-secret",
      input: payload, output: '{"access_token":"json-secret"}',
      error: { message: "opaque-error-secret", stack: "opaque-stack-secret" },
      codeSnippet: 'password="fake-pass"', source: { file: "https://example.test/?token=source-secret" },
    });
    payload.accessToken = "later-secret";
    const serialized = JSON.stringify(tracer.endTrace());
    expect(serialized).not.toMatch(/original-secret|name-secret|label-secret|description-secret|json-secret|opaque-error-secret|opaque-stack-secret|fake-pass|source-secret|later-secret/);
    expect(serialized).toContain('"safe":true');
  });

  it("omits manually supplied storage contents too", () => {
    process.env.EXPO_PUBLIC_FLOW_TRACING = "1";
    tracer.track({ type: "STORAGE_READ", label: "storage", input: { key: "unlabelled-key", value: "storage-secret" }, output: { value: "encrypted-secret" } });
    expect(JSON.stringify(tracer.endTrace())).not.toMatch(/storage-secret|encrypted-secret/);
  });

  it("drops pending snapshots and queued sends after opt-out", async () => {
    process.env.EXPO_PUBLIC_FLOW_TRACING = "1";
    tracer.connect(); tracer.startTrace("connected");
    tracer.track({ type: "UI_EVENT", label: "click" });
    const onopen = socket.onopen;
    delete process.env.EXPO_PUBLIC_FLOW_TRACING;
    socket.send.mockClear();
    onopen?.();
    await Promise.resolve(); jest.runOnlyPendingTimers();
    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalled();
    expect(tracer.endTrace()).toBeNull();
  });

  it("subscribes once, sanitizes changed store data and unsubscribes on opt-out", () => {
    process.env.EXPO_PUBLIC_FLOW_TRACING = "1";
    let listener: ((state: { accessToken: string; count: number }, previous: { accessToken: string; count: number }) => void) | undefined;
    const unsubscribe = jest.fn();
    const store = { getState: jest.fn(), subscribe: jest.fn((fn: NonNullable<typeof listener>) => { listener = fn; return unsubscribe; }) };
    tracer.traceZustandStore("user", store); tracer.traceZustandStore("user", store);
    const previous = { accessToken: "previous-secret", count: 1 };
    listener?.(previous, previous);
    listener?.({ accessToken: "current-secret", count: 2 }, previous);
    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tracer.endTrace())).not.toMatch(/previous-secret|current-secret/);
    delete process.env.EXPO_PUBLIC_FLOW_TRACING;
    listener?.(previous, previous);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("bounds events and flushes through the connected bridge", async () => {
    process.env.EXPO_PUBLIC_FLOW_TRACING = "1";
    tracer.startTrace("bounded"); tracer.connect(); socket.onopen?.();
    for (let i = 0; i < 305; i++) tracer.track({ type: "UI_EVENT", label: `event ${i}` });
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    const trace = tracer.endTrace();
    expect(trace?.events).toHaveLength(300);
    expect(socket.send).toHaveBeenCalled();
  });

  it("reports a storage read failure with safe metadata", async () => {
    process.env.EXPO_PUBLIC_FLOW_TRACING = "1";
    jest.mocked(AsyncStorage.getAllKeys).mockRejectedValueOnce(new Error("unlabelled-storage-secret"));
    tracer.startTrace("failure");
    await Promise.resolve(); await Promise.resolve();
    const trace = tracer.endTrace();
    expect(trace?.events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "ERROR" })]));
    expect(JSON.stringify(trace)).not.toContain("unlabelled-storage-secret");
  });
});
