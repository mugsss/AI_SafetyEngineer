import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    const runs = await sql`
      SELECT code_graph, code_index_status, code_index_error FROM analysis_runs 
      WHERE id = ${runId} LIMIT 1
    `;

    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    const run = runs[0];
    const codeGraph = run.code_graph || { nodes: [], edges: [], stats: {} };

    return NextResponse.json({
      nodes: codeGraph.nodes || [],
      edges: codeGraph.edges || [],
      stats: codeGraph.stats || {},
      code_index_status: run.code_index_status || null,
      code_index_error: run.code_index_error || null,
    });
  } catch (error) {
    console.error('Get code graph error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
