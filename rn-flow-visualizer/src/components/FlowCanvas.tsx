import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFlowStore } from '../store/useFlowStore';
import { buildGraphFromTrace, type FlowGraphLayoutMode } from '../utils/buildGraphFromTrace';
import { eventTypeClass } from '../utils/eventMeta';
import { FlowNode, type FlowNodeData } from './FlowNode';

const nodeTypes = {
  traceNode: FlowNode,
};

export function FlowCanvas() {
  const traces = useFlowStore((state) => state.traces);
  const selectedTraceId = useFlowStore((state) => state.selectedTraceId);
  const selectedEventId = useFlowStore((state) => state.selectedEventId);
  const selectEvent = useFlowStore((state) => state.selectEvent);
  const trace = traces.find((item) => item.id === selectedTraceId) ?? traces[0];
  const preferredLayoutMode: FlowGraphLayoutMode = trace.events.length > 12 ? 'compact' : 'sequence';
  const [layoutPreference, setLayoutPreference] = useState<{ traceId: string; mode: FlowGraphLayoutMode }>({
    traceId: selectedTraceId,
    mode: preferredLayoutMode,
  });
  const layoutMode = layoutPreference.traceId === selectedTraceId ? layoutPreference.mode : preferredLayoutMode;
  const [layoutResetKey, setLayoutResetKey] = useState(0);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const flowInstanceRef = useRef<ReactFlowInstance<Node<FlowNodeData>, Edge> | null>(null);
  const layoutSignatureRef = useRef('');
  const graphInstanceKey = `${trace.id}:${layoutMode}:${layoutResetKey}`;

  const { graphNodes, edges } = useMemo(() => {
    const graph = buildGraphFromTrace(trace, layoutMode);

    const flowEdges: Edge[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.source === selectedEventId,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke: edge.source === selectedEventId ? '#31d0aa' : '#4b5653',
        strokeWidth: edge.source === selectedEventId ? 2.5 : 1.5,
      },
    }));

    return { graphNodes: graph.nodes, edges: flowEdges };
  }, [layoutMode, selectedEventId, trace]);

  const createFlowNodesFromGraph = useCallback(
    (sourceGraphNodes = graphNodes, positions = new Map<string, Node<FlowNodeData>['position']>()) =>
      sourceGraphNodes.map((node) => {
        const event = trace.events.find((item) => item.id === node.eventId)!;
        return {
          id: node.id,
          type: 'traceNode',
          position: positions.get(node.id) ?? node.position,
          data: {
            label: node.label,
            type: node.type,
            status: event.id === selectedEventId ? 'active' : event.status,
            isActive: event.id === selectedEventId,
            order: event.order,
          },
        };
      }),
    [graphNodes, selectedEventId, trace.events],
  );
  const createFlowNodes = useCallback(
    (positions = new Map<string, Node<FlowNodeData>['position']>()) => createFlowNodesFromGraph(graphNodes, positions),
    [createFlowNodesFromGraph, graphNodes],
  );

  useEffect(() => {
    setNodes((currentNodes) => {
      const layoutSignature = `${trace.id}:${layoutMode}:${layoutResetKey}:${trace.events.map((event) => event.id).join('|')}`;
      if (layoutSignatureRef.current !== layoutSignature) {
        layoutSignatureRef.current = layoutSignature;
        return createFlowNodes();
      }

      const currentPositions = new Map(currentNodes.map((node) => [node.id, node.position]));
      return createFlowNodes(currentPositions);
    });
  }, [createFlowNodes, layoutMode, layoutResetKey, setNodes, trace.events, trace.id]);

  const setGraphLayoutMode = useCallback(
    (mode: FlowGraphLayoutMode) => {
      if (layoutMode === mode) return;

      setLayoutPreference({ traceId: selectedTraceId, mode });
      setNodes(createFlowNodesFromGraph(buildGraphFromTrace(trace, mode).nodes));
      setLayoutResetKey((value) => value + 1);
    },
    [createFlowNodesFromGraph, layoutMode, selectedTraceId, setNodes, trace],
  );

  useEffect(() => {
    if (!flowInstanceRef.current || nodes.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      void flowInstanceRef.current?.fitView({ padding: 0.18, duration: 180 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [layoutMode, nodes.length, trace.id]);

  const resetLayout = useCallback(() => {
    setNodes(createFlowNodes());
    setLayoutResetKey((value) => value + 1);
  }, [createFlowNodes, setNodes]);

  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => selectEvent(node.id), [selectEvent]);

  return (
    <section className="canvas-shell">
      <div className="panel-heading canvas-heading">
        <div>
          <h2>Flow Graph</h2>
          <span>{trace.events.length} ordered events / {layoutMode} layout</span>
        </div>
        <div className="canvas-tools">
          <div className="graph-mode-toggle" aria-label="Graph layout mode">
            <button
              type="button"
              className={layoutMode === 'compact' ? 'selected' : undefined}
              onClick={() => setGraphLayoutMode('compact')}
            >
              Compact
            </button>
            <button
              type="button"
              className={layoutMode === 'sequence' ? 'selected' : undefined}
              onClick={() => setGraphLayoutMode('sequence')}
            >
              Sequence
            </button>
          </div>
          <div className="graph-legend">
            <span className={eventTypeClass.UI_EVENT}>UI</span>
            <span className={eventTypeClass.API_REQUEST}>API</span>
            <span className={eventTypeClass.STATE_UPDATE}>State</span>
            <span className={eventTypeClass.NAVIGATION}>Nav</span>
          </div>
          <button type="button" className="mini-button" onClick={resetLayout}>
            Reset layout
          </button>
        </div>
      </div>
      <ReactFlow
        key={graphInstanceKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
        nodesDraggable
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.45}
        maxZoom={1.8}
      >
        <Background color="#26302d" gap={22} />
        <MiniMap
          pannable
          zoomable
          bgColor="#151a19"
          maskColor="rgba(49, 208, 170, 0.08)"
          nodeColor={(node) => (node.data.isActive ? '#31d0aa' : '#515a57')}
        />
        <Controls />
      </ReactFlow>
    </section>
  );
}
