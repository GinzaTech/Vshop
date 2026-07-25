import type { TraceEvent } from '../types/trace';

interface CodeTracePanelProps {
  event: TraceEvent | null;
}

export function CodeTracePanel({ event }: CodeTracePanelProps) {
  const snippet = event?.codeSnippet;

  if (!snippet) {
    return (
      <section className="panel code-panel">
        <div className="panel-heading">
          <h2>Code Trace</h2>
        </div>
        <p className="empty-copy">No snippet attached to this event yet.</p>
      </section>
    );
  }

  const highlighted = new Set(event.highlightedLines ?? []);

  return (
    <section className="panel code-panel">
      <div className="panel-heading">
        <h2>Code Trace</h2>
        <span>{event.source?.file ?? 'runtime'}</span>
      </div>
      <pre className="code-block">
        {snippet.split('\n').map((line, index) => {
          const lineNumber = index + 1;
          return (
            <code key={`${event.id}-${lineNumber}`} className={highlighted.has(lineNumber) ? 'highlighted-line' : undefined}>
              <span>{String(lineNumber).padStart(2, '0')}</span>
              {line || ' '}
            </code>
          );
        })}
      </pre>
    </section>
  );
}
