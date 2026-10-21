import React, { useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ShieldAlert, ShieldCheck, Activity, Sparkles, Database, Key } from 'lucide-react';
import type { BackendNode, BackendEdge } from '../types';

interface GraphViewProps {
  backendNodes: BackendNode[];
  backendEdges: BackendEdge[];
  nodeStates: Record<string, 'idle' | 'probing' | 'vulnerable' | 'secure' | 'candidate'>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

// Custom Node for API Operations
const OperationNode = ({ data, selected }: any) => {
  const method = data.metadata?.method || 'GET';
  const path = data.metadata?.path || data.label;
  const status = data.status || 'idle';

  let borderColor = 'border-[#263043]';
  let bgColor = 'bg-[#10141e]';
  let statusBadge = null;

  if (status === 'probing') {
    borderColor = 'border-amber-400 animate-pulse';
    bgColor = 'bg-amber-950/30';
    statusBadge = (
      <span className="flex items-center gap-1 text-[9px] text-amber-300 font-bold px-1.5 py-0.5 rounded bg-amber-900/50">
        <Activity className="w-2.5 h-2.5 animate-spin" /> PROBING
      </span>
    );
  } else if (status === 'vulnerable') {
    borderColor = 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-bounce-subtle';
    bgColor = 'bg-rose-950/40';
    statusBadge = (
      <span className="flex items-center gap-1 text-[9px] text-rose-300 font-bold px-1.5 py-0.5 rounded bg-rose-900/60">
        <ShieldAlert className="w-2.5 h-2.5" /> BOLA LEAK
      </span>
    );
  } else if (status === 'secure') {
    borderColor = 'border-emerald-500';
    bgColor = 'bg-emerald-950/30';
    statusBadge = (
      <span className="flex items-center gap-1 text-[9px] text-emerald-300 font-bold px-1.5 py-0.5 rounded bg-emerald-900/50">
        <ShieldCheck className="w-2.5 h-2.5" /> SECURE
      </span>
    );
  } else if (status === 'candidate') {
    borderColor = 'border-cyan-400 border-dashed';
    bgColor = 'bg-cyan-950/20';
    statusBadge = (
      <span className="flex items-center gap-1 text-[9px] text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-900/50">
        <Sparkles className="w-2.5 h-2.5" /> CANDIDATE
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
      className={`px-3 py-2.5 rounded-lg border text-left shadow-lg transition-all duration-200 cursor-pointer min-w-[210px] ${bgColor} ${borderColor} ${
        selected ? 'ring-2 ring-emerald-400' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-slate-500 border border-slate-800" />
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${methodColors[method] || methodColors.GET}`}>
          {method}
        </span>
        {statusBadge}
      </div>
      <div className="text-xs font-semibold text-slate-200 font-mono truncate" title={path}>
        {path}
      </div>
      <div className="text-[10px] text-slate-500 truncate mt-0.5">
        {data.metadata?.operationId || data.id}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-slate-500 border border-slate-800" />
    </div>
  );
};

// Custom Node for Resource Collections
const ResourceNode = ({ data, selected }: any) => (
  <div
    className={`px-3.5 py-2 rounded-lg border border-emerald-500/40 bg-[#091a18] text-left shadow-md min-w-[150px] ${
      selected ? 'ring-2 ring-emerald-400' : ''
    }`}
  >
    <Handle type="target" position={Position.Left} className="w-2 h-2 bg-emerald-500" />
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 font-mono mb-0.5">
      <Database className="w-3 h-3" />
      RESOURCE TYPE
    </div>
    <div className="text-xs font-bold text-slate-100">{data.label}</div>
    <Handle type="source" position={Position.Right} className="w-2 h-2 bg-emerald-500" />
  </div>
);

// Custom Node for Identifiers
const IdentifierNode = ({ data, selected }: any) => (
  <div
    className={`px-3 py-1.5 rounded-md border border-amber-500/40 bg-[#16120b] text-left shadow-sm min-w-[130px] ${
      selected ? 'ring-2 ring-amber-400' : ''
    }`}
  >
    <Handle type="target" position={Position.Left} className="w-2 h-2 bg-amber-500" />
    <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-400 font-mono mb-0.5">
      <Key className="w-2.5 h-2.5" />
      IDENTIFIER
    </div>
    <div className="text-xs font-mono font-medium text-amber-200">{data.label}</div>
    <Handle type="source" position={Position.Right} className="w-2 h-2 bg-amber-500" />
  </div>
);

const nodeTypes = {
  operationNode: OperationNode,
  resourceNode: ResourceNode,
  identifierNode: IdentifierNode,
};

export const GraphView: React.FC<GraphViewProps> = ({
  backendNodes,
  backendEdges,
  nodeStates,
  selectedNodeId,
  onSelectNode,
}) => {
  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 75 });
    g.setDefaultEdgeLabel(() => ({}));

    backendNodes.forEach((node) => {
      const isOp = node.type === 'operation';
      const width = isOp ? 220 : 150;
      const height = isOp ? 75 : 55;
      g.setNode(node.id, { width, height });
    });

    backendEdges.forEach((edge) => {
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
        position: { x: pos.x - 100, y: pos.y - 35 },
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
          strokeWidth: Math.max(1.5, edge.confidence * 2.8),
          strokeDasharray: isPropagated ? '5,5' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 15,
          height: 15,
        },
        label: edge.type.replace('_', ' ').toLowerCase(),
        labelStyle: { fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#0a0d14', fillOpacity: 0.8 },
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [backendNodes, backendEdges, nodeStates, selectedNodeId]);

  return (
    <div className="w-full h-full relative bg-[#090b10]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        fitView
        className="bg-[#090b10]"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1c2433" />
        <Controls className="!bg-[#111520] !border-[#202738] !fill-slate-300 [&>button]:!border-[#202738]" />
        <MiniMap
          nodeColor={(n) => {
            if (nodeStates[n.id] === 'vulnerable') return '#f43f5e';
            if (nodeStates[n.id] === 'secure') return '#10b981';
            if (nodeStates[n.id] === 'probing') return '#f59e0b';
            return '#1e293b';
          }}
          className="!bg-[#0c0f17] !border-[#202738] rounded-lg overflow-hidden"
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
