import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const runId = body.run_id;

    // Get all active webhooks
    const webhooks = await sql`
      SELECT * FROM workflow_webhooks 
      WHERE is_active = true
    `;

    if (webhooks.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active webhooks configured',
      });
    }

    // Get run data if runId provided
    let runData = null;
    if (runId) {
      const runs = await sql`
        SELECT * FROM analysis_runs WHERE id = ${runId}
      `;
      runData = runs[0] || null;
    }

    // Trigger all webhooks
    const results = await Promise.allSettled(
      webhooks.map(async (webhook: any) => {
        const payload = {
          event: 'manual_trigger',
          timestamp: new Date().toISOString(),
          run: runData,
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (webhook.secret) {
          headers['X-Webhook-Secret'] = webhook.secret;
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        return { webhook: webhook.name, status: response.status };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: failed === 0,
      message: `Triggered ${successful} webhooks, ${failed} failed`,
    });
  } catch (error) {
    console.error('Webhook trigger error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to trigger webhooks' },
      { status: 500 }
    );
  }
}
