'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Brain, Server, Database, Layers, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DependencyGraph as DepGraph, GraphNode } from '@/types/report';

const typeConfig: Record<
  string,
  { bg: string; border: string; icon: React.ElementType }
> = {
  llm: { bg: 'bg-purple-500/20', border: 'border-purple-500', icon: Brain },
  api: { bg: 'bg-blue-500/20', border: 'border-blue-500', icon: Server },
  database: { bg: 'bg-green-500/20', border: 'border-green-500', icon: Database },
  queue: { bg: 'bg-orange-500/20', border: 'border-orange-500', icon: Layers },
  external: { bg: 'bg-gray-500/20', border: 'border-gray-500', icon: Globe },
};

const riskBorderColor: Record<string, string> = {
  low: 'border-green-500',
  medium: 'border-yellow-500',
  high: 'border-red-500',
};

interface CustomNodeData {
  label: string;
  type: string;
  riskLevel: string;
  impacted?: boolean;
  [key: string]: unknown;
}

function CustomNode({ data, selected }: NodeProps<Node<CustomNodeData>>) {
  const cfg = typeConfig[data.type] ?? typeConfig.external;
  const Icon = cfg.icon;
  const isImpacted = data.impacted === true;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium text-foreground transition-shadow',
          cfg.bg,
          riskBorderColor[data.riskLevel] ?? cfg.border,
          selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          isImpacted && 'shadow-[0_0_16px_rgba(239,68,68,0.5)]',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{data.label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </>
  );
}

const nodeTypes = { custom: CustomNode };

interface DependencyGraphProps {
  graph: DepGraph;
  impactedNodeIds: string[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GraphNode | null) => void;
}

function layoutNodes(graphNodes: DepGraph['nodes']): Node<CustomNodeData>[] {
  const cols = Math.max(Math.ceil(Math.sqrt(graphNodes.length)), 1);
  return graphNodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 120 },
    data: {
      label: n.label,
      type: n.type,
      riskLevel: n.riskLevel,
      impacted: false,
    },
    type: 'custom' as const,
  }));
}

export function DependencyGraphView({
  graph,
  impactedNodeIds,
  selectedNodeId,
  onNodeSelect,
}: DependencyGraphProps) {
  const nodes: Node<CustomNodeData>[] = useMemo(() => {
    const laid = layoutNodes(graph.nodes);
    return laid.map((n) => ({
      ...n,
      selected: n.id === selectedNodeId,
      data: { ...n.data, impacted: impactedNodeIds.includes(n.id) },
    }));
  }, [graph.nodes, impactedNodeIds, selectedNodeId]);

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e, idx) => ({
        id: `e-${e.source}-${e.target}-${idx}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { strokeDasharray: '5 5', stroke: 'hsl(217 91% 60%)' },
      })),
    [graph.edges],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<CustomNodeData>) => {
      const graphNode = graph.nodes.find((n) => n.id === node.id) ?? null;
      onNodeSelect(graphNode);
    },
    [graph.nodes, onNodeSelect],
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Controls className="!bg-card !border-border !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor={() => 'hsl(217 91% 60%)'}
          maskColor="rgba(0,0,0,0.4)"
        />
        <Background color="hsl(217 33% 20%)" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
