import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import {
  AlertTriangle,
  Box,
  Braces,
  Cloud,
  Code2,
  Database,
  MousePointerClick,
  Network,
  RefreshCcw,
  Route,
  Server,
} from 'lucide-react';
import type { TraceEventStatus, TraceEventType } from '../types/trace';
import { eventTypeClass, eventTypeLabels, statusClass } from '../utils/eventMeta';

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  type: TraceEventType;
  status: TraceEventStatus;
  isActive: boolean;
  order: number;
}

const icons: Record<TraceEventType, typeof MousePointerClick> = {
  UI_EVENT: MousePointerClick,
  COMPONENT_RENDER: RefreshCcw,
  FUNCTION_CALL: Code2,
  SERVICE_CALL: Server,
  API_REQUEST: Cloud,
  API_RESPONSE: Network,
  API_ERROR: AlertTriangle,
  STORAGE_READ: Database,
  STORAGE_WRITE: Database,
  STATE_ACTION: Braces,
  STATE_UPDATE: Box,
  NAVIGATION: Route,
  ERROR: AlertTriangle,
};

export function FlowNode({ data }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const Icon = icons[nodeData.type];

  return (
    <div className={`flow-node ${eventTypeClass[nodeData.type]} ${statusClass[nodeData.status]} ${nodeData.isActive ? 'active-node' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-topline">
        <span className="node-order">{String(nodeData.order).padStart(2, '0')}</span>
        <span>{eventTypeLabels[nodeData.type]}</span>
      </div>
      <div className="node-body">
        <Icon size={18} />
        <strong>{nodeData.label}</strong>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
