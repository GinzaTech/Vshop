import type { FlowTrace } from '../types/trace';

export function exportMarkdown(trace: FlowTrace) {
  const steps = trace.events.map((event) => `${event.order}. ${event.label}`).join('\n');
  const movement = trace.events
    .map((event) => event.source?.componentName ?? event.source?.functionName ?? event.source?.file ?? event.type)
    .filter(Boolean)
    .join(' -> ');

  return `# ${trace.name}

## Summary
${trace.description}

## Steps

${steps}

## Data Movement

${movement}

## Tools

${Array.from(new Set(trace.events.map((event) => event.tool).filter(Boolean))).join(', ')}
`;
}
