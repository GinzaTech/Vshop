import type { TraceEventType } from '../types/trace';

export interface ToolIntegration {
  name: string;
  type: string;
  status: 'Connected' | 'Mock Mode' | 'Ready for SDK' | 'Import JSON' | 'Concept';
  captures: string[];
  eventTypes: TraceEventType[];
  description: string;
  exampleOutput: string;
}

export const toolIntegrations: ToolIntegration[] = [
  {
    name: 'React Native DevTools',
    type: 'Runtime UI Debugger',
    status: 'Concept',
    captures: ['Component tree', 'Props', 'State', 'Console logs'],
    eventTypes: ['COMPONENT_RENDER'],
    description: 'Shows how components receive props, update state, and render after each flow step.',
    exampleOutput: 'COMPONENT_RENDER HomeScreen rendered with user selector output.',
  },
  {
    name: 'Reactotron',
    type: 'Runtime Logger',
    status: 'Mock Mode',
    captures: ['Custom events', 'API logs', 'State logs', 'Performance logs'],
    eventTypes: ['UI_EVENT', 'API_REQUEST', 'API_RESPONSE', 'STATE_UPDATE'],
    description: 'Can send runtime logs from a React Native app to a local desktop dashboard.',
    exampleOutput: 'UI_EVENT User presses Login button.',
  },
  {
    name: 'Redux DevTools',
    type: 'State Debugger',
    status: 'Mock Mode',
    captures: ['Actions', 'State before', 'State after', 'State diff'],
    eventTypes: ['STATE_ACTION', 'STATE_UPDATE'],
    description: 'Turns dispatch history and reducer output into readable state timeline steps.',
    exampleOutput: 'STATE_ACTION dispatch(auth/setUser), STATE_UPDATE auth.user updated.',
  },
  {
    name: 'Zustand middleware',
    type: 'State Runtime',
    status: 'Ready for SDK',
    captures: ['set() calls', 'Previous snapshot', 'Next snapshot'],
    eventTypes: ['STATE_UPDATE'],
    description: 'Wraps store mutations so Zustand apps can emit the same trace format as Redux apps.',
    exampleOutput: 'STATE_UPDATE profile store updated.',
  },
  {
    name: 'Axios Interceptor',
    type: 'Network Runtime',
    status: 'Ready for SDK',
    captures: ['Request', 'Response', 'Duration', 'Error'],
    eventTypes: ['API_REQUEST', 'API_RESPONSE', 'API_ERROR'],
    description: 'Captures API traffic made through the configured Axios instance and masks sensitive fields.',
    exampleOutput: 'API_REQUEST POST /auth/login, API_RESPONSE 200 OK.',
  },
  {
    name: 'AsyncStorage Wrapper',
    type: 'Local Storage Runtime',
    status: 'Ready for SDK',
    captures: ['getItem', 'setItem', 'removeItem'],
    eventTypes: ['STORAGE_READ', 'STORAGE_WRITE'],
    description: 'Shows when a React Native app reads or writes local device storage.',
    exampleOutput: "STORAGE_WRITE AsyncStorage.setItem('accessToken').",
  },
  {
    name: 'React Navigation Listener',
    type: 'Navigation Runtime',
    status: 'Ready for SDK',
    captures: ['Screen transition', 'Route params', 'Navigation action'],
    eventTypes: ['NAVIGATION'],
    description: 'Records the exact step where one screen transitions to another.',
    exampleOutput: "NAVIGATION LoginScreen -> HomeScreen.",
  },
  {
    name: 'Android Studio Network Inspector',
    type: 'Native Network Inspector',
    status: 'Concept',
    captures: ['Native HTTP traffic', 'Headers', 'Timings'],
    eventTypes: ['API_REQUEST', 'API_RESPONSE', 'API_ERROR'],
    description: 'Can be used to compare JavaScript-level Axios logs with real native Android traffic.',
    exampleOutput: 'Native request confirms POST /auth/login reached the device network stack.',
  },
  {
    name: 'Madge',
    type: 'Static Dependency Graph',
    status: 'Import JSON',
    captures: ['File imports', 'Circular dependencies'],
    eventTypes: [],
    description: 'Maps file dependencies so runtime traces can be compared with static architecture.',
    exampleOutput: 'LoginScreen.tsx -> authService.ts -> apiClient.ts.',
  },
  {
    name: 'dependency-cruiser',
    type: 'Static Dependency Validator',
    status: 'Import JSON',
    captures: ['Dependency rules', 'Circular imports', 'Forbidden imports'],
    eventTypes: [],
    description: 'Checks whether flows respect architecture rules and flags unwanted imports.',
    exampleOutput: 'No circular dependency detected in auth flow modules.',
  },
];
