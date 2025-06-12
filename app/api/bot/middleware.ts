import { NextRequest, NextResponse } from 'next/server';

// Simple API key authentication for bot endpoints
export function authenticateBot(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('X-Bot-API-Key');
  const expectedKey = process.env.BOT_API_KEY;

  if (!expectedKey) {
    console.error('BOT_API_KEY not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null; // Authentication successful
}