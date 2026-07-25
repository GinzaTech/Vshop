import type { TraceEventStatus, TraceEventType } from '../types/trace';

export const eventTypeLabels: Record<TraceEventType, string> = {
  UI_EVENT: 'UI Event',
  COMPONENT_RENDER: 'Render',
  FUNCTION_CALL: 'Function',
  SERVICE_CALL: 'Service',
  API_REQUEST: 'API Request',
  API_RESPONSE: 'API Response',
  API_ERROR: 'API Error',
  STORAGE_READ: 'Storage Read',
  STORAGE_WRITE: 'Storage Write',
  STATE_ACTION: 'State Action',
  STATE_UPDATE: 'State Update',
  NAVIGATION: 'Navigation',
  ERROR: 'Error',
};

export const eventTypeOrder: TraceEventType[] = [
  'UI_EVENT',
  'COMPONENT_RENDER',
  'FUNCTION_CALL',
  'SERVICE_CALL',
  'API_REQUEST',
  'API_RESPONSE',
  'API_ERROR',
  'STORAGE_READ',
  'STORAGE_WRITE',
  'STATE_ACTION',
  'STATE_UPDATE',
  'NAVIGATION',
  'ERROR',
];

export const eventTypeClass: Record<TraceEventType, string> = {
  UI_EVENT: 'type-ui',
  COMPONENT_RENDER: 'type-render',
  FUNCTION_CALL: 'type-function',
  SERVICE_CALL: 'type-service',
  API_REQUEST: 'type-api',
  API_RESPONSE: 'type-api-response',
  API_ERROR: 'type-error',
  STORAGE_READ: 'type-storage',
  STORAGE_WRITE: 'type-storage',
  STATE_ACTION: 'type-state',
  STATE_UPDATE: 'type-state',
  NAVIGATION: 'type-navigation',
  ERROR: 'type-error',
};

export const statusClass: Record<TraceEventStatus, string> = {
  idle: 'status-idle',
  active: 'status-active',
  success: 'status-success',
  warning: 'status-warning',
  error: 'status-error',
};
