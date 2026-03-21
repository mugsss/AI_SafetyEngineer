'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Network } from 'lucide-react';
import { runsApi, reportsApi } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DependencyGraphView } from '@/components/simulator/DependencyGraph';
import { SimulationPanel } from '@/components/simulator/SimulationPanel';
import type { GraphNode } from '@/types/report';
import type { SimulationResult } from '@/types/api';

export default function SimulatorPage() {
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [impactedNodeIds, setImpactedNodeIds] = useState<string[]>([]);

  const { data: runListData, isLoading: runsLoading } = useQuery({
    queryKey: ['runs', 'all'],
    queryFn: () => runsApi.list(1, 100),
  });

  const completedRuns = useMemo(
    () => (runListData?.runs ?? []).filter((r) => r.status === 'completed'),
    [runListData],
  );

  const { data: graph, isLoading: graphLoading } = useQuery({
    queryKey: ['dependency-graph', selectedRunId],
    queryFn: () => reportsApi.getDependencyGraph(selectedRunId),
    enabled: !!selectedRunId,
  });

  const handleSimulationResult = (result: SimulationResult) => {
    setImpactedNodeIds(result.impacted_nodes);
  };

  const handleNodeSelect = (node: GraphNode | null) => {
    setSelectedNode(node);
    if (!node) setImpactedNodeIds([]);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Panel - Run Selector */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Failure Simulator</h2>
          </div>
          <Select value={selectedRunId} onValueChange={(v) => { setSelectedRunId(v); setSelectedNode(null); setImpactedNodeIds([]); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a run..." />
            </SelectTrigger>
            <SelectContent>
              {runsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : completedRuns.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No completed runs
                </div>
              ) : (
                completedRuns.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    <span className="truncate">{run.repo_url ? new URL(run.repo_url).pathname.slice(1) : run.id.slice(0, 8)}</span>
                    <span className="ml-1 text-muted-foreground">/ {run.branch}</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {graph && (
          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Components ({graph.nodes.length})
            </p>
            <div className="space-y-1">
              {graph.nodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    selectedNode?.id === node.id
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      node.riskLevel === 'high'
                        ? 'bg-red-400'
                        : node.riskLevel === 'medium'
                          ? 'bg-yellow-400'
                          : 'bg-green-400'
                    }`}
                  />
                  <span className="truncate">{node.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Panel - Graph */}
      <div className="relative flex-1">
        {!selectedRunId ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Network className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-lg font-medium">Select a completed run</p>
            <p className="mt-1 text-sm">Choose a run from the left panel to visualize its dependency graph</p>
          </div>
        ) : graphLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : graph ? (
          <DependencyGraphView
            graph={graph}
            impactedNodeIds={impactedNodeIds}
            selectedNodeId={selectedNode?.id ?? null}
            onNodeSelect={handleNodeSelect}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>Failed to load dependency graph</p>
          </div>
        )}
      </div>

      {/* Right Panel - Simulation */}
      {selectedNode && selectedRunId && (
        <SimulationPanel
          runId={selectedRunId}
          node={selectedNode}
          onClose={() => { setSelectedNode(null); setImpactedNodeIds([]); }}
          onSimulationResult={handleSimulationResult}
        />
      )}
    </div>
  );
}
