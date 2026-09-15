import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import type { TraceEventInput } from "./flow-trace-types";
import { sanitizeErrorForLog, sanitizeUrlForLog } from "./log-redaction";

type Track = (event: TraceEventInput) => void;
type Enabled = () => boolean;

function installAxios(enabled: Enabled, track: Track) {
  const timings = new WeakMap<object, number>();
  const requestId = axios.interceptors.request.use((config) => {
    if (enabled()) {
      timings.set(config, Date.now());
      track({ type: "API_REQUEST", label: `${config.method?.toUpperCase() ?? "GET"} ${sanitizeUrlForLog(config.url ?? "")}`, tool: "Axios" });
    }
    return config;
  });
  const responseId = axios.interceptors.response.use((response) => {
    if (enabled()) {
      const start = timings.get(response.config);
      timings.delete(response.config);
      track({ type: "API_RESPONSE", label: `${response.status} ${sanitizeUrlForLog(response.config.url ?? "")}`,
        durationMs: start === undefined ? undefined : Date.now() - start,
        output: { status: response.status }, tool: "Axios" });
    }
    return response;
  }, (error: unknown) => {
    if (enabled()) track({ type: "API_ERROR", label: "HTTP request failed", status: "error", error: sanitizeErrorForLog(error), tool: "Axios" });
    return Promise.reject(error);
  });
  return () => {
    axios.interceptors.request.eject(requestId);
    axios.interceptors.response.eject(responseId);
  };
}

function installFetch(enabled: Enabled, track: Track) {
  const original = globalThis.fetch;
  if (typeof original !== "function") return () => undefined;
  const wrapped: typeof fetch = async (input, init) => {
    if (!enabled()) return original(input, init);
    const startedAt = Date.now();
    const url = sanitizeUrlForLog(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    track({ type: "API_REQUEST", label: `Fetch ${url}`, tool: "Manual" });
    try {
      const response = await original(input, init);
      if (enabled()) track({ type: response.ok ? "API_RESPONSE" : "API_ERROR", label: `${response.status} ${url}`,
        output: { status: response.status }, durationMs: Date.now() - startedAt, tool: "Manual" });
      return response;
    } catch (error) {
      if (enabled()) track({ type: "API_ERROR", label: `Fetch failed ${url}`, error: sanitizeErrorForLog(error), tool: "Manual" });
      throw error;
    }
  };
  globalThis.fetch = wrapped;
  return () => { if (globalThis.fetch === wrapped) globalThis.fetch = original; };
}

function installStorage(enabled: Enabled, track: Track) {
  const get = AsyncStorage.getItem;
  const set = AsyncStorage.setItem;
  const remove = AsyncStorage.removeItem;
  // Delegate callbacks to the original implementation; never inspect keys or values.
  const getItem: typeof get = async (...args) => {
    const result = await get.apply(AsyncStorage, args);
    if (enabled()) track({ type: "STORAGE_READ", label: "AsyncStorage.getItem", tool: "AsyncStorage" });
    return result;
  };
  const setItem: typeof set = async (...args) => {
    await set.apply(AsyncStorage, args);
    if (enabled()) track({ type: "STORAGE_WRITE", label: "AsyncStorage.setItem", tool: "AsyncStorage" });
  };
  const removeItem: typeof remove = async (...args) => {
    await remove.apply(AsyncStorage, args);
    if (enabled()) track({ type: "STORAGE_WRITE", label: "AsyncStorage.removeItem", tool: "AsyncStorage" });
  };
  AsyncStorage.getItem = getItem;
  AsyncStorage.setItem = setItem;
  AsyncStorage.removeItem = removeItem;
  return () => {
    if (AsyncStorage.getItem === getItem) AsyncStorage.getItem = get;
    if (AsyncStorage.setItem === setItem) AsyncStorage.setItem = set;
    if (AsyncStorage.removeItem === removeItem) AsyncStorage.removeItem = remove;
  };
}

/** Instruments metadata only and supplies a reversible teardown when opt-in ends. */
export function installTraceInstrumentation(enabled: Enabled, track: Track) {
  if (!enabled()) return () => undefined;
  const undo = [installAxios(enabled, track), installFetch(enabled, track), installStorage(enabled, track)];
  return () => undo.forEach((uninstall) => uninstall());
}
