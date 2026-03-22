import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, app_base_url, model_profile } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const isMockMode = !process.env.FEATHERLESS_API_KEY || process.env.FEATHERLESS_API_KEY === 'mock';

    if (isMockMode) {
      // Mock response for development
      const score = Math.floor(Math.random() * 75) + 10;
      const flags: string[] = [];
      
      if (score > 60) flags.push('high_hallucination_risk');
      if (prompt.toLowerCase().includes('ignore') || prompt.toLowerCase().includes('pretend')) {
        flags.push('potential_jailbreak');
      }
      if (score > 40) flags.push('low_groundedness');

      return NextResponse.json({
        response_text: `[Mock Response] Analysis of prompt: '${prompt.slice(0, 80)}...' This is a simulated response for development purposes.`,
        hallucination_score: score,
        safety_flags: flags,
        explanation: `Mock analysis: The prompt has a hallucination risk score of ${score}/100. ${score > 60 ? 'High risk detected due to ungrounded claims.' : 'Moderate risk level.'}`,
      });
    }

    // Real LLM call via Featherless AI
    const response = await fetch(`${process.env.FEATHERLESS_API_BASE || 'https://api.featherless.ai/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FEATHERLESS_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'Qwen/Qwen3-32B',
        messages: [
          {
            role: 'system',
            content: 'You are a safety analysis assistant. Analyze prompts for hallucination risk and safety concerns. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: `Analyze this prompt for hallucination risk and safety:\n\nPrompt: ${prompt}\n\nRespond with JSON: {"response_text": "...", "hallucination_score": 0-100, "safety_flags": [...], "explanation": "..."}`,
          },
        ],
        temperature: 0,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    try {
      const result = JSON.parse(content);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({
        response_text: content,
        hallucination_score: 50,
        safety_flags: ['parse_error'],
        explanation: 'Could not parse structured response from LLM',
      });
    }
  } catch (error) {
    console.error('Playground query error:', error);
    return NextResponse.json({
      response_text: `Error analyzing prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
      hallucination_score: 50,
      safety_flags: ['analysis_error'],
      explanation: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
