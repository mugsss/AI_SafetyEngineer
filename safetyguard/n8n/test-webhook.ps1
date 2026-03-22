# Send a sample payload to your n8n Webhook node (Production URL).
# Usage: .\test-webhook.ps1 -WebhookUrl "https://xxx.app.n8n.cloud/webhook/safetyguard-events"

param(
    [Parameter(Mandatory = $true)]
    [string] $WebhookUrl
)

$body = @{
    event = "manual.test"
    source = "safetyguard"
    run_id = "manual-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    status = "completed"
} | ConvertTo-Json -Compress

try {
    $r = Invoke-WebRequest -Uri $WebhookUrl -Method POST -Body $body -ContentType "application/json; charset=utf-8" -UseBasicParsing
    Write-Host "OK ($($r.StatusCode))" -ForegroundColor Green
    Write-Host $r.Content
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
    exit 1
}
