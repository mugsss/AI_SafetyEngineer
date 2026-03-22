import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let runs;
    if (user) {
      runs = await sql`
        SELECT * FROM analysis_runs 
        WHERE user_id = ${user.id} OR user_id IS NULL
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      runs = await sql`
        SELECT * FROM analysis_runs 
        WHERE user_id IS NULL
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return NextResponse.json(runs);
  } catch (error) {
    console.error('Get runs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    
    const {
      repo_url,
      upload_id,
      branch = 'main',
      config = {},
    } = body;

    if (!repo_url && !upload_id) {
      return NextResponse.json(
        { error: 'Either repo_url or upload_id is required' },
        { status: 400 }
      );
    }

    const runId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO analysis_runs (
        id, status, repo_url, upload_id, branch, config, 
        created_at, updated_at, user_id, started_at
      )
      VALUES (
        ${runId}, 'pending', ${repo_url || null}, ${upload_id || null}, 
        ${branch}, ${JSON.stringify(config)}, ${now}, ${now}, 
        ${user?.id || null}, ${now}
      )
    `;

    const runs = await sql`SELECT * FROM analysis_runs WHERE id = ${runId}`;
    
    return NextResponse.json(runs[0], { status: 201 });
  } catch (error) {
    console.error('Create run error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
