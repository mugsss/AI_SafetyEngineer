import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    const reports = await sql`
      SELECT * FROM safety_reports 
      WHERE run_id = ${runId}
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        created_at DESC
    `;

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const body = await request.json();
    
    const {
      category,
      severity,
      title,
      description,
      file_path,
      line_number,
      code_snippet,
      recommendation,
      metadata = {},
    } = body;

    if (!category || !severity || !title) {
      return NextResponse.json(
        { error: 'category, severity, and title are required' },
        { status: 400 }
      );
    }

    const reportId = randomUUID();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO safety_reports (
        id, run_id, category, severity, title, description,
        file_path, line_number, code_snippet, recommendation, metadata, created_at
      )
      VALUES (
        ${reportId}, ${runId}, ${category}, ${severity}, ${title}, ${description || null},
        ${file_path || null}, ${line_number || null}, ${code_snippet || null}, 
        ${recommendation || null}, ${JSON.stringify(metadata)}, ${now}
      )
    `;

    const reports = await sql`SELECT * FROM safety_reports WHERE id = ${reportId}`;
    return NextResponse.json(reports[0], { status: 201 });
  } catch (error) {
    console.error('Create report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
