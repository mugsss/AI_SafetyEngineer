import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    // Get the run with its summary data
    const runs = await sql`
      SELECT * FROM analysis_runs WHERE id = ${runId} LIMIT 1
    `;

    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    const run = runs[0];

    // Get associated safety reports
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

    // Build findings by category
    const findingsByCategory: Record<string, {
      findings: typeof reports;
      finding_count: number;
      worst_severity: string;
      summary: string;
      score: number;
    }> = {};

    for (const report of reports) {
      const category = report.category || 'general';
      if (!findingsByCategory[category]) {
        findingsByCategory[category] = {
          findings: [],
          finding_count: 0,
          worst_severity: 'info',
          summary: '',
          score: 100,
        };
      }
      findingsByCategory[category].findings.push(report);
      findingsByCategory[category].finding_count++;
      
      // Track worst severity
      const severityRank: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };
      const currentRank = severityRank[findingsByCategory[category].worst_severity] || 5;
      const newRank = severityRank[report.severity] || 5;
      if (newRank < currentRank) {
        findingsByCategory[category].worst_severity = report.severity;
      }
    }

    // Calculate scores per category
    for (const category of Object.keys(findingsByCategory)) {
      const catData = findingsByCategory[category];
      // Simple scoring: start at 100, deduct based on severity
      let score = 100;
      for (const finding of catData.findings) {
        switch (finding.severity) {
          case 'critical': score -= 25; break;
          case 'high': score -= 15; break;
          case 'medium': score -= 8; break;
          case 'low': score -= 3; break;
        }
      }
      catData.score = Math.max(0, score);
      catData.summary = `${catData.finding_count} ${category} issues found.`;
    }

    // Calculate overall score
    const categoryScores = Object.values(findingsByCategory).map(c => c.score);
    const overallScore = categoryScores.length > 0 
      ? Math.round(categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length)
      : 100;

    // Build dimension scores
    const dimensionScores: Record<string, number> = {};
    for (const [cat, data] of Object.entries(findingsByCategory)) {
      dimensionScores[cat] = data.score;
    }

    return NextResponse.json({
      run_id: runId,
      overall_score: overallScore,
      dimension_scores: dimensionScores,
      findings: findingsByCategory,
      dependency_graph: run.dependency_graph || null,
      code_graph: run.code_graph || null,
      code_index_status: run.code_index_status || null,
      code_index_error: run.code_index_error || null,
      executive_summary: run.summary?.executive_summary || 
        `Analysis complete. Overall safety score: ${overallScore}/100.`,
    });
  } catch (error) {
    console.error('Get report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
