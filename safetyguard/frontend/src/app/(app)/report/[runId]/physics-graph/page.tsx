'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Orbit, Play, Pause, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Network, type Options } from 'vis-network/standalone';

import { useRun } from '@/hooks/useRun';
import { useReport } from '@/hooks/useReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PhysicsGraphPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;

  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [layoutSeed, setLayoutSeed] = useState(11);
  const [nodeScale, setNodeScale] = useState<'m' | 'l' | 'xl'>('l');
  const [spacing, setSpacing] = useState<'normal' | 'wide' | 'ultra'>('wide');
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);

  const { data: run, isLoading: runLoading, error: runError } = useRun(runId);
  const isCompleted = run?.status === 'completed';

  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
  } = useReport(isCompleted ? runId : undefined);

  const graph = report?.code_graph;

  const visData = useMemo(() => {
    const sizeBase = nodeScale === 'm' ? 12 : nodeScale === 'l' ? 16 : 20;
    const nodes = (graph?.nodes ?? []).map((n) => ({
      id: n.id,
      label: n.label,
      title: n.id,
      group: n.type === 'external' ? 'external' : (n.language || 'file'),
      shape: n.type === 'external' ? 'diamond' : 'dot',
      size: n.type === 'external' ? Math.round(sizeBase * 0.9) : sizeBase,
      font: { color: '#dce7f1', size: Math.round(sizeBase * 0.62) },
      color:
        n.type === 'external'
          ? { background: '#f59e0b', border: '#fde68a' }
          : { background: '#06b6d4', border: '#67e8f9' },
    }));

    const edges = (graph?.edges ?? []).map((e, i) => ({
      id: e.id ?? `e-${i}-${e.source}-${e.target}`,
      from: e.source,
      to: e.target,
      label: showEdgeLabels ? (e.relation || 'imports') : '',
      arrows: 'to',
      color: { color: 'rgba(148,163,184,0.30)', highlight: '#a78bfa' },
      width: 0.7,
      smooth: { enabled: true, type: 'continuous' as const, roundness: 0.2 },
      font: { color: '#94a3b8', size: 10, align: 'middle' as const },
    }));

    return { nodes, edges };
  }, [graph, nodeScale, showEdgeLabels]);

  const options = useMemo<Options>(
    () => ({
      autoResize: true,
      layout: {
        randomSeed: layoutSeed,
        improvedLayout: true,
      },
      interaction: {
        hover: true,
        multiselect: true,
        tooltipDelay: 120,
        dragNodes: true,
        hoverConnectedEdges: false,
      },
      physics: {
        enabled: physicsEnabled,
        solver: 'forceAtlas2Based',
        stabilization: {
          enabled: true,
          iterations: 1200,
          fit: true,
          updateInterval: 50,
        },
        forceAtlas2Based: {
          gravitationalConstant: spacing === 'normal' ? -90 : spacing === 'wide' ? -140 : -190,
          centralGravity: 0.01,
          springLength: spacing === 'normal' ? 130 : spacing === 'wide' ? 180 : 240,
          springConstant: 0.035,
          damping: 0.5,
          avoidOverlap: 0.8,
        },
      },
      nodes: {
        borderWidth: 1.2,
        borderWidthSelected: 3,
        scaling: {
          min: 10,
          max: 36,
        },
      },
      edges: {
        selectionWidth: 2.3,
      },
      groups: {
        external: {
          shape: 'diamond',
          color: { background: '#f59e0b', border: '#fde68a' },
        },
      },
    }),
    [layoutSeed, physicsEnabled, spacing],
  );

  useEffect(() => {
    if (!containerRef.current || !visData.nodes.length) return;

    const network = new Network(containerRef.current, visData, options);
    networkRef.current = network;

    network.on('selectNode', (params) => {
      const id = params.nodes[0];
      setSelectedNode(id ? String(id) : null);
    });

    network.on('deselectNode', () => {
      setSelectedNode(null);
    });

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [options, visData]);

  if (runLoading || reportLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (runError) {
    return (
      <div className="p-8 text-sm text-red-400">Failed to load run: {String((runError as Error)?.message || runError)}</div>
    );
  }

  if (reportError) {
    return (
      <div className="p-8 text-sm text-red-400">Failed to load report: {String((reportError as Error)?.message || reportError)}</div>
    );
  }

  if (!run) {
    return <div className="p-8 text-sm text-muted-foreground">Run not found.</div>;
  }

  if (run.status !== 'completed') {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Physics Graph Not Ready</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>This run is currently <span className="font-semibold text-foreground">{run.status}</span>. Complete analysis first.</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/report/${runId}?tab=codemap`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Report
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!graph?.nodes?.length) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>No Code Graph Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>This report has no code graph payload. Re-run analysis with indexing enabled.</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/report/${runId}?tab=codemap`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Report
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/report/${runId}?tab=codemap`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Report
          </Link>
        </Button>
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
          <Orbit className="h-3.5 w-3.5" />
          vis-network physics mode
        </div>
        <Button
          variant={physicsEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setPhysicsEnabled((v) => !v);
          }}
          className="gap-2"
        >
          {physicsEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {physicsEnabled ? 'Pause physics' : 'Resume physics'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLayoutSeed((s) => s + 1)}
          className="gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Re-layout
        </Button>
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-2 py-1 text-xs text-muted-foreground">
          <span>Node size</span>
          <select
            value={nodeScale}
            onChange={(e) => setNodeScale(e.target.value as 'm' | 'l' | 'xl')}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="m">M</option>
            <option value="l">L</option>
            <option value="xl">XL</option>
          </select>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-2 py-1 text-xs text-muted-foreground">
          <span>Spacing</span>
          <select
            value={spacing}
            onChange={(e) => setSpacing(e.target.value as 'normal' | 'wide' | 'ultra')}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="normal">normal</option>
            <option value="wide">wide</option>
            <option value="ultra">ultra</option>
          </select>
        </div>
        <Button
          variant={showEdgeLabels ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowEdgeLabels((v) => !v)}
          className="gap-2"
        >
          {showEdgeLabels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showEdgeLabels ? 'Edge Labels On' : 'Edge Labels Off'}
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          Nodes: {graph.nodes.length} · Edges: {graph.edges.length}
          {selectedNode ? ` · Selected: ${selectedNode}` : ''}
        </div>
      </div>

      <div className="h-[calc(100vh-12rem)] min-h-[620px] w-full overflow-hidden rounded-xl border border-border bg-[#0b1220]">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
