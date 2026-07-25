import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { useFlowStore } from '../store/useFlowStore';
import type { TraceEventType } from '../types/trace';
import { eventTypeClass, eventTypeLabels, eventTypeOrder, statusClass } from '../utils/eventMeta';
import { formatDuration, formatTimestamp } from '../utils/formatDuration';

export function Timeline() {
  const traces = useFlowStore((state) => state.traces);
  const selectedTraceId = useFlowStore((state) => state.selectedTraceId);
  const selectedEventId = useFlowStore((state) => state.selectedEventId);
  const enabledEventTypes = useFlowStore((state) => state.enabledEventTypes);
  const searchQuery = useFlowStore((state) => state.searchQuery);
  const selectEvent = useFlowStore((state) => state.selectEvent);
  const toggleEventType = useFlowStore((state) => state.toggleEventType);
  const setSearchQuery = useFlowStore((state) => state.setSearchQuery);
  const trace = traces.find((item) => item.id === selectedTraceId) ?? traces[0];

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return trace.events.filter((event) => {
      const typeEnabled = enabledEventTypes.includes(event.type);
      const matchesSearch =
        query.length === 0 ||
        event.label.toLowerCase().includes(query) ||
        event.type.toLowerCase().includes(query) ||
        event.tool?.toLowerCase().includes(query);

      return typeEnabled && matchesSearch;
    });
  }, [enabledEventTypes, searchQuery, trace.events]);

  return (
    <section className="timeline panel">
      <div className="panel-heading">
        <div>
          <h2>Timeline</h2>
          <span>{filteredEvents.length} visible events</span>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search events, tools, API..." />
        </label>
      </div>

      <div className="filter-row">
        {eventTypeOrder.map((type: TraceEventType) => (
          <button
            key={type}
            type="button"
            className={`filter-chip ${eventTypeClass[type]} ${enabledEventTypes.includes(type) ? 'selected' : ''}`}
            onClick={() => toggleEventType(type)}
          >
            {eventTypeLabels[type]}
          </button>
        ))}
      </div>

      <div className="timeline-list">
        <div className="timeline-head" aria-hidden="true">
          <span>Time</span>
          <span>Type</span>
          <span>Event</span>
          <span>Tool</span>
          <span>Status</span>
          <span>Latency</span>
        </div>
        {filteredEvents.map((event) => (
          <button
            key={event.id}
            type="button"
            className={`timeline-row ${event.id === selectedEventId ? 'selected' : ''}`}
            onClick={() => selectEvent(event.id)}
          >
            <span className="timeline-time">{formatTimestamp(event.timestamp)}</span>
            <span className={`timeline-type ${eventTypeClass[event.type]}`}>{eventTypeLabels[event.type]}</span>
            <span className="timeline-label">{event.label}</span>
            <span className="timeline-tool">{event.tool ?? 'Manual'}</span>
            <span className={`timeline-status ${statusClass[event.status]}`}>{event.status}</span>
            <span className="timeline-duration">{formatDuration(event.durationMs)}</span>
          </button>
        ))}
        {filteredEvents.length === 0 && <p className="empty-copy">No events match the current filters.</p>}
      </div>
    </section>
  );
}
