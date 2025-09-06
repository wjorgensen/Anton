import { NextRequest, NextResponse } from 'next/server';

const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Call the orchestrator to run Claude planning
    const response = await fetch(`${ORCHESTRATOR_URL}/api/plan-project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Planning failed: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Failed to plan circuit:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to plan circuit' },
      { status: 500 }
    );
  }
}