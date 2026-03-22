# n8n + SafetyGuard — run this workflow

You **cannot** run n8n from this repo automatically: n8n lives on **your** cloud or server. Follow these steps once, then every SafetyGuard analysis can trigger this workflow.

## 1) Import the workflow

1. Open your n8n instance (browser).
2. **Workflows** → **⋯** (menu) → **Import from File** (or paste JSON).
3. Select `safetyguard-inbound-workflow.json` from this folder.
4. **Save** the workflow.

## 2) Activate & copy the webhook URL

1. Open the imported workflow.
2. Click the **SafetyGuard Webhook** node.
3. **Production URL** is shown (e.g. `https://YOUR-INSTANCE/webhook/safetyguard-events` or with `/webhook-test/` in test mode).
4. Toggle the workflow **Active** (top-right).

> Path is fixed to **`safetyguard-events`** so the URL is predictable. If your n8n rewrites it on import, use whatever URL the Webhook node shows.

## 3) Connect SafetyGuard

1. Start SafetyGuard backend + frontend.
2. App → **Settings** → **Workflow automation (n8n)**.
3. **Add webhook** → paste the **Production** URL from step 2 → optional secret → **Add webhook**.
4. Use **Test URL** to send a test ping; in n8n go to **Executions** — you should see a run (event `workflow.test` if using Test from SafetyGuard).

## 4) See a real analysis event

1. Start a **new analysis run** in SafetyGuard and wait until it **completes** (or fails).
2. In n8n → **Executions** — open the latest run.
3. Open **Extract payload** → output shows `event` (`analysis.completed` / `analysis.failed`), `run_id`, scores, `links.report`, etc.

## 5) Manual test (without SafetyGuard)

Replace `YOUR_WEBHOOK_URL` with the Production URL from the Webhook node.

**PowerShell (Windows):**

```powershell
$uri = "YOUR_WEBHOOK_URL"
$body = '{"event":"manual.test","source":"safetyguard","run_id":"test-123","status":"completed"}'
Invoke-RestMethod -Uri $uri -Method POST -Body $body -ContentType "application/json; charset=utf-8"
```

**curl:**

```bash
curl -sS -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"event":"manual.test","source":"safetyguard","run_id":"test-123","status":"completed"}'
```

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| No executions | Workflow **Active**; URL is **Production**, not editor test URL |
| 404 on webhook | Path mismatch — copy URL from the Webhook node after import |
| SafetyGuard test OK, n8n empty | Firewall / n8n must be reachable from the machine running SafetyGuard |
| Public API test vs webhooks | **Settings → n8n Public API** tests REST `/api/v1/workflows`. **Webhooks** are separate (this file). |

## Extend the workflow

After **Extract payload**, add branches:

- **IF** `event` equals `analysis.failed` → notify on-call.
- **Slack** / **Email** / **Telegram** using fields from the payload.
- **HTTP Request** back to SafetyGuard API if you add API keys later.
