'use client';

import { useState, useEffect } from 'react';
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
  Copy,
  RefreshCw,
  Settings,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { AppSettings } from '@/types/api';

const settingsSchema = z.object({
  openai_api_key: z.string().optional(),
  anthropic_api_key: z.string().optional(),
  cohere_api_key: z.string().optional(),
  webhook_url: z.string().optional(),
  webhook_secret: z.string().optional(),
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
  const [copied, setCopied] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { isDirty } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      openai_api_key: '',
      anthropic_api_key: '',
      cohere_api_key: '',
      webhook_url: '',
      webhook_secret: '',
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
        openai_api_key: settings.openai_api_key ?? '',
        anthropic_api_key: settings.anthropic_api_key ?? '',
        cohere_api_key: settings.cohere_api_key ?? '',
        webhook_url: settings.webhook_url ?? '',
        webhook_secret: settings.webhook_secret ?? '',
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
    updateMutation.mutate(payload);
  };

  const watchNotifyScoreDrop = watch('notify_on_score_drop');
  const watchOpenai = watch('openai_api_key') ?? '';
  const watchAnthropic = watch('anthropic_api_key') ?? '';
  const watchCohere = watch('cohere_api_key') ?? '';
  const watchWebhookUrl = watch('webhook_url') ?? '';
  const watchFailCi = watch('fail_ci_on_critical');
  const watchNotifyCompletion = watch('notify_on_completion');
  const watchNotifyCritical = watch('notify_on_critical');

  const handleCopyWebhook = async () => {
    if (watchWebhookUrl) {
      await navigator.clipboard.writeText(watchWebhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
            <CardDescription>Configure your LLM provider API keys</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ApiKeyRow
              provider="openai"
              label="OpenAI"
              value={watchOpenai}
              onChange={(v) => setValue('openai_api_key', v, { shouldDirty: true })}
            />
            <ApiKeyRow
              provider="anthropic"
              label="Anthropic"
              value={watchAnthropic}
              onChange={(v) => setValue('anthropic_api_key', v, { shouldDirty: true })}
            />
            <ApiKeyRow
              provider="cohere"
              label="Cohere"
              value={watchCohere}
              onChange={(v) => setValue('cohere_api_key', v, { shouldDirty: true })}
            />
          </CardContent>
        </Card>

        {/* CI/CD Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CI/CD Integration</CardTitle>
            <CardDescription>Set up webhooks and GitHub Actions integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={watchWebhookUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button type="button" variant="outline" size="icon" onClick={handleCopyWebhook}>
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={watch('webhook_secret') ?? ''}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setValue('webhook_secret', crypto.randomUUID(), { shouldDirty: true })}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

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
