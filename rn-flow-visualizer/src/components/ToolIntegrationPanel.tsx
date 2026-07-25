import { Cable, CheckCircle2, FileSearch, RadioTower } from 'lucide-react';
import { toolIntegrations } from '../data/toolIntegrations';
import { eventTypeClass, eventTypeLabels } from '../utils/eventMeta';

const statusIcon = {
  Connected: CheckCircle2,
  'Mock Mode': RadioTower,
  'Ready for SDK': Cable,
  'Import JSON': FileSearch,
  Concept: RadioTower,
};

export function ToolIntegrationPanel() {
  return (
    <section className="tools-panel">
      <div className="tools-header">
        <div>
          <h2>Tool Integration Center</h2>
          <p>Runtime tools produce trace events, static tools help compare real flow against module dependencies.</p>
        </div>
      </div>
      <div className="tool-grid">
        {toolIntegrations.map((tool) => {
          const Icon = statusIcon[tool.status];
          return (
            <article key={tool.name} className="tool-card">
              <div className="tool-card-title">
                <div>
                  <h3>{tool.name}</h3>
                  <span>{tool.type}</span>
                </div>
                <span className="tool-status">
                  <Icon size={15} />
                  {tool.status}
                </span>
              </div>
              <p>{tool.description}</p>
              <div className="capture-list">
                {tool.captures.map((capture) => (
                  <span key={capture}>{capture}</span>
                ))}
              </div>
              <div className="event-chip-row">
                {tool.eventTypes.length > 0 ? (
                  tool.eventTypes.map((type) => (
                    <span key={type} className={`filter-chip selected ${eventTypeClass[type]}`}>
                      {eventTypeLabels[type]}
                    </span>
                  ))
                ) : (
                  <span className="empty-copy">Static graph import</span>
                )}
              </div>
              <code>{tool.exampleOutput}</code>
            </article>
          );
        })}
      </div>
    </section>
  );
}
