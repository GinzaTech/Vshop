import { useEffect, useMemo, useState } from 'react';
import { FlowCanvas } from './components/FlowCanvas';
import { Header } from './components/Header';
import { EventInspector } from './components/EventInspector';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { ToolIntegrationPanel } from './components/ToolIntegrationPanel';
import { CodeTracePanel } from './components/CodeTracePanel';
import { useFlowStore } from './store/useFlowStore';
import { useLiveTrace } from './hooks/useLiveTrace';
import { formatDuration } from './utils/formatDuration';

function App() {
  const [view, setView] = useState<'flow' | 'tools'>('flow');
  const traces = useFlowStore((state) => state.traces);
  const selectedTraceId = useFlowStore((state) => state.selectedTraceId);
  const selectedEventId = useFlowStore((state) => state.selectedEventId);
  const isPlaying = useFlowStore((state) => state.isPlaying);
  const speed = useFlowStore((state) => state.speed);
  const stepNext = useFlowStore((state) => state.stepNext);
  const liveTrace = useLiveTrace();

  const trace = traces.find((item) => item.id === selectedTraceId) ?? traces[0];
  const selectedEvent = useMemo(() => trace.events.find((event) => event.id === selectedEventId) ?? trace.events[0] ?? null, [selectedEventId, trace.events]);
  const selectedIndex = trace.events.findIndex((event) => event.id === selectedEvent?.id);
  const errorCount = trace.events.filter((event) => event.status === 'error' || event.type === 'ERROR' || event.type === 'API_ERROR').length;
  const serviceCount = trace.events.filter((event) => event.type === 'API_REQUEST' || event.type === 'SERVICE_CALL' || event.type === 'API_RESPONSE').length;
  const totalDuration = trace.events.reduce((sum, event) => sum + (event.durationMs ?? 0), 0);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = window.setInterval(() => {
      stepNext();
    }, 1000 / speed);

    return () => window.clearInterval(interval);
  }, [isPlaying, speed, stepNext]);

  return (
    <div className="app-shell">
      <Header liveStatus={liveTrace.status} liveMessage={liveTrace.lastMessage} />
      <div className="workspace-bar">
        <div className="view-tabs" role="tablist" aria-label="Dashboard view">
          <button type="button" className={view === 'flow' ? 'selected' : undefined} onClick={() => setView('flow')}>
            Flow
          </button>
          <button type="button" className={view === 'tools' ? 'selected' : undefined} onClick={() => setView('tools')}>
            Integrations
          </button>
        </div>
        <div className="trace-metrics" aria-label="Current trace metrics">
          <span>
            <strong>{selectedIndex + 1}</strong>
            Step
          </span>
          <span>
            <strong>{trace.events.length}</strong>
            Events
          </span>
          <span>
            <strong>{serviceCount}</strong>
            Service
          </span>
          <span className={errorCount > 0 ? 'metric-alert' : undefined}>
            <strong>{errorCount}</strong>
            Errors
          </span>
          <span>
            <strong>{formatDuration(totalDuration)}</strong>
            Runtime
          </span>
        </div>
      </div>

      {view === 'flow' ? (
        <main className="dashboard-grid">
          <Sidebar />
          <div className="main-column">
            <FlowCanvas />
            <Timeline />
          </div>
          <div className="right-column">
            <EventInspector event={selectedEvent} />
            <CodeTracePanel event={selectedEvent} />
          </div>
        </main>
      ) : (
        <main className="tools-view">
          <ToolIntegrationPanel />
        </main>
      )}
    </div>
  );
}

export default App;
