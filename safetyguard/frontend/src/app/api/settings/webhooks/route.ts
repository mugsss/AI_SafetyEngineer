import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth();
    
    const webhooks = await sql`
      SELECT * FROM workflow_webhooks 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(webhooks);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get webhooks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const now = new Date().toISOString();

    const {
      name,
      url,
      secret,
      events = ['run.completed'],
      is_active = true,
    } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'name and url are required' },
        { status: 400 }
      );
    }

    const webhookId = randomUUID();

    await sql`
      INSERT INTO workflow_webhooks (
        id, user_id, name, url, secret, events, is_active, created_at, updated_at
      )
      VALUES (
        ${webhookId}, ${user.id}, ${name}, ${url}, ${secret || null}, 
        ${events}, ${is_active}, ${now}, ${now}
      )
    `;

    const webhooks = await sql`SELECT * FROM workflow_webhooks WHERE id = ${webhookId}`;
    return NextResponse.json(webhooks[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
