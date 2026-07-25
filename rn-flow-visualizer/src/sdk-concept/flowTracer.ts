import type { FlowTrace, TraceEvent } from '../types/trace';
import { maskSensitiveData } from '../utils/maskSensitiveData';

type Listener = (trace: FlowTrace) => void;

class FlowTracer {
  private currentTrace: FlowTrace | null = null;
  private listeners = new Set<Listener>();
  private socket: WebSocket | null = null;

  connect(url: string) {
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      if (this.currentTrace) {
        this.sendCurrentTrace();
      }
    };
  }

  startTrace(name: string) {
    const id = `trace_${Date.now()}`;
    this.currentTrace = {
      id,
      name,
      description: `${name} captured from React Native runtime.`,
      platform: 'android',
      framework: 'react-native',
      stateManager: 'none',
      events: [],
      createdAt: new Date().toISOString(),
    };
    this.emit();
  }

  track(event: Omit<TraceEvent, 'id' | 'traceId' | 'order' | 'timestamp' | 'status'> & Partial<Pick<TraceEvent, 'status'>>) {
    if (!this.currentTrace) {
      this.startTrace('Untitled Flow');
    }

    const trace = this.currentTrace!;
    trace.events.push({
      ...event,
      id: `event_${trace.events.length + 1}`,
      traceId: trace.id,
      order: trace.events.length + 1,
      timestamp: performance.now(),
      status: event.status ?? 'success',
      input: maskSensitiveData(event.input),
      output: maskSensitiveData(event.output),
      stateBefore: maskSensitiveData(event.stateBefore),
      stateAfter: maskSensitiveData(event.stateAfter),
    });

    this.emit();
  }

  endTrace() {
    this.emit();
    const completed = this.currentTrace;
    this.currentTrace = null;
    return completed;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    if (!this.currentTrace) return;
    this.listeners.forEach((listener) => listener(this.currentTrace!));
    this.sendCurrentTrace();
  }

  private sendCurrentTrace() {
    if (!this.currentTrace || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        kind: 'FLOW_TRACE',
        trace: this.currentTrace,
      }),
    );
  }
}

export const flowTracer = new FlowTracer();
