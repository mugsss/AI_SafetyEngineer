import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    const runs = await sql`
      SELECT dependency_graph FROM analysis_runs WHERE id = ${runId} LIMIT 1
    `;

    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    const dependencyGraph = runs[0].dependency_graph || {
      nodes: [],
      edges: [],
      metadata: { total_dependencies: 0, vulnerable_count: 0 }
    };

    return NextResponse.json(dependencyGraph);
  } catch (error) {
    console.error('Get dependency graph error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
