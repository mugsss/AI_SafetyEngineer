'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Zap, AlertTriangle, Clock, X } from 'lucide-react';
import { simulatorApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { GraphNode } from '@/types/report';
import type { SimulateInput, SimulationResult } from '@/types/api';

type FailureType = SimulateInput['failure_type'];

const failureTypes: { value: FailureType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'full_outage', label: 'Full Outage', icon: X, description: 'Complete service failure' },
  { value: 'high_latency', label: 'High Latency', icon: Clock, description: 'Response times > 5s' },
  { value: 'partial_degradation', label: 'Partial Degradation', icon: AlertTriangle, description: 'Intermittent errors' },
];

const riskColors: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

const riskDotColors: Record<string, string> = {
  low: 'bg-green-400',
  medium: 'bg-yellow-400',
  high: 'bg-red-400',
};

const typeLabels: Record<string, string> = {
  llm: 'LLM',
  api: 'API',
  database: 'Database',
  queue: 'Queue',
  external: 'External',
};

interface SimulationPanelProps {
  runId: string;
  node: GraphNode;
  onClose: () => void;
  onSimulationResult: (result: SimulationResult) => void;
}

export function SimulationPanel({ runId, node, onClose, onSimulationResult }: SimulationPanelProps) {
  const [failureType, setFailureType] = useState<FailureType>('full_outage');

  const simulation = useMutation({
    mutationFn: (data: SimulateInput) => simulatorApi.simulate(data),
    onSuccess: (result) => {
      onSimulationResult(result);
    },
  });

  const handleSimulate = () => {
    simulation.mutate({ run_id: runId, node_id: node.id, failure_type: failureType });
  };

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Simulation</h3>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <h4 className="text-base font-semibold text-foreground">{node.label}</h4>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{typeLabels[node.type] ?? node.type}</Badge>
            <div className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', riskDotColors[node.riskLevel])} />
              <span className={cn('text-xs font-medium capitalize', riskColors[node.riskLevel])}>
                {node.riskLevel} risk
              </span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Failure Type</p>
          <div className="space-y-2">
            {failureTypes.map((ft) => {
              const Icon = ft.icon;
              const selected = failureType === ft.value;
              return (
                <button
                  key={ft.value}
                  onClick={() => setFailureType(ft.value)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
                  <div>
                    <p className="text-sm font-medium">{ft.label}</p>
                    <p className="text-xs text-muted-foreground">{ft.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleSimulate}
          disabled={simulation.isPending}
        >
          {simulation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          Simulate Failure
        </Button>

        {simulation.isError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">Simulation failed. Please try again.</p>
          </div>
        )}

        {simulation.data && (
          <>
            <Separator />
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Impacted Nodes</p>
                <div className="flex flex-wrap gap-1.5">
                  {simulation.data.impacted_nodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No downstream impact detected.</p>
                  ) : (
                    simulation.data.impacted_nodes.map((name) => (
                      <Badge key={name} variant="destructive" className="text-xs">
                        {name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Narrative</p>
                <p className="text-sm leading-relaxed text-foreground/80">{simulation.data.narrative}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Dimension Impacts</p>
                <div className="space-y-1.5">
                  {Object.entries(simulation.data.dimension_impacts).map(([dim, change]) => (
                    <div key={dim} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                      <span className="text-sm capitalize text-foreground">{dim}</span>
                      <span className={cn('text-sm font-semibold', change < 0 ? 'text-red-400' : 'text-green-400')}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
