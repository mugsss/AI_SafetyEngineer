import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const user = await requireAuth();
    const { webhookId } = await params;
    const body = await request.json();
    const now = new Date().toISOString();

    const { name, url, secret, events, is_active } = body;

    await sql`
      UPDATE workflow_webhooks SET
        name = COALESCE(${name || null}, name),
        url = COALESCE(${url || null}, url),
        secret = COALESCE(${secret || null}, secret),
        events = COALESCE(${events || null}, events),
        is_active = COALESCE(${is_active ?? null}, is_active),
        updated_at = ${now}
      WHERE id = ${webhookId} AND user_id = ${user.id}
    `;

    const webhooks = await sql`SELECT * FROM workflow_webhooks WHERE id = ${webhookId}`;
    
    if (webhooks.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json(webhooks[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const user = await requireAuth();
    const { webhookId } = await params;

    await sql`
      DELETE FROM workflow_webhooks 
      WHERE id = ${webhookId} AND user_id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
