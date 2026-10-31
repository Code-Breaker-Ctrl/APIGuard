import React, { useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Node, Edge, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ShieldAlert, ShieldCheck, Activity, Sparkles, Key, Maximize2, HelpCircle, Plus, Minus } from 'lucide-react';
import type { BackendNode, BackendEdge, NodeState } from '../types';

interface GraphViewProps {
  backendNodes: BackendNode[];
  backendEdges: BackendEdge[];
  nodeStates: Record<string, NodeState>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

const OP_W = 160;
const OP_H = 48;
const ID_W = 130;
const ID_H = 34;

// Shortens "/projects/{project_id}/export" to "/projects/{id}/export" so it fits on one line.
const compactPath = (path: string) => path.replace(/\{[^}]+\}/g, '{id}');

// Custom Node for API Operations: method, one status word, and the path
const OperationNode = ({ data, selected }: any) => {
  const method = data.metadata?.method || 'GET';
  const path = data.metadata?.path || data.label;
  const status = data.status || 'idle';
  const isSetupOp =
    data.id === 'login' ||
    data.id === 'createProject' ||
    (data.metadata?.method === 'POST' && (!data.metadata?.path_params || data.metadata?.path_params.length === 0));

  let frame = 'border-slate-700 bg-slate-900';
  let badge: { text: string; cls: string; icon?: React.ReactNode } | null = null;

  if (status === 'probing') {
    frame = 'border-amber-400 bg-amber-950 animate-pulse';
    badge = { text: 'PROBING', cls: 'text-amber-300', icon: <Activity className="w-3 h-3 animate-spin" /> };
  } else if (status === 'vulnerable') {
    frame = 'border-rose-500 bg-rose-950';
    badge = { text: 'LEAK', cls: 'text-rose-300', icon: <ShieldAlert className="w-3 h-3" /> };
  } else if (status === 'secure' || status === 'secure_empty') {
    frame = 'border-emerald-400 bg-emerald-950';
    badge = { text: 'SAFE', cls: 'text-emerald-300', icon: <ShieldCheck className="w-3 h-3" /> };
  } else if (status === 'inconclusive') {
    frame = 'border-slate-500 bg-slate-800';
    badge = { text: 'UNSURE', cls: 'text-slate-300', icon: <HelpCircle className="w-3 h-3" /> };
  } else if (status === 'setup' || isSetupOp) {
    frame = 'border-blue-400 bg-blue-950';
    badge = { text: 'SETUP', cls: 'text-blue-300' };
  } else if (status === 'candidate') {
    frame = 'border-cyan-400 border-dashed bg-slate-900';
    badge = { text: 'NEXT', cls: 'text-cyan-300', icon: <Sparkles className="w-3 h-3" /> };
  }

  const methodColors: Record<string, string> = {
    GET: 'bg-blue-400 text-slate-950',
    POST: 'bg-emerald-400 text-slate-950',
    PATCH: 'bg-amber-400 text-slate-950',
    PUT: 'bg-purple-400 text-slate-950',
    DELETE: 'bg-rose-400 text-slate-950',
  };

  return (
    <div
      className={`px-2 py-1 border-2 text-left cursor-pointer box-border ${frame} ${selected ? 'outline outline-2 outline-offset-2 outline-emerald-400' : ''}`}
      style={{ width: OP_W, height: OP_H, boxSizing: 'border-box' }}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-500 border border-slate-800" />
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] px-1 ${methodColors[method] || methodColors.GET}`}>{method}</span>
        {badge && (
          <span className={`flex items-center gap-1 text-[10px] ${badge.cls}`}>
            {badge.icon}
            {badge.text}
          </span>
        )}
      </div>
      <div className="text-[10px] text-slate-200 truncate mt-0.5" title={path}>
        {compactPath(path)}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-500 border border-slate-800" />
    </div>
  );
};

// Custom Node for Identifiers
const IdentifierNode = ({ data, selected }: any) => (
  <div
    className={`px-2 py-1 border-2 border-amber-500 bg-amber-950 text-left box-border flex items-center gap-1.5 ${
      selected ? 'outline outline-2 outline-offset-2 outline-amber-400' : ''
    }`}
    style={{ width: ID_W, height: ID_H, boxSizing: 'border-box' }}
  >
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-amber-500" />
    <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    <div className="text-[11px] text-amber-200 truncate">{data.label}</div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-amber-500" />
  </div>
);

const nodeTypes = {
  operationNode: OperationNode,
  identifierNode: IdentifierNode,
};

// Resource grouping nodes and redundant edges are hidden to keep the graph readable:
// - OPERATES_ON edges only say "this op touches that resource" (the path already shows it)
// - a CONSUMES edge into an op that is already NESTED_UNDER another op is implied by that nesting
const visibleGraph = (backendNodes: BackendNode[], backendEdges: BackendEdge[]) => {
  const nodes = backendNodes.filter((n) => n.type !== 'resource_type');
  const nestedTargets = new Set(backendEdges.filter((e) => e.type === 'NESTED_UNDER').map((e) => e.to_node));
  const edges = backendEdges.filter((e) => {
    if (e.type === 'OPERATES_ON') return false;
    if (e.type === 'CONSUMES' && nestedTargets.has(e.to_node)) return false;
    return true;
  });
  return { nodes, edges };
};

// Internal helper for fitView triggering inside ReactFlow context
const FitViewInternal: React.FC<{
  dep: any;
}> = ({ dep }) => {
  const { fitView } = useReactFlow();

  useEffect(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.06 });
    });
    const timer = setTimeout(() => {
      fitView({ padding: 0.06 });
    }, 120);
    return () => clearTimeout(timer);
  }, [dep, fitView]);

  return null;
};

export const GraphView: React.FC<GraphViewProps> = ({
  backendNodes,
  backendEdges,
  nodeStates,
  selectedNodeId,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // The page scrolls over the graph; zooming needs Ctrl (or a pinch). A touch screen cannot pan it
  // with a finger either, because that finger is scrolling the page.
  const [touchOnly] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const [wheelHint, setWheelHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) return;
    setWheelHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setWheelHint(false), 1300);
  };
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const nodeStatesRef = useRef(nodeStates);
  useEffect(() => {
    nodeStatesRef.current = nodeStates;
  }, [nodeStates]);

  const selectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  // (3) Run Dagre layout ONLY when the graph (spec) changes, NOT on scan events
  useEffect(() => {
    if (!backendNodes || backendNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: shownNodes, edges: shownEdges } = visibleGraph(backendNodes, backendEdges);
    const sizeOf = (node: BackendNode) =>
      node.type === 'operation' ? { width: OP_W, height: OP_H } : { width: ID_W, height: ID_H };

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', align: 'UL', nodesep: 28, ranksep: 50, marginx: 16, marginy: 16 });
    g.setDefaultEdgeLabel(() => ({}));

    // Nodes with no drawn edge (the login route) are laid out by hand: dagre would park them at the far
    // left and make the whole graph wider, which shrinks everything when it is fitted to the panel.
    const connected = new Set(shownEdges.flatMap((e) => [e.from_node, e.to_node]));
    const loose = shownNodes.filter((n) => !connected.has(n.id));

    shownNodes.filter((n) => connected.has(n.id)).forEach((node) => g.setNode(node.id, sizeOf(node)));
    shownEdges.forEach((edge) => g.setEdge(edge.from_node, edge.to_node));

    dagre.layout(g);

    const placed = g.nodes().map((id) => g.node(id));
    const topY = placed.length ? Math.min(...placed.map((p) => p.y)) : 0;
    let nextX = placed.filter((p) => p.y === topY).reduce((right, p) => Math.max(right, p.x + p.width / 2), 0);
    const loosePos: Record<string, { x: number; y: number }> = {};
    loose.forEach((node) => {
      const { width } = sizeOf(node);
      nextX += 28 + width / 2;
      loosePos[node.id] = { x: nextX, y: topY };
      nextX += width / 2;
    });

    const newNodes: Node[] = shownNodes.map((node) => {
      const pos = g.node(node.id) || loosePos[node.id] || { x: 0, y: 0 };
      const { width, height } = sizeOf(node);
      const customType = node.type === 'identifier' ? 'identifierNode' : 'operationNode';

      return {
        id: node.id,
        type: customType,
        // dagre returns node centres; React Flow positions by top-left corner
        position: { x: pos.x - width / 2, y: pos.y - height / 2 },
        width,
        height,
        initialWidth: width,
        initialHeight: height,
        style: { width: `${width}px`, height: `${height}px` },
        selected: node.id === selectedNodeIdRef.current,
        data: {
          ...node,
          status: nodeStatesRef.current[node.id] || 'idle',
        },
      };
    });

    const newEdges: Edge[] = shownEdges.map((edge, idx) => {
      const isPropagated = edge.provenance === 'propagated' || edge.provenance === 'heuristic';
      const isVulnerableEdge =
        nodeStatesRef.current[edge.to_node] === 'vulnerable' || nodeStatesRef.current[edge.from_node] === 'vulnerable';

      let strokeColor = isPropagated ? '#2c7b94' : '#76764f';
      if (isVulnerableEdge) strokeColor = '#b3342b';

      return {
        id: `e_${edge.from_node}_${edge.to_node}_${idx}`,
        source: edge.from_node,
        target: edge.to_node,
        type: 'step',
        animated: isVulnerableEdge,
        style: {
          stroke: strokeColor,
          strokeWidth: 2,
          strokeDasharray: isPropagated ? '6,4' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 12,
          height: 12,
        },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);

    // (4) Call fitView after layout
    requestAnimationFrame(() => {
      rfInstanceRef.current?.fitView({ padding: 0.06 });
    });
    const timer = setTimeout(() => {
      rfInstanceRef.current?.fitView({ padding: 0.06 });
    }, 100);
    return () => clearTimeout(timer);
  }, [backendNodes, backendEdges, setNodes, setEdges]);

  // (2) When updating node state, update ONLY node.data via setNodes, never rebuild node array from layout
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        const currentStatus = (n.data as any)?.status;
        const newStatus = nodeStates[n.id] || 'idle';
        if (currentStatus === newStatus) return n;
        return {
          ...n,
          data: {
            ...n.data,
            status: newStatus,
          },
        };
      })
    );

    setEdges((prevEdges) =>
      prevEdges.map((e) => {
        const isVulnerableEdge =
          nodeStates[e.target] === 'vulnerable' || nodeStates[e.source] === 'vulnerable';
        const edgeDef = backendEdges.find(
          (be) => be.from_node === e.source && be.to_node === e.target
        );
        const isPropagated =
          edgeDef?.provenance === 'propagated' || edgeDef?.provenance === 'heuristic';
        let strokeColor = isPropagated ? '#2c7b94' : '#76764f';
        if (isVulnerableEdge) strokeColor = '#b3342b';

        const shouldAnimate = edgeDef?.type === 'NESTED_UNDER' || isVulnerableEdge;
        if (e.style?.stroke === strokeColor && e.animated === shouldAnimate) {
          return e;
        }

        return {
          ...e,
          animated: shouldAnimate,
          style: {
            ...e.style,
            stroke: strokeColor,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width: 12,
            height: 12,
          },
        };
      })
    );
  }, [nodeStates, backendEdges, setNodes, setEdges]);

  // Update selection without rebuilding
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        const isSelected = n.id === selectedNodeId;
        if (n.selected === isSelected) return n;
        return {
          ...n,
          selected: isSelected,
        };
      })
    );
  }, [selectedNodeId, setNodes]);

  // ResizeObserver on container re-running fitView({ padding: 0.06 })
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          requestAnimationFrame(() => {
            rfInstanceRef.current?.fitView({ padding: 0.06 });
          });
          setTimeout(() => {
            rfInstanceRef.current?.fitView({ padding: 0.06 });
          }, 60);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleFitView = () => {
    rfInstanceRef.current?.fitView({ padding: 0.06, duration: 250 });
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-slate-950 min-h-0"
      style={{ width: '100%', height: '100%' }}
      onWheel={handleWheel}
    >
      {/* Zoom and fit buttons overlay */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => rfInstanceRef.current?.zoomOut({ duration: 150 })}
          className="btn-ghost"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="w-3.5 h-3.5 text-cyan-400" />
        </button>
        <button
          type="button"
          onClick={() => rfInstanceRef.current?.zoomIn({ duration: 150 })}
          className="btn-ghost"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
        </button>
        <button
          type="button"
          onClick={handleFitView}
          className="btn-ghost"
          title="Fit view to all nodes (Padding: 0.15)"
        >
          <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Fit view</span>
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onInit={(instance) => {
          rfInstanceRef.current = instance;
          instance.fitView({ padding: 0.06 });
          requestAnimationFrame(() => {
            instance.fitView({ padding: 0.06 });
          });
          setTimeout(() => {
            instance.fitView({ padding: 0.06 });
          }, 80);
          setTimeout(() => {
            instance.fitView({ padding: 0.06 });
          }, 250);
        }}
        fitView
        fitViewOptions={{ padding: 0.06 }}
        preventScrolling={false}
        zoomOnDoubleClick={false}
        panOnDrag={!touchOnly}
        nodesDraggable={false}
        nodesConnectable={false}
        className="bg-slate-950"
      >
        <FitViewInternal dep={backendNodes} />
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#d9d2ae" />
      </ReactFlow>

      <div className={`graph-hint${wheelHint ? ' is-on' : ''}`} aria-hidden="true">
        Ctrl + scroll to zoom
      </div>
    </div>
  );
};
