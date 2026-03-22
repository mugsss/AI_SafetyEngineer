'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import { FileCode2, Loader2, Network, Package, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { reportsApi } from '@/lib/api';
import type { CodeGraph, CodeGraphNode } from '@/types/report';

const MAX_DISPLAY_NODES = 500;

const nodeWidth = 200;
const nodeHeight = 44;

function buildDagreLayout(
  nodes: CodeGraphNode[],
  edges: CodeGraph['edges'],
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 36,
    ranksep: 72,
    marginx: 24,
    marginy: 24,
  });

  const idSet = new Set(nodes.map((n) => n.id));
  nodes.forEach((n) => {
    g.setNode(n.id, { width: nodeWidth, height: nodeHeight });
  });
  edges.forEach((e) => {
    if (idSet.has(e.source) && idSet.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  });
  dagre.layout(g);

  const flowNodes: Node[] = nodes.map((n) => {
    const pos = g.node(n.id);
    const x = (pos?.x ?? 0) - nodeWidth / 2;
    const y = (pos?.y ?? 0) - nodeHeight / 2;
    return {
      id: n.id,
      position: { x, y },
      data: { label: n.label, nodeType: n.type, language: n.language ?? '' },
      type: 'codeNode',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const flowEdges: Edge[] = edges
    .filter((e) => idSet.has(e.source) && idSet.has(e.target))
    .map((e, i) => ({
      id: e.id ?? `e-${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.relation,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { stroke: 'hsl(var(--muted-foreground) / 0.5)', strokeWidth: 1.2 },
      labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 10 },
    }));

  return { flowNodes, flowEdges };
}

function CodeNode({ data, selected }: NodeProps) {
  const isFile = (data as { nodeType?: string }).nodeType === 'file';
  const Icon = isFile ? FileCode2 : Package;
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-primary !h-2 !w-2" />
      <div
        className={cn(
          'flex max-w-[200px] items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm',
          isFile
            ? 'border-cyan-500/40 bg-cyan-500/10 text-foreground'
            : 'border-dashed border-amber-500/40 bg-amber-500/5 text-muted-foreground',
          selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span className="truncate" title={String((data as { label?: string }).label ?? '')}>
          {(data as { label?: string }).label}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !h-2 !w-2" />
    </>
  );
}

const nodeTypes = { codeNode: CodeNode };

interface CodeGraphViewProps {
  runId: string;
  graph: CodeGraph | null | undefined;
  codeIndexStatus?: string | null;
  codeIndexError?: string | null;
}

export function CodeGraphView({
  runId,
  graph,
  codeIndexStatus,
  codeIndexError,
}: CodeGraphViewProps) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [edgeHighlight, setEdgeHighlight] = useState<Set<string>>(new Set());

  const subset = useMemo(() => {
    if (!graph?.nodes?.length) return { nodes: [] as CodeGraphNode[], edges: [] as CodeGraph['edges'], capped: false };
    let nodes = graph.nodes;
    let capped = false;
    if (nodes.length > MAX_DISPLAY_NODES) {
      nodes = nodes.slice(0, MAX_DISPLAY_NODES);
      capped = true;
    }
    const allowed = new Set(nodes.map((n) => n.id));
    const edges = (graph.edges ?? []).filter(
      (e) => allowed.has(e.source) && allowed.has(e.target),
    );
    return { nodes, edges, capped };
  }, [graph]);

  const { flowNodes: layoutedNodes, flowEdges: layoutedEdges } = useMemo(
    () => buildDagreLayout(subset.nodes, subset.edges),
    [subset.nodes, subset.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  useEffect(() => {
    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        style: {
          ...e.style,
          stroke:
            edgeHighlight.size && e.id && edgeHighlight.has(e.id)
              ? 'hsl(var(--primary))'
              : 'hsl(var(--muted-foreground) / 0.45)',
          strokeWidth: edgeHighlight.size && e.id && edgeHighlight.has(e.id) ? 2.2 : 1.2,
        },
      })),
    );
  }, [edgeHighlight, setEdges]);

  const runRetrieval = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      setEdgeHighlight(new Set());
      return;
    }
    setLoading(true);
    try {
      const r = await reportsApi.codeRetrieval(runId, {
        query: q,
        top_k: 8,
        hops: 2,
      });
      if (r.error) {
        setEdgeHighlight(new Set());
        return;
      }
      setEdgeHighlight(new Set((r.highlight_edge_ids ?? []).filter(Boolean) as string[]));
    } finally {
      setLoading(false);
    }
  }, [runId, search]);

  if (!graph?.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
        <Network className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No code graph for this run. It is built when analysis indexes the repository.
        </p>
        {codeIndexError && (
          <p className="mt-2 max-w-md text-xs text-red-400/90">{codeIndexError}</p>
        )}
        {codeIndexStatus && (
          <p className="mt-1 text-xs text-muted-foreground">Index status: {codeIndexStatus}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[480px] flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Semantic search (highlights expanded graph neighborhood)
          </label>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. where is authentication handled?"
              className="font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && runRetrieval()}
            />
            <Button type="button" onClick={runRetrieval} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-500/80" /> file
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full border border-dashed border-amber-500/80" />{' '}
            external
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" /> retrieval highlight
          </span>
        </div>
      </div>

      {subset.capped && (
        <p className="text-xs text-amber-500/90">
          Showing first {MAX_DISPLAY_NODES} nodes only — large repository truncated for display.
        </p>
      )}

      {graph.stats && (
        <p className="text-xs text-muted-foreground">
          Files indexed: {graph.stats.file_count ?? '—'} · Edges: {graph.stats.edge_count ?? '—'}
          {graph.stats.vector_index_ready ? ' · Vector index ready' : ' · Vector index unavailable'}
        </p>
      )}

      <div className="h-[560px] w-full overflow-hidden rounded-lg border border-border bg-background/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.08}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          onlyRenderVisibleElements
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap
            zoomable
            pannable
            className="!bg-card/90"
            maskColor="hsl(var(--background) / 0.65)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
