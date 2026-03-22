import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    const runs = await sql`
      SELECT * FROM analysis_runs WHERE id = ${runId} LIMIT 1
    `;

    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(runs[0]);
  } catch (error) {
    console.error('Get run error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const body = await request.json();
    const now = new Date().toISOString();

    // Build dynamic update
    const updates: string[] = [];
    const values: unknown[] = [];
    
    if (body.status !== undefined) {
      updates.push('status');
      values.push(body.status);
    }
    if (body.summary !== undefined) {
      updates.push('summary');
      values.push(JSON.stringify(body.summary));
    }
    if (body.code_graph !== undefined) {
      updates.push('code_graph');
      values.push(JSON.stringify(body.code_graph));
    }
    if (body.error_message !== undefined) {
      updates.push('error_message');
      values.push(body.error_message);
    }
    if (body.completed_at !== undefined) {
      updates.push('completed_at');
      values.push(body.completed_at);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Use simple update for most common case
    await sql`
      UPDATE analysis_runs 
      SET 
        status = COALESCE(${body.status || null}, status),
        summary = COALESCE(${body.summary ? JSON.stringify(body.summary) : null}::jsonb, summary),
        code_graph = COALESCE(${body.code_graph ? JSON.stringify(body.code_graph) : null}::jsonb, code_graph),
        error_message = COALESCE(${body.error_message || null}, error_message),
        completed_at = COALESCE(${body.completed_at || null}, completed_at),
        updated_at = ${now}
      WHERE id = ${runId}
    `;

    const runs = await sql`SELECT * FROM analysis_runs WHERE id = ${runId}`;
    return NextResponse.json(runs[0]);
  } catch (error) {
    console.error('Update run error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    // Delete associated reports first
    await sql`DELETE FROM safety_reports WHERE run_id = ${runId}`;
    
    // Delete the run
    await sql`DELETE FROM analysis_runs WHERE id = ${runId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete run error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
