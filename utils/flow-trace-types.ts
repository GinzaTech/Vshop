export type TraceEventInput = {
  type: "UI_EVENT" | "COMPONENT_RENDER" | "FUNCTION_CALL" | "SERVICE_CALL" |
    "API_REQUEST" | "API_RESPONSE" | "API_ERROR" | "STORAGE_READ" | "STORAGE_WRITE" |
    "STATE_ACTION" | "STATE_UPDATE" | "NAVIGATION" | "ERROR";
  label: string;
  description?: string;
  durationMs?: number;
  status?: "idle" | "active" | "success" | "warning" | "error";
  source?: { file?: string; functionName?: string; componentName?: string; line?: number };
  input?: unknown;
  output?: unknown;
  stateBefore?: unknown;
  stateAfter?: unknown;
  error?: { message: string; stack?: string; code?: string | number };
  tool?: "Reactotron" | "Redux DevTools" | "Zustand" | "Axios" | "AsyncStorage" |
    "React Navigation" | "React Native DevTools" | "Madge" | "Manual";
  codeSnippet?: string;
  highlightedLines?: number[];
};

export type FlowTrace = {
  id: string;
  name: string;
  description: string;
  platform: "android" | "ios" | "web";
  framework: "react-native";
  stateManager: "zustand";
  events: (TraceEventInput & { id: string; traceId: string; order: number; timestamp: number })[];
  createdAt: string;
};
