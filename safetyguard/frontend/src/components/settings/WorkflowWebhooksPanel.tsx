'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Webhook,
  FlaskConical,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { settingsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { WorkflowWebhook } from '@/types/api';
import { cn } from '@/lib/utils';

/** Base URL for opening n8n: env → Settings n8n_base_url → *.n8n.cloud webhook URLs. */
function resolveN8nAppOrigin(
  webhookUrls: string[],
  n8nBaseFromSettings?: string | null,
  serverEnvWebhookUrl?: string | null,
): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_N8N_APP_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      return fromEnv.replace(/\/$/, '');
    }
  }
  const fromSettings = (n8nBaseFromSettings || '').trim();
  if (fromSettings) {
    try {
      return new URL(fromSettings).origin;
    } catch {
      return fromSettings.replace(/\/$/, '');
    }
  }
  const combined = [
    ...(serverEnvWebhookUrl ? [serverEnvWebhookUrl] : []),
    ...webhookUrls,
  ];
  for (const raw of combined) {
    try {
      const u = new URL(raw);
      if (
        u.hostname.endsWith('app.n8n.cloud') ||
        u.hostname.endsWith('n8n.cloud') ||
        u.hostname.includes('n8n.io')
      ) {
        return u.origin;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function WorkflowWebhooksPanel() {
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState('n8n');
  const [newUrl, setNewUrl] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newEnabled, setNewEnabled] = useState(true);

  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    url: string;
    secret: string;
    enabled: boolean;
  } | null>(null);

  const [testMsg, setTestMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['workflow-webhooks'],
    queryFn: settingsApi.workflowWebhooks.list,
  });

  const { data: appSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const n8nOrigin = useMemo(
    () =>
      resolveN8nAppOrigin(
        items.map((w) => w.url),
        appSettings?.n8n_base_url,
        appSettings?.n8n_webhook_url_from_env,
      ),
    [items, appSettings?.n8n_base_url, appSettings?.n8n_webhook_url_from_env],
  );

  const createMut = useMutation({
    mutationFn: () =>
      settingsApi.workflowWebhooks.create({
        name: newName.trim() || 'n8n',
        url: newUrl.trim(),
        secret: newSecret.trim() || undefined,
        enabled: newEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-webhooks'] });
      setNewUrl('');
      setNewSecret('');
      setNewName('n8n');
      setNewEnabled(true);
    },
  });

  const updateMut = useMutation({
    mutationFn: (p: {
      id: string;
      body: { name?: string; url?: string; secret?: string; enabled?: boolean };
    }) => settingsApi.workflowWebhooks.update(p.id, p.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-webhooks'] });
      setEditForm(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => settingsApi.workflowWebhooks.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow-webhooks'] }),
  });

  const testMut = useMutation({
    mutationFn: (p: { id: string; url: string; secret?: string }) =>
      settingsApi.workflowWebhooks.test(p.url, p.secret),
    onSuccess: (data, vars) => {
      setTestMsg({
        id: vars.id,
        ok: data.success,
        text: data.message,
      });
    },
    onError: (e: Error, vars) => {
      setTestMsg({ id: vars.id, ok: false, text: e.message });
    },
  });

  const startEdit = (w: WorkflowWebhook) => {
    setEditForm({
      id: w.id,
      name: w.name,
      url: w.url,
      secret: '',
      enabled: w.enabled,
    });
  };

  const saveEdit = () => {
    if (!editForm) return;
    const body: { name?: string; url?: string; secret?: string; enabled?: boolean } = {
      name: editForm.name.trim() || 'Workflow',
      url: editForm.url.trim(),
      enabled: editForm.enabled,
    };
    if (editForm.secret.trim()) body.secret = editForm.secret.trim();
    updateMut.mutate({ id: editForm.id, body });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Workflow automation (n8n)</CardTitle>
          </div>
          {n8nOrigin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={n8nOrigin} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open n8n
                </a>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <a
                  href={`${n8nOrigin}/executions`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="If this 404s, open n8n and use the sidebar → Executions"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  View executions
                </a>
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          Add outbound URLs (e.g. n8n <strong>Webhook</strong> node). SafetyGuard POSTs JSON on{' '}
          <code className="rounded bg-muted px-1 text-xs">analysis.completed</code> and{' '}
          <code className="rounded bg-muted px-1 text-xs">analysis.failed</code>. Optional secret →{' '}
          <code className="rounded bg-muted px-1 text-xs">X-SafetyGuard-Signature</code>. Server env{' '}
          <code className="rounded bg-muted px-1 text-xs">N8N_WEBHOOK_URL</code> is still merged as a global fallback.
        </CardDescription>
        {!n8nOrigin && !isLoading && (
          <p className="text-xs text-muted-foreground">
            <strong>Open n8n</strong> / <strong>View executions</strong> appear here when you set{' '}
            <strong>n8n instance URL</strong> under <em>n8n Public API</em> (save settings), add{' '}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_N8N_APP_URL</code> in{' '}
            <code className="rounded bg-muted px-1">.env.local</code>, or save a webhook URL on{' '}
            <code className="rounded bg-muted px-1">*.n8n.cloud</code>.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((w) => (
              <li
                key={w.id}
                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-foreground">{w.name}</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">{w.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.has_secret ? 'Signing secret configured' : 'No signing secret'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">On</span>
                      <Switch
                        checked={w.enabled}
                        disabled={updateMut.isPending}
                        onCheckedChange={(checked) =>
                          updateMut.mutate({ id: w.id, body: { enabled: checked } })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testMut.isPending}
                      onClick={() => {
                        setTestMsg(null);
                        testMut.mutate({ id: w.id, url: w.url });
                      }}
                    >
                      <FlaskConical className="mr-1 h-3.5 w-3.5" />
                      Test
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(w)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (confirm('Delete this webhook?')) deleteMut.mutate(w.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {testMsg?.id === w.id && (
                  <p
                    className={cn(
                      'flex items-start gap-2 text-xs',
                      testMsg.ok ? 'text-green-400' : 'text-amber-400',
                    )}
                  >
                    {testMsg.ok ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="break-all">{testMsg.text}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {editForm && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Edit webhook</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Internal n8n"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>URL</Label>
                <Input
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>New secret (optional)</Label>
                <Input
                  type="password"
                  value={editForm.secret}
                  onChange={(e) => setEditForm({ ...editForm, secret: e.target.value })}
                  placeholder="Leave blank to keep current secret"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  checked={editForm.enabled}
                  onCheckedChange={(c) => setEditForm({ ...editForm, enabled: c })}
                />
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending || !editForm.url.trim()}>
                {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditForm(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!editForm && (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
            <p className="text-sm font-medium text-foreground">Add webhook</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Customer Slack flow"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Webhook URL</Label>
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="font-mono text-xs"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Secret (optional)</Label>
                <Input
                  type="password"
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  placeholder="HMAC signing secret"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch checked={newEnabled} onCheckedChange={setNewEnabled} />
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={createMut.isPending || !newUrl.trim()}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add webhook
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!newUrl.trim() || testMut.isPending}
                onClick={() => {
                  setTestMsg(null);
                  testMut.mutate({
                    id: 'new',
                    url: newUrl.trim(),
                    secret: newSecret.trim() || undefined,
                  });
                }}
              >
                <FlaskConical className="mr-2 h-4 w-4" />
                Test URL
              </Button>
            </div>
            {testMsg?.id === 'new' && (
              <p
                className={cn(
                  'text-xs flex items-center gap-2',
                  testMsg.ok ? 'text-green-400' : 'text-amber-400',
                )}
              >
                {testMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {testMsg.text}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
