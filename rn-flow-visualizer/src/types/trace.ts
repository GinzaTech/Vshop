export type TraceEventType =
  | 'UI_EVENT'
  | 'COMPONENT_RENDER'
  | 'FUNCTION_CALL'
  | 'SERVICE_CALL'
  | 'API_REQUEST'
  | 'API_RESPONSE'
  | 'API_ERROR'
  | 'STORAGE_READ'
  | 'STORAGE_WRITE'
  | 'STATE_ACTION'
  | 'STATE_UPDATE'
  | 'NAVIGATION'
  | 'ERROR';

export type TraceEventStatus = 'idle' | 'active' | 'success' | 'warning' | 'error';

export type FlowTool =
  | 'Reactotron'
  | 'Redux DevTools'
  | 'Zustand'
  | 'Axios'
  | 'AsyncStorage'
  | 'React Navigation'
  | 'React Native DevTools'
  | 'Madge'
  | 'Manual';

export interface TraceEvent {
  id: string;
  traceId: string;
  order: number;
  type: TraceEventType;
  label: string;
  description?: string;
  timestamp: number;
  durationMs?: number;
  status: TraceEventStatus;
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
}

export interface FlowTrace {
  id: string;
  name: string;
  description: string;
  platform: 'android' | 'ios' | 'web' | 'mock';
  framework: 'react-native';
  stateManager?: 'redux' | 'zustand' | 'context' | 'none';
  events: TraceEvent[];
  createdAt: string;
}

export interface FlowGraphNode {
  id: string;
  eventId: string;
  type: TraceEventType;
  label: string;
  status: TraceEventStatus;
  position: {
    x: number;
    y: number;
  };
}

export interface FlowGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}
