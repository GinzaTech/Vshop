import type { FlowTrace } from '../types/trace';

const traceId = 'trace_fetch_profile';

export const fetchProfileTrace: FlowTrace = {
  id: traceId,
  name: 'Fetch Profile Flow',
  description: 'HomeScreen mounts, reads profile data through a service, updates profile store, and refreshes the profile card.',
  platform: 'android',
  framework: 'react-native',
  stateManager: 'zustand',
  createdAt: '2026-07-06T00:00:00.000Z',
  events: [
    { id: 'profile-e1', traceId, order: 1, type: 'COMPONENT_RENDER', label: 'HomeScreen mounted', timestamp: 0, durationMs: 28, status: 'success', source: { file: 'HomeScreen.tsx', componentName: 'HomeScreen' }, tool: 'React Native DevTools' },
    { id: 'profile-e2', traceId, order: 2, type: 'FUNCTION_CALL', label: 'useEffect runs fetchProfile()', timestamp: 80, durationMs: 26, status: 'success', source: { file: 'HomeScreen.tsx', functionName: 'useEffect' }, tool: 'Manual' },
    { id: 'profile-e3', traceId, order: 3, type: 'SERVICE_CALL', label: 'profileService.getProfile()', timestamp: 130, durationMs: 58, status: 'success', source: { file: 'profileService.ts', functionName: 'getProfile' }, tool: 'Manual' },
    { id: 'profile-e4', traceId, order: 4, type: 'API_REQUEST', label: 'GET /profile', timestamp: 220, durationMs: 360, status: 'success', input: { method: 'GET', url: '/profile' }, tool: 'Axios' },
    { id: 'profile-e5', traceId, order: 5, type: 'API_RESPONSE', label: '200 OK returns profile', timestamp: 630, durationMs: 24, status: 'success', output: { id: 'u_001', name: 'Demo User', tier: 'Gold' }, tool: 'Axios' },
    { id: 'profile-e6', traceId, order: 6, type: 'STATE_UPDATE', label: 'profile store updated', timestamp: 700, durationMs: 34, status: 'success', stateBefore: { profile: null }, stateAfter: { profile: { id: 'u_001', name: 'Demo User', tier: 'Gold' } }, tool: 'Zustand' },
    { id: 'profile-e7', traceId, order: 7, type: 'COMPONENT_RENDER', label: 'ProfileCard renders new data', timestamp: 780, durationMs: 40, status: 'success', source: { file: 'ProfileCard.tsx', componentName: 'ProfileCard' }, output: { rendered: true }, tool: 'React Native DevTools' },
  ],
};
