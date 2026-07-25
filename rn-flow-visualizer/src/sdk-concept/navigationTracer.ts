import { flowTracer } from './flowTracer';

export function trackNavigation(previousRouteName: string | undefined, currentRouteName: string | undefined, params?: unknown) {
  if (!currentRouteName || previousRouteName === currentRouteName) return;

  flowTracer.track({
    type: 'NAVIGATION',
    label: `${previousRouteName ?? 'unknown'} -> ${currentRouteName}`,
    input: {
      from: previousRouteName,
      to: currentRouteName,
      params,
    },
    tool: 'React Navigation',
  });
}
