## SafetyGuard Master n8n Prompt

Copy this whole prompt into n8n AI builder (or any workflow generator) to create a robust automation workflow.

```text
You are an expert n8n architect. Build a production-ready workflow named "SafetyGuard Master Automation".

Primary objective:
Ingest SafetyGuard webhook events and automate logging, alerting, escalation, and reporting with safe fallbacks.

Webhook ingress:
- Trigger: Webhook node
- Method: POST
- Path: safetyguard-events
- Return HTTP 200 quickly (do not block sender on downstream systems)

Incoming payload may arrive as either:
- $json.body.<field> (common in n8n webhook)
- or $json.<field>

Fields to normalize:
- event
- run_id
- status
- source
- repo_url
- branch
- overall_score
- dimension_scores (object)
- executive_summary
- links.report
- error_message
- source_action

Build requirements:

1) Normalize
- Add a Set (or Code) node called "Normalize Payload"
- Normalize all fields above with fallback expressions:
  {{$json.body?.field ?? $json.field ?? null}}
- Include:
  payload_raw_json = JSON.stringify($json.body ?? $json)
  received_at = current timestamp (ISO)
- Set "Keep Only Set" to true.

2) Fast acknowledgement pattern
- Respond to webhook immediately with:
  { "ok": true, "accepted": true, "workflow": "SafetyGuard Master Automation" }
- Continue processing asynchronously after ack.

3) Routing by event
- Add Switch/IF routes for:
  - analysis.completed
  - analysis.failed
  - workflow.manual_triggered
  - default (unknown)

4) Persistence
- Primary: n8n Data Table "safetyguard_events"
- Fallback: Google Sheets (if Data Table unavailable)
- Persist for every event:
  timestamp, event, run_id, status, source, repo_url, branch, overall_score, report_link, error_message, payload_raw_json

5) Smart risk routing
- For completed events:
  - if overall_score < 40 => critical path
  - else if overall_score < 70 => warning path
  - else healthy path
- If dimension_scores exists, detect worst dimension and include in notification text.

6) Notifications
- Completed/healthy: concise Slack info message
- Completed/warning: Slack warning + optional email digest
- Completed/critical: urgent Slack + create Jira/Linear/GitHub issue
- Failed: urgent Slack with error_message + run_id + report_link
- Unknown event: log only

7) Security
- Optional signature check:
  Header: X-SafetyGuard-Signature (sha256=...)
  Secret from env var SAFETYGUARD_WEBHOOK_SECRET
- If signature invalid: log, mark as rejected, stop all side effects.

8) Reliability
- For all outbound integrations, apply retries (3 attempts, exponential backoff).
- Add a workflow-level error handling branch:
  - write to safetyguard_errors table
  - send Slack "automation pipeline error" summary with node name and execution URL

9) Outputs
- Final node "Execution Summary":
  run_id, event, branch_taken, severity_band, actions_executed, persisted=true/false

10) Deliverables
- Output exact node graph and node names.
- Output field mappings for each external node.
- Output required credentials list and where to add them.
- Include test payload examples for completed, failed, and manual_triggered events.

Constraints:
- Must run on n8n Cloud.
- If a credential is missing, branch to graceful fallback, do not crash whole workflow.
- Avoid placeholder IDs; require concrete table selection.
```

