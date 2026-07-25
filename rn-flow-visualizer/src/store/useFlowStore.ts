import { create } from 'zustand';
import { traces as defaultTraces } from '../data/traces';
import type { FlowTrace, TraceEventType } from '../types/trace';
import { eventTypeOrder } from '../utils/eventMeta';

interface FlowVisualizerStore {
  traces: FlowTrace[];
  selectedTraceId: string;
  selectedEventId: string | null;
  currentStepIndex: number;
  isPlaying: boolean;
  speed: number;
  enabledEventTypes: TraceEventType[];
  searchQuery: string;
  selectTrace: (traceId: string) => void;
  selectEvent: (eventId: string) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  stepNext: () => void;
  stepBack: () => void;
  setSpeed: (speed: number) => void;
  toggleEventType: (type: TraceEventType) => void;
  setSearchQuery: (query: string) => void;
  importTrace: (trace: FlowTrace) => void;
}

function firstEventId(trace?: FlowTrace) {
  return trace?.events[0]?.id ?? null;
}

export const useFlowStore = create<FlowVisualizerStore>((set, get) => ({
  traces: defaultTraces,
  selectedTraceId: defaultTraces[0].id,
  selectedEventId: firstEventId(defaultTraces[0]),
  currentStepIndex: 0,
  isPlaying: false,
  speed: 1,
  enabledEventTypes: eventTypeOrder,
  searchQuery: '',

  selectTrace: (traceId) => {
    const trace = get().traces.find((item) => item.id === traceId);
    set({
      selectedTraceId: traceId,
      selectedEventId: firstEventId(trace),
      currentStepIndex: 0,
      isPlaying: false,
      searchQuery: '',
    });
  },

  selectEvent: (eventId) => {
    const trace = get().traces.find((item) => item.id === get().selectedTraceId);
    const index = trace?.events.findIndex((event) => event.id === eventId) ?? -1;

    set({
      selectedEventId: eventId,
      currentStepIndex: index >= 0 ? index : get().currentStepIndex,
    });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  reset: () => {
    const trace = get().traces.find((item) => item.id === get().selectedTraceId);
    set({ currentStepIndex: 0, selectedEventId: firstEventId(trace), isPlaying: false });
  },

  stepNext: () => {
    const trace = get().traces.find((item) => item.id === get().selectedTraceId);
    if (!trace) return;

    const nextIndex = Math.min(get().currentStepIndex + 1, trace.events.length - 1);
    set({
      currentStepIndex: nextIndex,
      selectedEventId: trace.events[nextIndex]?.id ?? null,
      isPlaying: nextIndex < trace.events.length - 1 ? get().isPlaying : false,
    });
  },

  stepBack: () => {
    const trace = get().traces.find((item) => item.id === get().selectedTraceId);
    if (!trace) return;

    const previousIndex = Math.max(get().currentStepIndex - 1, 0);
    set({
      currentStepIndex: previousIndex,
      selectedEventId: trace.events[previousIndex]?.id ?? null,
      isPlaying: false,
    });
  },

  setSpeed: (speed) => set({ speed }),

  toggleEventType: (type) => {
    const enabled = get().enabledEventTypes;
    const next = enabled.includes(type) ? enabled.filter((item) => item !== type) : [...enabled, type];
    set({ enabledEventTypes: next.length > 0 ? next : enabled });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  importTrace: (trace) => {
    set((state) => ({
      traces: [trace, ...state.traces.filter((item) => item.id !== trace.id)],
      selectedTraceId: trace.id,
      selectedEventId: firstEventId(trace),
      currentStepIndex: 0,
      isPlaying: false,
    }));
  },
}));
