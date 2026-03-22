'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Settings,
  ExternalLink,
  LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';
import { settingsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { AppSettings } from '@/types/api';
import { WorkflowWebhooksPanel } from '@/components/settings/WorkflowWebhooksPanel';

function n8nOriginFromInput(saved?: string | null, draft?: string): string | null {
  const t = (draft || saved || '').trim();
  if (!t) return null;
  try {
    return new URL(t).origin;
  } catch {
    return t.replace(/\/$/, '');
  }
}

const settingsSchema = z.object({
  featherless_api_key: z.string().optional(),
  n8n_base_url: z.string().optional(),
  n8n_api_key: z.string().optional(),
  fail_ci_on_critical: z.boolean(),
  notification_email: z.string().email().optional().or(z.literal('')),
  slack_webhook_url: z.string().optional(),
  notify_on_completion: z.boolean(),
  notify_on_score_drop: z.boolean(),
  notify_on_critical: z.boolean(),
  score_threshold: z.number().min(0).max(100),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

type KeyTestStatus = 'idle' | 'testing' | 'success' | 'error';

interface ApiKeyRowProps {
  provider: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ApiKeyRow({ provider, label, value, onChange }: ApiKeyRowProps) {
  const [visible, setVisible] = useState(false);
  const [testStatus, setTestStatus] = useState<KeyTestStatus>('idle');
  const [testError, setTestError] = useState('');

  const handleTest = async () => {
    if (!value.trim()) return;
    setTestStatus('testing');
    setTestError('');
    try {
      const result = await settingsApi.testApiKey(provider, value);
      setTestStatus(result.valid ? 'success' : 'error');
      if (!result.valid && result.error) setTestError(result.error);
    } catch {
      setTestStatus('error');
      setTestError('Connection failed');
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => { onChange(e.target.value); setTestStatus('idle'); }}
            placeholder={`Enter ${label} key...`}
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!value.trim() || testStatus === 'testing'}
        >
          {testStatus === 'testing' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {testStatus === 'success' && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-400" />}
          {testStatus === 'error' && <XCircle className="mr-1.5 h-3.5 w-3.5 text-red-400" />}
          {testStatus === 'idle' && null}
          Test
        </Button>
      </div>
      {testStatus === 'success' && (
        <p className="text-xs text-green-400">Connection successful</p>
      )}
      {testStatus === 'error' && testError && (
        <p className="text-xs text-red-400">{testError}</p>
      )}
    </div>
  );
}

const ciSnippet = `- name: SafetyGuard Analysis
  uses: safetyguard/action@v1
  with:
    api_url: \${{ secrets.SAFETYGUARD_URL }}
    token: \${{ secrets.SAFETYGUARD_TOKEN }}
    fail_on_critical: true`;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [n8nTestStatus, setN8nTestStatus] = useState<KeyTestStatus>('idle');
  const [n8nTestError, setN8nTestError] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { isDirty } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      featherless_api_key: '',
      n8n_base_url: '',
      n8n_api_key: '',
      fail_ci_on_critical: true,
      notification_email: '',
      slack_webhook_url: '',
      notify_on_completion: true,
      notify_on_score_drop: false,
      notify_on_critical: true,
      score_threshold: 50,
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        featherless_api_key: settings.featherless_api_key ?? '',
        n8n_base_url: settings.n8n_base_url ?? '',
        n8n_api_key: '',
        fail_ci_on_critical: settings.fail_ci_on_critical,
        notification_email: settings.notification_email ?? '',
        slack_webhook_url: settings.slack_webhook_url ?? '',
        notify_on_completion: settings.notify_on_completion,
        notify_on_score_drop: settings.notify_on_score_drop,
        notify_on_critical: settings.notify_on_critical,
        score_threshold: settings.score_threshold,
      });
    }
  }, [settings, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AppSettings>) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    const payload: Partial<AppSettings> = { ...data };
    if (!payload.notification_email) delete payload.notification_email;
    if (settings?.n8n_api_key_set && !data.n8n_api_key?.trim()) {
      delete payload.n8n_api_key;
    }
    updateMutation.mutate(payload);
  };

  const handleN8nApiTest = async () => {
    const base = watch('n8n_base_url') ?? '';
    const key = watch('n8n_api_key') ?? '';
    setN8nTestStatus('testing');
    setN8nTestError('');
    try {
      const result = await settingsApi.testN8nApi({
        n8n_base_url: base.trim() || undefined,
        n8n_api_key: key.trim() || undefined,
      });
      setN8nTestStatus(result.success ? 'success' : 'error');
      if (!result.success) setN8nTestError(result.message);
    } catch (e) {
      setN8nTestStatus('error');
      setN8nTestError(e instanceof Error ? e.message : 'Request failed');
    }
  };

  const watchNotifyScoreDrop = watch('notify_on_score_drop');
  const watchFeatherless = watch('featherless_api_key') ?? '';
  const watchN8nBase = watch('n8n_base_url') ?? '';
  const n8nQuickOrigin = useMemo(
    () => n8nOriginFromInput(settings?.n8n_base_url, watchN8nBase),
    [settings?.n8n_base_url, watchN8nBase],
  );
  const watchFailCi = watch('fail_ci_on_critical');
  const watchNotifyCompletion = watch('notify_on_completion');
  const watchNotifyCritical = watch('notify_on_critical');

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API Keys</CardTitle>
            <CardDescription>
              Configure your Featherless AI API key for open-source model inference.{' '}
              <a href="https://featherless.ai/account/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">
                Get your key
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiKeyRow
              provider="featherless"
              label="Featherless AI"
              value={watchFeatherless}
              onChange={(v) => setValue('featherless_api_key', v, { shouldDirty: true })}
            />
          </CardContent>
        </Card>

        {/* Miro — action lives on Report page; token is server-side MIRO_ACCESS_TOKEN */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Miro</CardTitle>
            </div>
            <CardDescription>
              Boards are created from each run&apos;s <strong>Report</strong> page (top bar: <strong>View in Miro</strong>).
              The backend must have <code className="rounded bg-muted px-1 text-xs">MIRO_ACCESS_TOKEN</code> set in{' '}
              <code className="rounded bg-muted px-1 text-xs">.env</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/runs">
                Go to runs / open a report
              </Link>
            </Button>
            <Button type="button" variant="secondary" size="sm" asChild>
              <a href="https://miro.com/app/dashboard/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Miro dashboard
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* n8n Public API (REST) — separate from Webhook node URLs below */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">n8n Public API</CardTitle>
            <CardDescription>
              Use your <strong>instance URL</strong> (workspace root) and key from n8n{' '}
              <strong>Settings → n8n API</strong>. This verifies access via{' '}
              <code className="rounded bg-muted px-1 text-xs">GET /api/v1/workflows</code> — not the same as a
              Webhook URL used for run events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="n8n_base_url">n8n instance URL</Label>
              <Input
                id="n8n_base_url"
                {...register('n8n_base_url')}
                placeholder="https://yourname.app.n8n.cloud"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n8n_api_key">n8n API key</Label>
              <Input
                id="n8n_api_key"
                type="password"
                autoComplete="off"
                {...register('n8n_api_key')}
                placeholder={
                  settings?.n8n_api_key_set
                    ? 'Key saved — enter new to replace, or leave blank'
                    : 'Paste key from n8n (Settings → n8n API)'
                }
              />
              {settings?.n8n_api_key_set && (
                <p className="text-xs text-muted-foreground">A key is already stored on the server.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleN8nApiTest}
                disabled={n8nTestStatus === 'testing'}
              >
                {n8nTestStatus === 'testing' && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                {n8nTestStatus === 'success' && (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-400" />
                )}
                {n8nTestStatus === 'error' && (
                  <XCircle className="mr-1.5 h-3.5 w-3.5 text-red-400" />
                )}
                Test n8n API
              </Button>
              {n8nTestStatus === 'success' && (
                <span className="text-xs text-green-400">n8n API reachable</span>
              )}
            </div>
            {n8nTestStatus === 'error' && n8nTestError && (
              <p className="text-xs text-amber-400/90 whitespace-pre-wrap break-words">{n8nTestError}</p>
            )}
            {n8nQuickOrigin && (
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                <Button type="button" variant="secondary" size="sm" asChild>
                  <a href={n8nQuickOrigin} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open n8n
                  </a>
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a
                    href={`${n8nQuickOrigin}/executions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="If this 404s, use sidebar → Executions in n8n"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    View executions
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <WorkflowWebhooksPanel />

        {/* CI/CD Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CI/CD Integration</CardTitle>
            <CardDescription>GitHub Actions and pipeline behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="mb-2 block">GitHub Actions Snippet</Label>
              <pre className="overflow-x-auto rounded-lg bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground/80">
                {ciSnippet}
              </pre>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Fail CI on Critical findings</p>
                <p className="text-xs text-muted-foreground">Block the pipeline when critical issues are found</p>
              </div>
              <Switch
                checked={watchFailCi}
                onCheckedChange={(checked) => setValue('fail_ci_on_critical', checked, { shouldDirty: true })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
            <CardDescription>Configure alert channels and triggers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="notification_email">Email</Label>
              <Input
                id="notification_email"
                type="email"
                {...register('notification_email')}
                placeholder="alerts@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slack_webhook_url">Slack Webhook URL</Label>
              <Input
                id="slack_webhook_url"
                {...register('slack_webhook_url')}
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Notify on run completion</p>
                  <p className="text-xs text-muted-foreground">Get notified when an analysis run finishes</p>
                </div>
                <Switch
                  checked={watchNotifyCompletion}
                  onCheckedChange={(checked) => setValue('notify_on_completion', checked, { shouldDirty: true })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Notify when score drops below threshold</p>
                  <p className="text-xs text-muted-foreground">Alert when safety score falls below the configured value</p>
                </div>
                <Switch
                  checked={watchNotifyScoreDrop}
                  onCheckedChange={(checked) => setValue('notify_on_score_drop', checked, { shouldDirty: true })}
                />
              </div>

              {watchNotifyScoreDrop && (
                <div className="ml-4 space-y-2">
                  <Label htmlFor="score_threshold">Score Threshold (0-100)</Label>
                  <Input
                    id="score_threshold"
                    type="number"
                    min={0}
                    max={100}
                    {...register('score_threshold', { valueAsNumber: true })}
                    className="w-32"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Notify on new critical issue</p>
                  <p className="text-xs text-muted-foreground">Immediate alert for critical severity findings</p>
                </div>
                <Switch
                  checked={watchNotifyCritical}
                  onCheckedChange={(checked) => setValue('notify_on_critical', checked, { shouldDirty: true })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => { if (settings) reset(settings as SettingsFormData); }}
            disabled={!isDirty}
          >
            Reset
          </Button>
          <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>

        {updateMutation.isSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <p className="text-sm text-green-400">Settings saved successfully</p>
          </div>
        )}

        {updateMutation.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <XCircle className="h-4 w-4 text-red-400" />
            <p className="text-sm text-red-400">Failed to save settings. Please try again.</p>
          </div>
        )}
      </form>
    </div>
  );
}
