import { Layers3, Smartphone, Workflow } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';

export function Sidebar() {
  const traces = useFlowStore((state) => state.traces);
  const selectedTraceId = useFlowStore((state) => state.selectedTraceId);
  const selectTrace = useFlowStore((state) => state.selectTrace);
  const selectedTrace = traces.find((trace) => trace.id === selectedTraceId) ?? traces[0];

  return (
    <aside className="sidebar">
      <section className="sidebar-section">
        <div className="sidebar-title">
          <Workflow size={16} />
          Scenarios
        </div>
        <div className="scenario-list">
          {traces.map((trace) => (
            <button
              key={trace.id}
              type="button"
              className={`scenario-button ${trace.id === selectedTraceId ? 'selected' : ''}`}
              onClick={() => selectTrace(trace.id)}
            >
              <strong>{trace.name}</strong>
              <span>
                {trace.platform} / {trace.events.length} events
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section trace-summary">
        <div className="sidebar-title">
          <Smartphone size={16} />
          Current Trace
        </div>
        <h2>{selectedTrace.name}</h2>
        <p>{selectedTrace.description}</p>
        <div className="summary-grid">
          <span>Platform</span>
          <strong>{selectedTrace.platform}</strong>
          <span>Framework</span>
          <strong>{selectedTrace.framework}</strong>
          <span>State</span>
          <strong>{selectedTrace.stateManager ?? 'none'}</strong>
          <span>Events</span>
          <strong>{selectedTrace.events.length}</strong>
        </div>
      </section>

      <section className="sidebar-section layer-map">
        <div className="sidebar-title">
          <Layers3 size={16} />
          Runtime Layers
        </div>
        <div className="layer-stack">
          <span>UI event</span>
          <span>Function</span>
          <span>Service</span>
          <span>Network</span>
          <span>Storage</span>
          <span>State</span>
          <span>Navigation</span>
          <span>Render</span>
        </div>
      </section>
    </aside>
  );
}
