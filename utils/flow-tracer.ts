/** Explicitly opted-in DEV diagnostics. Storage and network bodies are never captured. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { installTraceInstrumentation } from "./flow-trace-instrumentation";
import type { FlowTrace, TraceEventInput } from "./flow-trace-types";
import { redactLogValue, sanitizeErrorForLog } from "./log-redaction";

class FlowTracer {
  private socket: WebSocket | null = null;
  private currentTrace: FlowTrace | null = null;
  private traceStartedAt = 0;
  private queue: string[] = [];
  private uninstall: (() => void) | null = null;
  private stores = new Map<string, () => void>();
  private snapshotTraceId: string | null = null;
  private eventSequence = 0;
  private traceSequence = 0;
  private sendTimeout: ReturnType<typeof setTimeout> | null = null;

  private enabled = () => {
    if (__DEV__ && process.env.EXPO_PUBLIC_FLOW_TRACING === "1") return true;
    this.currentTrace = null;
    this.snapshotTraceId = null;
    this.queue = [];
    if (this.sendTimeout) clearTimeout(this.sendTimeout);
    this.sendTimeout = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
    this.uninstall?.();
    this.uninstall = null;
    this.stores.forEach((unsubscribe) => unsubscribe());
    this.stores.clear();
    return false;
  };

  connect(url = process.env.EXPO_PUBLIC_FLOW_TRACE_WS || "ws://127.0.0.1:8787") {
    if (!this.enabled() || this.socket) return;
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      if (!this.enabled() || this.socket !== socket) return;
      const queued = this.queue;
      this.queue = [];
      queued.forEach((message) => socket.send(message));
      this.sendCurrentTrace();
      void this.snapshotAsyncStorage();
    };
    const release = () => { if (this.socket === socket) this.socket = null; };
    socket.onerror = release;
    socket.onclose = release;
  }

  installGlobalTracing() {
    if (!this.enabled() || this.uninstall) return;
    this.uninstall = installTraceInstrumentation(this.enabled, (event) => this.track(event));
  }

  traceZustandStore<TState extends object>(name: string, store: {
    getState: () => TState;
    subscribe: (listener: (state: TState, previousState: TState) => void) => () => void;
  }) {
    if (!this.enabled() || this.stores.has(name)) return;
    const safeName = String(redactLogValue(name));
    const unsubscribe = store.subscribe((state, previousState) => {
      if (!this.enabled()) return;
      const current = state as Record<string, unknown>;
      const previous = previousState as Record<string, unknown>;
      const keys = Object.keys(current).filter((key) => current[key] !== previous[key]);
      if (!keys.length) return;
      this.track({ type: "STATE_UPDATE", label: `${safeName} updated`,
        input: { changedKeys: keys },
        stateBefore: Object.fromEntries(keys.map((key) => [key, previous[key]])),
        stateAfter: Object.fromEntries(keys.map((key) => [key, current[key]])), tool: "Zustand" });
    });
    this.stores.set(name, unsubscribe);
  }

  startTrace(name: string, description = `${name} captured from Vshop.`) {
    if (!this.enabled()) return;
    this.traceStartedAt = Date.now();
    this.eventSequence = 0;
    this.snapshotTraceId = null;
    this.currentTrace = {
      id: `trace_${Date.now()}_${++this.traceSequence}`,
      name: String(redactLogValue(name)), description: String(redactLogValue(description)),
      platform: Platform.OS === "ios" ? "ios" : Platform.OS === "web" ? "web" : "android",
      framework: "react-native", stateManager: "zustand", events: [], createdAt: new Date().toISOString(),
    };
    this.sendCurrentTrace();
    void this.snapshotAsyncStorage();
  }

  /** Only count keys: secure/legacy storage contents must never enter the tracer. */
  async snapshotAsyncStorage(label = "AsyncStorage metadata") {
    if (!this.enabled() || !this.currentTrace || this.snapshotTraceId === this.currentTrace.id) return;
    const traceId = this.currentTrace.id;
    this.snapshotTraceId = traceId;
    try {
      const keys = await AsyncStorage.getAllKeys();
      if (!this.enabled() || traceId !== this.currentTrace?.id) return;
      this.track({ type: "STORAGE_READ", label, output: { keyCount: keys.length, values: "[Omitted]" }, tool: "AsyncStorage" });
    } catch (error) {
      if (!this.enabled() || traceId !== this.currentTrace?.id) return;
      this.track({ type: "ERROR", label: "Storage metadata unavailable", error: sanitizeErrorForLog(error), tool: "AsyncStorage" });
    }
  }

  track(event: TraceEventInput) {
    if (!this.enabled()) return;
    if (!this.currentTrace) this.startTrace("Untitled Vshop Flow");
    const trace = this.currentTrace;
    if (!trace) return;
    const storageEvent = event.type === "STORAGE_READ" || event.type === "STORAGE_WRITE";
    const safe = storageEvent
      ? { type: event.type, label: "Storage operation (contents omitted)", tool: "AsyncStorage" as const }
      : redactLogValue({ ...event, error: undefined }) as TraceEventInput;
    const order = ++this.eventSequence;
    const nextEvent = {
      ...safe, ...(event.error ? { error: sanitizeErrorForLog(event.error) } : {}),
      id: `${trace.id}_event_${order}`, traceId: trace.id, order,
      timestamp: Math.max(Date.now() - this.traceStartedAt, 0), status: event.status ?? "success",
    };
    this.currentTrace = { ...trace, events: [...trace.events.slice(-299), nextEvent] };
    this.scheduleCurrentTraceSend();
  }

  endTrace() {
    if (!this.enabled()) return null;
    this.sendCurrentTrace();
    const trace = this.currentTrace;
    this.currentTrace = null;
    this.snapshotTraceId = null;
    return trace;
  }

  private sendCurrentTrace() {
    if (!this.enabled()) return;
    if (this.sendTimeout) clearTimeout(this.sendTimeout);
    this.sendTimeout = null;
    if (!this.currentTrace) return;
    const message = JSON.stringify({ kind: "FLOW_TRACE", trace: this.currentTrace });
    if (this.socket?.readyState === 1) this.socket.send(message);
    else this.queue = [...this.queue.slice(-4), message];
  }

  private scheduleCurrentTraceSend() {
    if (!this.enabled() || this.sendTimeout) return;
    this.sendTimeout = setTimeout(() => {
      this.sendTimeout = null;
      this.sendCurrentTrace();
    }, 400);
  }
}

export const flowTracer = new FlowTracer();
