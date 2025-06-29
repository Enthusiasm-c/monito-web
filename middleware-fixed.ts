/**
 * Next.js Middleware - COMPLETELY DISABLED FOR DEBUGGING
 * Passes through all requests without any authentication checks
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Simply pass through all requests - no authentication checks
  return NextResponse.next();
}

export const config = {
  // Empty matcher means this middleware won't actually run on any routes
  matcher: []
};