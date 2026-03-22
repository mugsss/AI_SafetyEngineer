'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  FileCode2,
  Filter,
  Focus,
  GitBranch,
  Loader2,
  Maximize2,
  Network,
  Package,
  ScanSearch,
  Search,
  Sparkles,
} from 'lucide-react';
import cytoscape, { type Core } from 'cytoscape';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { reportsApi } from '@/lib/api';
import type { CodeGraph, CodeGraphNode } from '@/types/report';

const MAX_DISPLAY_NODES = 500;

function groupKeyForPath(path: string): string {
  const p = (path || '').trim();
  if (!p || p.startsWith('external:')) return 'external';
  const slash = p.indexOf('/');
  return slash === -1 ? 'root' : p.slice(0, slash);
}

function colorForGroup(group: string): { bg: string; border: string } {
  if (group === 'external') {
    return { bg: '#f59e0b', border: '#fde68a' };
  }
  let h = 0;
  for (let i = 0; i < group.length; i += 1) {
    h = (h * 31 + group.charCodeAt(i)) % 360;
  }
  return {
    bg: `hsl(${h} 76% 42%)`,
    border: `hsl(${h} 88% 70%)`,
  };
}

function expandByHops(seed: Set<string>, edges: CodeGraph['edges'], hops: number): Set<string> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const out = new Set(seed);
  let frontier = new Set(seed);
  for (let i = 0; i < Math.max(0, hops); i += 1) {
    const next = new Set<string>();
    frontier.forEach((node) => {
      (adj.get(node) ?? new Set()).forEach((nb) => {
        if (!out.has(nb)) {
          out.add(nb);
          next.add(nb);
        }
      });
    });
    frontier = next;
    if (!frontier.size) break;
  }
  return out;
}
const CY_STYLE = [
  {
    selector: 'node',
    style: {
      label: '',
      'font-size': 11,
      color: '#e6eef7',
      'text-wrap': 'wrap',
      'text-max-width': 160,
      width: 24,
      height: 24,
      'background-color': 'data(bg)',
      'border-width': 1.5,
      'border-color': 'data(border)',
      'text-valign': 'bottom',
      'text-margin-y': 10,
      'overlay-opacity': 0,
    },
  },
  {
    selector: '.all-node-labels',
    style: {
      label: 'data(label)',
    },
  },
  {
    selector: 'node[type = "external"]',
    style: {
      'background-color': '#f59e0b',
      'border-color': '#fde68a',
      shape: 'diamond',
      opacity: 0.8,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 0.9,
      'line-color': 'rgba(148,163,184,0.34)',
      'target-arrow-color': 'rgba(148,163,184,0.36)',
      'target-arrow-shape': 'none',
      'curve-style': 'bezier',
      opacity: 0.45,
    },
  },
  {
    selector: 'edge[label]',
    style: {
      label: 'data(label)',
      'font-size': 8,
      color: '#94a3b8',
      'text-background-color': '#0b1220',
      'text-background-opacity': 0.85,
      'text-background-padding': 2,
      'text-rotation': 'autorotate',
    },
  },
  {
    selector: '.edge-labels-hidden',
    style: {
      label: '',
    },
  },
  {
    selector: '.selected',
    style: {
      'border-width': 3,
      'border-color': '#f8fafc',
      width: 34,
      height: 34,
      label: 'data(label)',
      'font-size': 13,
      'text-background-color': 'rgba(3,10,20,0.8)',
      'text-background-opacity': 1,
      'text-background-padding': 3,
      'z-index': 999,
    },
  },
  {
    selector: '.neighbor',
    style: {
      width: 28,
      height: 28,
      label: 'data(label)',
      'z-index': 700,
    },
  },
  {
    selector: '.retrieval-node',
    style: {
      'background-color': '#7c3aed',
      'border-color': '#c4b5fd',
      'border-width': 2,
      label: 'data(label)',
    },
  },
  {
    selector: '.selected-edge',
    style: {
      width: 2.2,
      'line-color': '#22d3ee',
      'target-arrow-color': '#22d3ee',
      opacity: 1,
    },
  },
  {
    selector: '.retrieval-edge',
    style: {
      width: 2.7,
      'line-color': '#8b5cf6',
      'target-arrow-color': '#8b5cf6',
      opacity: 1,
    },
  },
  {
    selector: '.hidden-by-focus',
    style: {
      display: 'none',
    },
  },
  {
    selector: '.hidden-by-filter',
    style: {
      display: 'none',
    },
  },
  {
    selector: '.soft-dim',
    style: {
      opacity: 0.22,
    },
  },
];

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [showExternal, setShowExternal] = useState(true);
  const [showNodeLabels, setShowNodeLabels] = useState(false);
  const [hideLeafNodes, setHideLeafNodes] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [layoutName, setLayoutName] = useState<'cose' | 'breadthfirst' | 'concentric'>('cose');
  const [layoutDensity, setLayoutDensity] = useState<'compact' | 'balanced' | 'spread'>('spread');
  const [relationFilter, setRelationFilter] = useState<string>('all');
  const [flowOnly, setFlowOnly] = useState(false);
  const [flowHops, setFlowHops] = useState(2);
  const [retrievalError, setRetrievalError] = useState<string | null>(null);
  const [retrievalNodes, setRetrievalNodes] = useState<Set<string>>(new Set());
  const [retrievalChunks, setRetrievalChunks] = useState<Array<Record<string, unknown>>>([]);
  const [edgeHighlight, setEdgeHighlight] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

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

  const nodeMap = useMemo(() => {
    const m = new Map<string, CodeGraphNode>();
    subset.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [subset.nodes]);

  const relationOptions = useMemo(() => {
    const set = new Set<string>();
    subset.edges.forEach((e) => {
      if (e.relation) set.add(e.relation);
    });
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [subset.edges]);

  const filteredEdges = useMemo(() => {
    if (relationFilter === 'all') return subset.edges;
    return subset.edges.filter((e) => (e.relation ?? '') === relationFilter);
  }, [subset.edges, relationFilter]);

  const localMatchNodeIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set<string>();
    const set = new Set<string>();
    for (const n of subset.nodes) {
      if (n.id.toLowerCase().includes(q) || (n.label || '').toLowerCase().includes(q)) {
        set.add(n.id);
      }
    }
    return set;
  }, [search, subset.nodes]);

  const flowSeedIds = useMemo(() => {
    if (retrievalNodes.size > 0) return retrievalNodes;
    return localMatchNodeIds;
  }, [localMatchNodeIds, retrievalNodes]);

  const flowExpandedIds = useMemo(
    () => expandByHops(flowSeedIds, filteredEdges, flowHops),
    [filteredEdges, flowHops, flowSeedIds],
  );

  const elements = useMemo(() => {
    const base = subset.nodes.map((n) => ({
      ...n,
      ...colorForGroup(groupKeyForPath(n.id)),
      groupKey: groupKeyForPath(n.id),
    })).map((enriched) => ({
      data: {
        id: enriched.id,
        label: enriched.label,
        fullId: enriched.id,
        type: enriched.type,
        language: enriched.language ?? '',
        groupKey: enriched.groupKey,
        bg: enriched.bg,
        border: enriched.border,
      },
    }));
    const edges = filteredEdges.map((e, i) => ({
      data: {
        id: e.id ?? `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: e.relation ?? 'imports',
      },
    }));
    return [...base, ...edges];
  }, [filteredEdges, subset.nodes]);

  const neighborIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const out = new Set<string>();
    filteredEdges.forEach((e) => {
      if (e.source === selectedNodeId) out.add(e.target);
      if (e.target === selectedNodeId) out.add(e.source);
    });
    return out;
  }, [filteredEdges, selectedNodeId]);

  const leafNodeIds = useMemo(() => {
    const degree = new Map<string, number>();
    subset.nodes.forEach((n) => degree.set(n.id, 0));
    filteredEdges.forEach((e) => {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    });
    const out = new Set<string>();
    subset.nodes.forEach((n) => {
      if ((degree.get(n.id) ?? 0) <= 1 && n.type === 'file') {
        out.add(n.id);
      }
    });
    return out;
  }, [filteredEdges, subset.nodes]);

  const visibleNodeIds = useMemo(() => {
    if (hideLeafNodes && !flowOnly && !selectedNodeId) {
      const keep = new Set(subset.nodes.map((n) => n.id));
      leafNodeIds.forEach((id) => keep.delete(id));
      if (keep.size > 0) return keep;
    }
    if (flowOnly && flowExpandedIds.size > 0) {
      return flowExpandedIds;
    }
    if (!focusMode || !selectedNodeId) {
      return new Set(subset.nodes.map((n) => n.id));
    }
    const keep = new Set<string>([selectedNodeId]);
    neighborIds.forEach((id) => keep.add(id));
    return keep;
  }, [
    flowOnly,
    flowExpandedIds,
    focusMode,
    hideLeafNodes,
    leafNodeIds,
    selectedNodeId,
    neighborIds,
    subset.nodes,
  ]);

  const visibleEdgeCount = useMemo(
    () =>
      filteredEdges.filter(
        (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
      ).length,
    [filteredEdges, visibleNodeIds],
  );

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null),
    [selectedNodeId, nodeMap],
  );

  const selectedInOut = useMemo(() => {
    if (!selectedNodeId) return { incoming: 0, outgoing: 0 };
    let incoming = 0;
    let outgoing = 0;
    filteredEdges.forEach((e) => {
      if (e.source === selectedNodeId) outgoing += 1;
      if (e.target === selectedNodeId) incoming += 1;
    });
    return { incoming, outgoing };
  }, [filteredEdges, selectedNodeId]);

  const fitToScreen = useCallback(() => {
    cyRef.current?.fit(undefined, 30);
  }, []);

  const runLayout = useCallback((cy: Core) => {
    const densityScale =
      layoutDensity === 'compact' ? 0.8 : layoutDensity === 'balanced' ? 1.15 : 1.55;

    const options =
      layoutName === 'cose'
        ? {
            name: 'cose' as const,
            animate: true,
            animationDuration: 380,
            fit: true,
            padding: Math.round(56 * densityScale),
            randomize: true,
            componentSpacing: Math.round(160 * densityScale),
            nodeRepulsion: () => Math.round(10000 * densityScale),
            nodeOverlap: 24,
            idealEdgeLength: () => Math.round(130 * densityScale),
            edgeElasticity: 70,
            gravity: 0.22,
            numIter: 1800,
            coolingFactor: 0.97,
            minTemp: 1.0,
          }
        : layoutName === 'breadthfirst'
          ? {
              name: 'breadthfirst' as const,
              animate: true,
              animationDuration: 320,
              fit: true,
              padding: Math.round(60 * densityScale),
              directed: true,
              avoidOverlap: true,
              spacingFactor: 1.28 * densityScale,
            }
          : {
              name: 'concentric' as const,
              animate: true,
              animationDuration: 320,
              fit: true,
              padding: Math.round(62 * densityScale),
              avoidOverlap: true,
              spacingFactor: 1.22 * densityScale,
              minNodeSpacing: Math.round(26 * densityScale),
            };

    cy.resize();
    cy.layout(options as any).run();
  }, [layoutDensity, layoutName]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.startBatch();
    cy
      .nodes()
      .removeClass('selected neighbor retrieval-node hidden-by-focus hidden-by-filter all-node-labels soft-dim');
    cy
      .edges()
      .removeClass('selected-edge retrieval-edge hidden-by-focus hidden-by-filter edge-labels-hidden soft-dim');

    if (showNodeLabels) {
      cy.nodes().addClass('all-node-labels');
    }

    if (!showEdgeLabels) {
      cy.edges().addClass('edge-labels-hidden');
    }

    if (!showExternal) {
      const externalNodes = cy.nodes('[type = "external"]');
      externalNodes.addClass('hidden-by-filter');
      externalNodes.connectedEdges().addClass('hidden-by-filter');
    }

    if (selectedNodeId) {
      const selected = cy.getElementById(selectedNodeId);
      selected.addClass('selected');
      const neighbors = selected.neighborhood('node');
      neighbors.addClass('neighbor');
      selected.connectedEdges().addClass('selected-edge');
    }

    const visibleNodeElements = cy.nodes().filter((n) => visibleNodeIds.has(n.id()));
    const visibleEdgeElements = cy
      .edges()
      .filter((e) => visibleNodeIds.has(e.source().id()) && visibleNodeIds.has(e.target().id()));

    cy.nodes().difference(visibleNodeElements).addClass('hidden-by-focus');
    cy.edges().difference(visibleEdgeElements).addClass('hidden-by-focus');

    if (selectedNodeId) {
      const selected = cy.getElementById(selectedNodeId);
      const neighborhood = selected.neighborhood();
      const keep = selected.union(neighborhood);
      cy.elements().difference(keep).addClass('soft-dim');
    }

    retrievalNodes.forEach((id) => {
      cy.getElementById(id).addClass('retrieval-node');
    });
    edgeHighlight.forEach((id) => {
      cy.getElementById(id).addClass('retrieval-edge');
    });

    cy.endBatch();
  }, [
    edgeHighlight,
    retrievalNodes,
    selectedNodeId,
    showNodeLabels,
    showEdgeLabels,
    showExternal,
    visibleNodeIds,
  ]);

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: CY_STYLE as any,
      minZoom: 0.1,
      maxZoom: 2.2,
      wheelSensitivity: 0.18,
      textureOnViewport: true,
      motionBlur: false,
    });

    cyRef.current = cy;

    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      setSelectedNodeId(id);
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNodeId(null);
        setFocusMode(false);
      }
    });

    return () => {
      cy.removeAllListeners();
      cy.destroy();
      if (cyRef.current === cy) cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.startBatch();
    cy.elements().remove();
    if (elements.length) {
      cy.add(elements as any);
    }
    cy.endBatch();

    if (!cy.nodes().length) return;
    runLayout(cy);
  }, [elements, runLayout]);

  useEffect(() => {
    if (selectedNodeId && !nodeMap.has(selectedNodeId)) {
      setSelectedNodeId(null);
      setFocusMode(false);
    }
  }, [nodeMap, selectedNodeId]);

  useEffect(() => {
    if (relationFilter !== 'all' && !relationOptions.includes(relationFilter)) {
      setRelationFilter('all');
    }
  }, [relationFilter, relationOptions]);

  const runRetrieval = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      setEdgeHighlight(new Set());
      setRetrievalNodes(new Set());
      setRetrievalChunks([]);
      setRetrievalError(null);
      setFlowOnly(false);
      return;
    }
    setLoading(true);
    setRetrievalError(null);
    try {
      const r = await reportsApi.codeRetrieval(runId, {
        query: q,
        top_k: 8,
        hops: 2,
      });
      if (r.error) {
        setEdgeHighlight(new Set());
        setRetrievalNodes(new Set());
        setRetrievalChunks([]);
        setRetrievalError(r.error);
        if (localMatchNodeIds.size > 0) {
          setFlowOnly(true);
          const first = Array.from(localMatchNodeIds)[0];
          setSelectedNodeId(first ?? null);
        }
        return;
      }
      const expanded = new Set((r.expanded_node_ids ?? []).filter(Boolean) as string[]);
      setEdgeHighlight(new Set((r.highlight_edge_ids ?? []).filter(Boolean) as string[]));
      setRetrievalNodes(expanded);
      setRetrievalChunks(Array.isArray(r.chunks) ? r.chunks : []);
      setFlowOnly(expanded.size > 0);
      const first = Array.from(expanded)[0];
      if (first) setSelectedNodeId(first);
    } finally {
      setLoading(false);
    }
  }, [localMatchNodeIds, runId, search]);

  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.fit(undefined, 30);
  }, [flowOnly, visibleNodeIds]);

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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch('');
                setEdgeHighlight(new Set());
                setRetrievalNodes(new Set());
                setRetrievalChunks([]);
                setRetrievalError(null);
                setFlowOnly(false);
              }}
            >
              Clear
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Relation</span>
          <select
            value={relationFilter}
            onChange={(e) => setRelationFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {relationOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground">
          <span>Layout</span>
          <select
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value as 'cose' | 'breadthfirst' | 'concentric')}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="cose">cose</option>
            <option value="breadthfirst">breadthfirst</option>
            <option value="concentric">concentric</option>
          </select>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground">
          <span>Density</span>
          <select
            value={layoutDensity}
            onChange={(e) => setLayoutDensity(e.target.value as 'compact' | 'balanced' | 'spread')}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="compact">compact</option>
            <option value="balanced">balanced</option>
            <option value="spread">spread</option>
          </select>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <span>Flow hops</span>
          <select
            value={String(flowHops)}
            onChange={(e) => setFlowHops(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>
        <Button
          type="button"
          variant={focusMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFocusMode((v) => !v)}
          disabled={!selectedNodeId}
          className="gap-2"
        >
          <Focus className="h-3.5 w-3.5" />
          {focusMode ? 'Exit Focus' : 'Focus Selected'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedNodeId(null);
            setFocusMode(false);
          }}
          disabled={!selectedNodeId}
        >
          Clear Selection
        </Button>
        <Button
          type="button"
          variant={flowOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFlowOnly((v) => !v)}
          className="gap-2"
          disabled={flowSeedIds.size === 0}
        >
          <GitBranch className="h-3.5 w-3.5" />
          {flowOnly ? 'Flow View' : 'Show Flow Only'}
        </Button>
        <Button
          type="button"
          variant={showNodeLabels ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowNodeLabels((v) => !v)}
          className="gap-2"
        >
          {showNodeLabels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showNodeLabels ? 'Node Labels On' : 'Node Labels Off'}
        </Button>
        <Button
          type="button"
          variant={hideLeafNodes ? 'default' : 'outline'}
          size="sm"
          onClick={() => setHideLeafNodes((v) => !v)}
          className="gap-2"
        >
          {hideLeafNodes ? 'Leaf Nodes Hidden' : 'Leaf Nodes Visible'}
        </Button>
        <Button
          type="button"
          variant={showEdgeLabels ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowEdgeLabels((v) => !v)}
          className="gap-2"
        >
          {showEdgeLabels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showEdgeLabels ? 'Labels On' : 'Labels Off'}
        </Button>
        <Button
          type="button"
          variant={showExternal ? 'outline' : 'default'}
          size="sm"
          onClick={() => setShowExternal((v) => !v)}
          className="gap-2"
        >
          <ScanSearch className="h-3.5 w-3.5" />
          {showExternal ? 'Hide External' : 'Show External'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const cy = cyRef.current;
            if (!cy) return;
            runLayout(cy);
            fitToScreen();
          }}
          className="gap-2"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Re-layout
        </Button>
      </div>

      {retrievalError && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Retrieval unavailable: {retrievalError}
        </p>
      )}

      {subset.capped && (
        <p className="text-xs text-amber-500/90">
          Showing first {MAX_DISPLAY_NODES} nodes only — large repository truncated for display.
        </p>
      )}

      {graph.stats && (
        <p className="text-xs text-muted-foreground">
          Files indexed: {graph.stats.file_count ?? '—'} · Edges: {graph.stats.edge_count ?? '—'}
          {' · Visible: '}
          {visibleNodeIds.size} nodes / {visibleEdgeCount} edges
          {graph.stats.vector_index_ready ? ' · Vector index ready' : ' · Vector index unavailable'}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[600px] w-full overflow-hidden rounded-lg border border-border bg-background/50">
          <div ref={containerRef} className="h-full w-full" />
        </div>

        <aside className="flex h-[600px] flex-col rounded-lg border border-border bg-card/40">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Node Inspector</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Click any node in the graph to inspect file metadata and connected neighbors.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!selectedNode ? (
              <p className="text-sm text-muted-foreground">No node selected.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Path</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">{selectedNode.id}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border bg-background/60 p-2.5">
                    <p className="text-muted-foreground">Type</p>
                    <p className="mt-1 font-medium text-foreground">{selectedNode.type}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/60 p-2.5">
                    <p className="text-muted-foreground">Language</p>
                    <p className="mt-1 font-medium text-foreground">{selectedNode.language || 'unknown'}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/60 p-2.5">
                    <p className="text-muted-foreground">Incoming</p>
                    <p className="mt-1 font-medium text-foreground">{selectedInOut.incoming}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/60 p-2.5">
                    <p className="text-muted-foreground">Outgoing</p>
                    <p className="mt-1 font-medium text-foreground">{selectedInOut.outgoing}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Connected Nodes ({neighborIds.size})
                  </p>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border bg-background/40 p-2">
                    {Array.from(neighborIds)
                      .slice(0, 120)
                      .map((id) => {
                        const n = nodeMap.get(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedNodeId(id)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                          >
                            {n?.type === 'external' ? (
                              <Package className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate" title={id}>{n?.label ?? id}</span>
                          </button>
                        );
                      })}
                    {neighborIds.size === 0 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">No neighbors with current filters.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Retrieval Context
                  </p>
                  <div className="space-y-2 rounded-md border border-border bg-background/40 p-2">
                    <p className="text-xs text-muted-foreground">
                      Expanded nodes: {retrievalNodes.size}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Matched chunks: {retrievalChunks.length}
                    </p>
                    {retrievalChunks.slice(0, 3).map((c, idx) => {
                      const file = String(c.file ?? 'unknown');
                      const start = String(c.start_line ?? '?');
                      const end = String(c.end_line ?? '?');
                      return (
                        <div key={`${file}-${start}-${idx}`} className="rounded border border-border/80 bg-background/70 p-2">
                          <p className="font-mono text-[11px] text-foreground">{file}:{start}-{end}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
