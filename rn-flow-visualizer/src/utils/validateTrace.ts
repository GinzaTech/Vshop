import type { FlowTrace } from '../types/trace';

export function validateTrace(value: unknown): value is FlowTrace {
  if (!value || typeof value !== 'object') return false;

  const trace = value as Partial<FlowTrace>;
  return (
    typeof trace.id === 'string' &&
    typeof trace.name === 'string' &&
    trace.framework === 'react-native' &&
    Array.isArray(trace.events) &&
    trace.events.every(
      (event) =>
        event &&
        typeof event === 'object' &&
        typeof event.id === 'string' &&
        typeof event.traceId === 'string' &&
        typeof event.order === 'number' &&
        typeof event.type === 'string' &&
        typeof event.label === 'string' &&
        typeof event.timestamp === 'number',
    )
  );
}
