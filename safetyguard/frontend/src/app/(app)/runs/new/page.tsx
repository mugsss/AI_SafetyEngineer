'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Shield,
  AlertTriangle,
  Brain,
  Zap,
  DollarSign,
  Lock,
  Eye,
  Gauge,
  HardDrive,
  Swords,
  Upload,
  FileArchive,
  Check,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { runsApi, uploadsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { UploadResponse } from '@/types/api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const runSchema = z
  .object({
    targetType: z.enum(['git', 'zip']),
    repoUrl: z.string().optional(),
    branch: z.string().min(1, 'Branch is required'),
    uploadId: z.string().optional(),
    uploadFilename: z.string().optional(),
    uploadSize: z.number().optional(),
    enabledAgents: z.record(z.boolean()),
  })
  .refine(
    (d) => {
      if (d.targetType === 'git') return !!d.repoUrl?.trim();
      return !!d.uploadId;
    },
    { message: 'Provide a repository URL or upload a ZIP file', path: ['repoUrl'] },
  )
  .refine(
    (d) => Object.values(d.enabledAgents).some(Boolean),
    { message: 'Enable at least one agent', path: ['enabledAgents'] },
  );

type RunFormValues = z.infer<typeof runSchema>;

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

interface AgentDef {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const AGENTS: AgentDef[] = [
  { key: 'risk', label: 'Risk', description: 'Overall risk assessment', icon: AlertTriangle },
  { key: 'security', label: 'Security', description: 'Vulnerability scanning', icon: Shield },
  { key: 'hallucinations', label: 'Hallucinations', description: 'LLM hallucination detection', icon: Brain },
  { key: 'failures', label: 'Failures', description: 'Failure mode analysis', icon: Zap },
  { key: 'cost', label: 'Cost', description: 'Cost estimation & optimization', icon: DollarSign },
  { key: 'privacy', label: 'Privacy', description: 'PII & data leak scanning', icon: Lock },
  { key: 'observability', label: 'Observability', description: 'Logging & monitoring checks', icon: Eye },
  { key: 'performance', label: 'Performance', description: 'Latency & throughput analysis', icon: Gauge },
  { key: 'resources', label: 'Resources', description: 'Resource usage review', icon: HardDrive },
  { key: 'redteam', label: 'Red Team', description: 'Adversarial prompt testing', icon: Swords },
];

const QUICK_SCAN_AGENTS = ['risk', 'security', 'hallucinations'];

function defaultAgents(preset: 'none' | 'quick' | 'full'): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  AGENTS.forEach((a) => {
    if (preset === 'full') map[a.key] = true;
    else if (preset === 'quick') map[a.key] = QUICK_SCAN_AGENTS.includes(a.key);
    else map[a.key] = false;
  });
  return map;
}

// ---------------------------------------------------------------------------
// Step progress indicator
// ---------------------------------------------------------------------------

const STEPS = ['Target', 'Agents', 'Artifacts', 'Review'] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((label, idx) => {
        const isCompleted = idx < current;
        const isCurrent = idx === current;
        const isPending = idx > current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-primary/20 text-primary',
                  isPending && 'border-muted-foreground/30 text-muted-foreground',
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-xs font-medium',
                  isCurrent ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-[2px] w-12 rounded-full',
                  idx < current ? 'bg-primary' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewRunPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const form = useForm<RunFormValues>({
    resolver: zodResolver(runSchema),
    defaultValues: {
      targetType: 'git',
      repoUrl: '',
      branch: 'main',
      uploadId: undefined,
      uploadFilename: undefined,
      uploadSize: undefined,
      enabledAgents: defaultAgents('full'),
    },
    mode: 'onChange',
  });

  const { watch, setValue, trigger, formState: { errors } } = form;
  const targetType = watch('targetType');
  const uploadId = watch('uploadId');
  const uploadFilename = watch('uploadFilename');
  const uploadSize = watch('uploadSize');
  const enabledAgents = watch('enabledAgents');
  const repoUrl = watch('repoUrl');
  const branch = watch('branch');

  // Upload handler
  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      try {
        const res: UploadResponse = await uploadsApi.uploadZip(file);
        setValue('uploadId', res.upload_id);
        setValue('uploadFilename', res.filename);
        setValue('uploadSize', res.size);
      } catch {
        setUploadError('Failed to upload file. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [setValue],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    maxFiles: 1,
  });

  // Create run mutation
  const createRun = useMutation({
    mutationFn: () =>
      runsApi.create({
        repo_url: targetType === 'git' ? repoUrl : undefined,
        upload_id: targetType === 'zip' ? uploadId : undefined,
        branch,
        enabled_agents: enabledAgents,
      }),
    onSuccess: (run) => {
      router.push(`/report/${run.id}`);
    },
  });

  // Navigation
  const canProceed = (s: number): boolean => {
    switch (s) {
      case 0:
        if (targetType === 'git') return !!repoUrl?.trim() && !!branch.trim();
        return !!uploadId;
      case 1:
        return Object.values(enabledAgents).some(Boolean);
      case 2:
        return true;
      default:
        return true;
    }
  };

  const next = async () => {
    if (step === 0) {
      const valid = await trigger(targetType === 'git' ? ['repoUrl', 'branch'] : ['uploadId']);
      if (!valid) return;
    }
    if (step === 1) {
      if (!Object.values(enabledAgents).some(Boolean)) return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = () => {
    createRun.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Analysis Run</h1>
        <p className="mt-1 text-muted-foreground">
          Configure and launch a safety analysis for your AI application.
        </p>
      </div>

      <StepIndicator current={step} />

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          {/* Step 0: Target */}
          {step === 0 && (
            <StepTarget
              targetType={targetType}
              repoUrl={repoUrl ?? ''}
              branch={branch}
              uploadId={uploadId}
              uploadFilename={uploadFilename}
              uploadSize={uploadSize}
              uploading={uploading}
              uploadError={uploadError}
              isDragActive={isDragActive}
              errors={errors}
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              onTargetTypeChange={(v) => setValue('targetType', v as 'git' | 'zip')}
              onRepoUrlChange={(v) => setValue('repoUrl', v)}
              onBranchChange={(v) => setValue('branch', v)}
            />
          )}

          {/* Step 1: Agents */}
          {step === 1 && (
            <StepAgents
              enabledAgents={enabledAgents}
              onToggle={(key) =>
                setValue('enabledAgents', {
                  ...enabledAgents,
                  [key]: !enabledAgents[key],
                })
              }
              onPreset={(preset) =>
                setValue('enabledAgents', defaultAgents(preset))
              }
            />
          )}

          {/* Step 2: Artifacts */}
          {step === 2 && <StepArtifacts />}

          {/* Step 3: Review */}
          {step === 3 && (
            <StepReview
              targetType={targetType}
              repoUrl={repoUrl}
              branch={branch}
              uploadFilename={uploadFilename}
              enabledAgents={enabledAgents}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {step > 0 && (
            <Button variant="outline" onClick={back} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        <div>
          {step < 3 ? (
            <Button
              onClick={next}
              disabled={!canProceed(step)}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createRun.isPending}
              className="gap-2"
            >
              {createRun.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Start Analysis'
              )}
            </Button>
          )}
        </div>
      </div>

      {createRun.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to create run. Please try again.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Target
// ---------------------------------------------------------------------------

interface StepTargetProps {
  targetType: string;
  repoUrl: string;
  branch: string;
  uploadId?: string;
  uploadFilename?: string;
  uploadSize?: number;
  uploading: boolean;
  uploadError: string | null;
  isDragActive: boolean;
  errors: Record<string, any>;
  getRootProps: () => Record<string, any>;
  getInputProps: () => Record<string, any>;
  onTargetTypeChange: (v: string) => void;
  onRepoUrlChange: (v: string) => void;
  onBranchChange: (v: string) => void;
}

function StepTarget({
  targetType,
  repoUrl,
  branch,
  uploadId,
  uploadFilename,
  uploadSize,
  uploading,
  uploadError,
  isDragActive,
  errors,
  getRootProps,
  getInputProps,
  onTargetTypeChange,
  onRepoUrlChange,
  onBranchChange,
}: StepTargetProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Select Target
        </h3>
        <p className="text-sm text-muted-foreground">
          Point to a Git repository or upload a ZIP archive of your project.
        </p>
      </div>

      <Tabs
        value={targetType}
        onValueChange={onTargetTypeChange}
      >
        <TabsList className="w-full">
          <TabsTrigger value="git" className="flex-1">
            Git Repository
          </TabsTrigger>
          <TabsTrigger value="zip" className="flex-1">
            Upload ZIP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="git" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-url">Repository URL</Label>
            <Input
              id="repo-url"
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={(e) => onRepoUrlChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch">Branch</Label>
            <Input
              id="branch"
              placeholder="main"
              value={branch}
              onChange={(e) => onBranchChange(e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="zip" className="mt-4 space-y-4">
          {!uploadId ? (
            <div
              {...getRootProps()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-primary/50',
              )}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {uploading
                  ? 'Uploading...'
                  : isDragActive
                    ? 'Drop the ZIP file here'
                    : 'Drop ZIP file here or click to browse'}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-4">
              <FileArchive className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {uploadFilename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {uploadSize ? `${(uploadSize / 1024).toFixed(1)} KB` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => {
                  // Reset does not need form's setValue here; handled by parent
                }}
              >
                Change
              </Button>
            </div>
          )}
          {uploadError && (
            <p className="text-sm text-red-400">{uploadError}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="branch-zip">Branch label</Label>
            <Input
              id="branch-zip"
              placeholder="main"
              value={branch}
              onChange={(e) => onBranchChange(e.target.value)}
            />
          </div>
        </TabsContent>
      </Tabs>

      {errors.repoUrl?.message && (
        <p className="text-sm text-red-400">
          {errors.repoUrl.message as string}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Agents
// ---------------------------------------------------------------------------

interface StepAgentsProps {
  enabledAgents: Record<string, boolean>;
  onToggle: (key: string) => void;
  onPreset: (preset: 'quick' | 'full') => void;
}

function StepAgents({ enabledAgents, onToggle, onPreset }: StepAgentsProps) {
  const anyEnabled = Object.values(enabledAgents).some(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Select Agents
        </h3>
        <p className="text-sm text-muted-foreground">
          Choose which safety dimensions to analyze.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPreset('quick')}
        >
          Quick Scan
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPreset('full')}
        >
          Full Audit
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const enabled = !!enabledAgents[agent.key];
          return (
            <div
              key={agent.key}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                enabled
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card',
              )}
            >
              <div className="rounded-lg bg-secondary p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {agent.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {agent.description}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={() => onToggle(agent.key)}
              />
            </div>
          );
        })}
      </div>

      {!anyEnabled && (
        <p className="text-sm text-red-400">
          Enable at least one agent to continue.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Artifacts (optional)
// ---------------------------------------------------------------------------

function StepArtifacts() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Artifacts
        </h3>
        <p className="text-sm text-muted-foreground">
          This step is optional. Provide additional context to improve analysis
          accuracy.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="log-file">Log File</Label>
          <Input id="log-file" type="file" accept=".log,.txt,.json" />
          <p className="text-xs text-muted-foreground">
            Application logs for failure analysis (optional).
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="openapi-spec">OpenAPI Spec</Label>
          <Input id="openapi-spec" type="file" accept=".json,.yaml,.yml" />
          <p className="text-xs text-muted-foreground">
            OpenAPI / Swagger specification for API scanning (optional).
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="test-prompts">Test Prompt Set</Label>
          <Input id="test-prompts" type="file" accept=".json,.jsonl,.csv" />
          <p className="text-xs text-muted-foreground">
            A set of test prompts for hallucination and red-team testing (optional).
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review
// ---------------------------------------------------------------------------

interface StepReviewProps {
  targetType: string;
  repoUrl?: string;
  branch: string;
  uploadFilename?: string;
  enabledAgents: Record<string, boolean>;
}

function StepReview({
  targetType,
  repoUrl,
  branch,
  uploadFilename,
  enabledAgents,
}: StepReviewProps) {
  const activeAgents = AGENTS.filter((a) => enabledAgents[a.key]);
  const hasRedteam = !!enabledAgents['redteam'];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Review &amp; Launch
        </h3>
        <p className="text-sm text-muted-foreground">
          Verify your configuration before starting the analysis.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            <span className="font-medium text-muted-foreground">Target</span>
            <span className="text-foreground">
              {targetType === 'git' ? repoUrl : uploadFilename ?? 'Uploaded ZIP'}
            </span>

            <span className="font-medium text-muted-foreground">Branch</span>
            <span className="text-foreground">{branch}</span>

            <span className="font-medium text-muted-foreground">Agents</span>
            <div className="flex flex-wrap gap-1.5">
              {activeAgents.map((a) => {
                const Icon = a.icon;
                return (
                  <span
                    key={a.key}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    <Icon className="h-3 w-3" />
                    {a.label}
                  </span>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasRedteam && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Red team testing may take longer than a standard analysis.
        </div>
      )}
    </div>
  );
}
