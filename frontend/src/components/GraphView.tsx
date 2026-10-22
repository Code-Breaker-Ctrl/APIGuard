import React, { useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
} from '@xyflow/react';
import type { Node, Edge, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ShieldAlert, ShieldCheck, Activity, Sparkles, Database, Key, Maximize2 } from 'lucide-react';
import type { BackendNode, BackendEdge } from '../types';

interface GraphViewProps {
  backendNodes: BackendNode[];
  backendEdges: BackendEdge[];
  nodeStates: Record<string, 'idle' | 'setup' | 'not_tested' | 'probing' | 'vulnerable' | 'secure' | 'candidate'>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

// Custom Node for API Operations (Top-to-Bottom Handle Alignment)
const OperationNode = ({ data, selected }: any) => {
  const method = data.metadata?.method || 'GET';
  const path = data.metadata?.path || data.label;
  const status = data.status || 'idle';
  const isSetupOp =
    data.id === 'login' ||
    data.id === 'createProject' ||
    (data.metadata?.method === 'POST' && (!data.metadata?.path_params || data.metadata?.path_params.length === 0));

  let borderColor = 'border-[#263043]';
  let bgColor = 'bg-[#10141e]';
  let statusBadge = null;

  if (status === 'probing') {
    borderColor = 'border-amber-400 animate-pulse';
    bgColor = 'bg-amber-950/30';
    statusBadge = (
      <span className="flex items-center gap-1 text-[8.5px] text-amber-300 font-bold px-1 py-0.5 rounded bg-amber-900/50">
        <Activity className="w-2.5 h-2.5 animate-spin" /> PROBING
      </span>
    );
  } else if (status === 'vulnerable') {
    borderColor = 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-bounce-subtle';
    bgColor = 'bg-rose-950/40';
    statusBadge = (
      <span className="flex items-center gap-1 text-[8.5px] text-rose-300 font-bold px-1 py-0.5 rounded bg-rose-900/60">
        <ShieldAlert className="w-2.5 h-2.5" /> BOLA LEAK
      </span>
    );
  } else if (status === 'secure') {
    borderColor = 'border-emerald-500';
    bgColor = 'bg-emerald-950/30';
    statusBadge = (
      <span className="flex items-center gap-1 text-[8.5px] text-emerald-300 font-bold px-1 py-0.5 rounded bg-emerald-900/50">
        <ShieldCheck className="w-2.5 h-2.5" /> TESTED: NO LEAK
      </span>
    );
  } else if (status === 'setup' || isSetupOp) {
    borderColor = 'border-blue-500/40';
    bgColor = 'bg-blue-950/25';
    statusBadge = (
      <span className="flex items-center gap-1 text-[8.5px] text-blue-300 font-bold px-1.5 py-0.5 rounded bg-blue-900/50 border border-blue-700/50">
        SETUP
      </span>
    );
  } else if (status === 'candidate') {
    borderColor = 'border-cyan-400 border-dashed';
    bgColor = 'bg-cyan-950/20';
    statusBadge = (
      <span className="flex items-center gap-1 text-[8.5px] text-cyan-300 font-bold px-1 py-0.5 rounded bg-cyan-900/50">
        <Sparkles className="w-2.5 h-2.5" /> CANDIDATE
      </span>
    );
  } else {
    // Default for operations never probed (e.g. PATCH/DELETE with mutations off)
    borderColor = 'border-[#263043]';
    bgColor = 'bg-[#10141e]';
    statusBadge = (
      <span className="flex items-center gap-1 text-[8.5px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700/60">
        NOT TESTED
      </span>
    );
  }

  const methodColors: Record<string, string> = {
    GET: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    POST: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    PATCH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    PUT: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    DELETE: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  return (
    <div
      className={`px-2.5 py-1.5 rounded-lg border text-left shadow-lg transition-all duration-200 cursor-pointer w-[155px] ${bgColor} ${borderColor} ${
        selected ? 'ring-2 ring-emerald-400' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-500 border border-slate-800" />
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className={`text-[9px] font-bold font-mono px-1 py-0.2 rounded border ${methodColors[method] || methodColors.GET}`}>
          {method}
        </span>
        {statusBadge}
      </div>
      <div className="text-[10.5px] font-semibold text-slate-200 font-mono truncate" title={path}>
        {path}
      </div>
      <div className="text-[8.5px] text-slate-500 truncate mt-0.5">
        {data.metadata?.operationId || data.id}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-500 border border-slate-800" />
    </div>
  );
};

// Custom Node for Resource Collections
const ResourceNode = ({ data, selected }: any) => (
  <div
    className={`px-2 py-1.5 rounded-lg border border-emerald-500/40 bg-[#091a18] text-left shadow-md w-[110px] ${
      selected ? 'ring-2 ring-emerald-400' : ''
    }`}
  >
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-emerald-500" />
    <div className="flex items-center gap-1 text-[8.5px] font-bold text-emerald-400 font-mono mb-0.5">
      <Database className="w-2.5 h-2.5" />
      RESOURCE
    </div>
    <div className="text-[10.5px] font-bold text-slate-100 truncate">{data.label}</div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-emerald-500" />
  </div>
);

// Custom Node for Identifiers
const IdentifierNode = ({ data, selected }: any) => (
  <div
    className={`px-2 py-1.5 rounded-md border border-amber-500/40 bg-[#16120b] text-left shadow-sm w-[110px] ${
      selected ? 'ring-2 ring-amber-400' : ''
    }`}
  >
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-amber-500" />
    <div className="flex items-center gap-1 text-[8px] font-bold text-amber-400 font-mono mb-0.5">
      <Key className="w-2 h-2" />
      IDENTIFIER
    </div>
    <div className="text-[10.5px] font-mono font-medium text-amber-200 truncate">{data.label}</div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-amber-500" />
  </div>
);

const nodeTypes = {
  operationNode: OperationNode,
  resourceNode: ResourceNode,
  identifierNode: IdentifierNode,
};

// Internal helper for fitView triggering inside ReactFlow context
const FitViewInternal: React.FC<{
  dep: any;
}> = ({ dep }) => {
  const { fitView } = useReactFlow();

  useEffect(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.15 });
    });
    const timer = setTimeout(() => {
      fitView({ padding: 0.15 });
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

  // Compute Dagre hierarchical top-to-bottom layout
  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 18, ranksep: 36, marginx: 15, marginy: 15 });
    g.setDefaultEdgeLabel(() => ({}));

    backendNodes.forEach((node) => {
      const isOp = node.type === 'operation';
      const width = isOp ? 155 : 110;
      const height = isOp ? 50 : 36;
      g.setNode(node.id, { width, height });
    });

    backendEdges.forEach((edge) => {
      // Prioritize primary producer/consumer/nested hierarchy edges for the top-to-bottom layout:
      // 1. Skip secondary OPERATES_ON edges from downstream operations so they don't drag res_projects to the bottom
      if (edge.type === 'OPERATES_ON' && edge.from_node !== 'login' && edge.from_node !== 'createProject') {
        return;
      }
      // 2. For nested operations (export / summary), their structural parent is getProjectById (NESTED_UNDER);
      // skip direct CONSUMES in dagre layout to prevent horizontal ballooning
      if (edge.type === 'CONSUMES' && (edge.to_node === 'exportProjectBilling' || edge.to_node === 'getProjectSummary')) {
        return;
      }
      g.setEdge(edge.from_node, edge.to_node);
    });

    dagre.layout(g);

    const flowNodes: Node[] = backendNodes.map((node) => {
      const pos = g.node(node.id) || { x: 0, y: 0 };
      let customType = 'operationNode';
      if (node.type === 'resource_type') customType = 'resourceNode';
      if (node.type === 'identifier') customType = 'identifierNode';

      return {
        id: node.id,
        type: customType,
        position: { x: pos.x, y: pos.y },
        selected: node.id === selectedNodeId,
        data: {
          ...node,
          status: nodeStates[node.id] || 'idle',
        },
      };
    });

    const flowEdges: Edge[] = backendEdges.map((edge, idx) => {
      const isPropagated = edge.provenance === 'propagated' || edge.provenance === 'heuristic';
      const isVulnerableEdge =
        nodeStates[edge.to_node] === 'vulnerable' || nodeStates[edge.from_node] === 'vulnerable';

      let strokeColor = isPropagated ? '#38bdf8' : '#64748b';
      if (isVulnerableEdge) strokeColor = '#f43f5e';

      return {
        id: `e_${edge.from_node}_${edge.to_node}_${idx}`,
        source: edge.from_node,
        target: edge.to_node,
        animated: edge.type === 'NESTED_UNDER' || isVulnerableEdge,
        style: {
          stroke: strokeColor,
          strokeWidth: Math.max(1.8, edge.confidence * 2.8),
          strokeDasharray: isPropagated ? '5,5' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 14,
          height: 14,
        },
        label: edge.type.replace('_', ' ').toLowerCase(),
        labelStyle: { fill: '#f1f5f9', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 },
        labelBgStyle: { fill: '#0d131f', fillOpacity: 0.98 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [backendNodes, backendEdges, nodeStates, selectedNodeId]);

  // (1) Call fitView when nodes+layout are set
  useEffect(() => {
    if (rfInstanceRef.current && nodes.length > 0) {
      requestAnimationFrame(() => {
        rfInstanceRef.current?.fitView({ padding: 0.15 });
      });
      const timer = setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.15 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges]);

  // (2) ResizeObserver on container re-running fitView({ padding: 0.15 })
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          requestAnimationFrame(() => {
            rfInstanceRef.current?.fitView({ padding: 0.15 });
          });
          setTimeout(() => {
            rfInstanceRef.current?.fitView({ padding: 0.15 });
          }, 60);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleFitView = () => {
    rfInstanceRef.current?.fitView({ padding: 0.15, duration: 250 });
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-[#090b10] min-h-0"
      style={{ width: '100%', height: '100%' }}
    >
      {/* (4) Fit view button overlay */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleFitView}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-[#0d131f]/90 hover:bg-[#162033] text-slate-300 hover:text-white border border-[#232f48] rounded-md shadow-md transition cursor-pointer"
          title="Fit view to all nodes (Padding: 0.15)"
        >
          <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Fit view</span>
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onInit={(instance) => {
          rfInstanceRef.current = instance;
          // (1) Call fitView from onInit AND requestAnimationFrame / short timeout
          instance.fitView({ padding: 0.15 });
          requestAnimationFrame(() => {
            instance.fitView({ padding: 0.15 });
          });
          setTimeout(() => {
            instance.fitView({ padding: 0.15 });
          }, 80);
          setTimeout(() => {
            instance.fitView({ padding: 0.15 });
          }, 250);
        }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        className="bg-[#090b10]"
      >
        <FitViewInternal dep={nodes.length} />
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#1c2433" />
        <Controls
          showFitView={true}
          fitViewOptions={{ padding: 0.15 }}
          className="!bg-[#0d121c] !border !border-[#20293d] !rounded-lg text-slate-300 [&>button]:!bg-[#0d121c] [&>button]:!border-b [&>button]:!border-[#1f283d] [&>button]:!fill-slate-300 [&>button:hover]:!bg-[#1a2336]"
        />
        <MiniMap
          nodeColor={(n) => {
            if (nodeStates[n.id] === 'vulnerable') return '#f43f5e';
            if (nodeStates[n.id] === 'secure') return '#10b981';
            if (nodeStates[n.id] === 'setup' || n.id === 'login' || n.id === 'createProject') return '#3b82f6';
            if (nodeStates[n.id] === 'probing') return '#f59e0b';
            return '#1e293b';
          }}
          maskColor="rgba(9, 11, 16, 0.75)"
          className="!bg-[#0c0f17] !border !border-[#202738] rounded-lg overflow-hidden shadow-xl"
        />
      </ReactFlow>

      {/* Legend strip */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 text-xs font-mono bg-[#0c1017]/90 backdrop-blur px-3.5 py-2 rounded-lg border border-[#1f2738]">
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Resource
        </span>
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Operation
        </span>
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Identifier
        </span>
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> BOLA Leak
        </span>
      </div>
    </div>
  );
};
