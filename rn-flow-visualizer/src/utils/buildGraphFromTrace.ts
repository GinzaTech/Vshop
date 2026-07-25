import type { FlowGraphEdge, FlowGraphNode, FlowTrace, TraceEventType } from '../types/trace';

export type FlowGraphLayoutMode = 'sequence' | 'compact';

function getYByEventType(type: TraceEventType) {
  if (type === 'UI_EVENT' || type === 'COMPONENT_RENDER') return 0;
  if (type === 'FUNCTION_CALL' || type === 'SERVICE_CALL') return 140;
  if (type === 'API_REQUEST' || type === 'API_RESPONSE' || type === 'API_ERROR') return 280;
  if (type === 'STORAGE_READ' || type === 'STORAGE_WRITE' || type === 'STATE_ACTION' || type === 'STATE_UPDATE') return 420;
  if (type === 'NAVIGATION') return 560;
  return 700;
}

function getPositionByLayout(index: number, type: TraceEventType, mode: FlowGraphLayoutMode) {
  if (mode === 'sequence') {
    return {
      x: index * 260,
      y: getYByEventType(type),
    };
  }

  const columns = 3;
  const row = Math.floor(index / columns);
  const column = index % columns;

  return {
    x: column * 360,
    y: row * 180,
  };
}

export function buildGraphFromTrace(trace: FlowTrace, mode: FlowGraphLayoutMode = 'sequence'): { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] } {
  const nodes = trace.events.map((event, index) => ({
    id: event.id,
    eventId: event.id,
    type: event.type,
    label: event.label,
    status: event.status,
    position: getPositionByLayout(index, event.type, mode),
  }));

  const edges = trace.events.slice(0, -1).map((event, index) => ({
    id: `${event.id}-${trace.events[index + 1].id}`,
    source: event.id,
    target: trace.events[index + 1].id,
  }));

  return { nodes, edges };
}
