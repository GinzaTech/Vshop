import { AlertTriangle, CheckCircle2, Clock3, FileCode2, RadioTower } from 'lucide-react';
import type { TraceEvent } from '../types/trace';
import { eventTypeClass, eventTypeLabels, statusClass } from '../utils/eventMeta';
import { formatDuration, formatTimestamp } from '../utils/formatDuration';
import { JsonViewer } from './JsonViewer';

interface EventInspectorProps {
  event: TraceEvent | null;
}

export function EventInspector({ event }: EventInspectorProps) {
  if (!event) {
    return (
      <aside className="inspector">
        <div className="panel">
          <h2>Inspector</h2>
          <p className="empty-copy">Select a node or timeline event to inspect details.</p>
        </div>
      </aside>
    );
  }

  const detail = {
    id: event.id,
    type: event.type,
    label: event.label,
    description: event.description,
    timestamp: event.timestamp,
    durationMs: event.durationMs,
    source: event.source,
    input: event.input,
    output: event.output,
    stateBefore: event.stateBefore,
    stateAfter: event.stateAfter,
    error: event.error,
    tool: event.tool,
  };

  return (
    <aside className="inspector">
      <section className="panel inspector-card">
        <div className="inspector-title">
          <span className={`type-pill ${eventTypeClass[event.type]}`}>{eventTypeLabels[event.type]}</span>
          <span className={`status-pill ${statusClass[event.status]}`}>{event.status}</span>
        </div>
        <h2>{event.label}</h2>
        {event.description && <p className="inspector-copy">{event.description}</p>}
        <div className="metric-grid">
          <span>
            <Clock3 size={15} />
            {formatTimestamp(event.timestamp)}
          </span>
          <span>
            <RadioTower size={15} />
            {formatDuration(event.durationMs)}
          </span>
          <span>
            <FileCode2 size={15} />
            {event.source?.file ?? 'unknown'}
          </span>
          <span>
            {event.status === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            {event.tool ?? 'Manual'}
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Event Detail</h2>
          <span>JSON</span>
        </div>
        <JsonViewer data={detail} />
      </section>
    </aside>
  );
}
