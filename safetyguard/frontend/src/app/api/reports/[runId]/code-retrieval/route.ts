import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const body = await request.json();
    const { query, top_k = 5, hops = 1 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const runs = await sql`
      SELECT code_graph FROM analysis_runs WHERE id = ${runId} LIMIT 1
    `;

    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    const codeGraph = runs[0].code_graph || { nodes: [], edges: [] };
    const nodes = codeGraph.nodes || [];
    const edges = codeGraph.edges || [];

    // Simple text-based search (in production, use vector search)
    const queryLower = query.toLowerCase();
    const matchingNodes = nodes
      .filter((node: { label?: string; id?: string }) => {
        const label = (node.label || '').toLowerCase();
        const id = (node.id || '').toLowerCase();
        return label.includes(queryLower) || id.includes(queryLower);
      })
      .slice(0, top_k);

    const matchingNodeIds = new Set(matchingNodes.map((n: { id: string }) => n.id));
    
    // Expand to connected nodes based on hops
    const expandedNodeIds = new Set(matchingNodeIds);
    for (let h = 0; h < hops; h++) {
      for (const edge of edges) {
        if (expandedNodeIds.has(edge.source)) {
          expandedNodeIds.add(edge.target);
        }
        if (expandedNodeIds.has(edge.target)) {
          expandedNodeIds.add(edge.source);
        }
      }
    }

    // Get subgraph
    const subgraphNodes = nodes.filter((n: { id: string }) => expandedNodeIds.has(n.id));
    const subgraphEdges = edges.filter(
      (e: { source: string; target: string }) => 
        expandedNodeIds.has(e.source) && expandedNodeIds.has(e.target)
    );

    // Highlight edges connecting matching nodes
    const highlightEdgeIds = edges
      .filter((e: { source: string; target: string }) => 
        matchingNodeIds.has(e.source) || matchingNodeIds.has(e.target)
      )
      .map((e: { id?: string; source: string; target: string }) => e.id || `${e.source}-${e.target}`);

    return NextResponse.json({
      chunks: matchingNodes.map((n: { id: string; label?: string; data?: Record<string, unknown> }) => ({
        node_id: n.id,
        label: n.label,
        content: n.data?.content || '',
        file_path: n.data?.file_path || '',
        score: 1.0,
      })),
      expanded_node_ids: Array.from(expandedNodeIds),
      highlight_edge_ids: highlightEdgeIds,
      subgraph_nodes: subgraphNodes,
      subgraph_edges: subgraphEdges,
      error: null,
    });
  } catch (error) {
    console.error('Code retrieval error:', error);
    return NextResponse.json({
      chunks: [],
      expanded_node_ids: [],
      highlight_edge_ids: [],
      subgraph_nodes: [],
      subgraph_edges: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
