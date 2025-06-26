/**
 * Next.js Middleware for route protection and authentication
 */

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default withAuth(
  function middleware(request: NextRequest) {
    const token = request.nextauth.token;
    const { pathname } = request.nextUrl;

    // Allow access to login page
    if (pathname.startsWith('/admin/login')) {
      return NextResponse.next();
    }

    // Check if user is trying to access admin routes
    if (pathname.startsWith('/admin')) {
      // Check if user is authenticated
      if (!token) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check if user is active
      if (!token.isActive) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('error', 'Account is deactivated');
        return NextResponse.redirect(loginUrl);
      }

      // Check role permissions for admin routes
      const userRole = token.role as string;
      
      // Only admin and manager can access admin routes
      if (!['admin', 'manager'].includes(userRole)) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      // Additional restrictions for sensitive operations
      if (pathname.includes('/users') || pathname.includes('/system')) {
        if (userRole !== 'admin') {
          return NextResponse.redirect(new URL('/admin?error=insufficient_permissions', request.url));
        }
      }
    }

    // Check API admin routes
    if (pathname.startsWith('/api/admin')) {
      // Check if user is authenticated
      if (!token) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Check if user is active
      if (!token.isActive) {
        return NextResponse.json(
          { error: 'Account is deactivated' },
          { status: 401 }
        );
      }

      // Check role permissions
      const userRole = token.role as string;
      
      if (!['admin', 'manager'].includes(userRole)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      // Restrict dangerous operations to admin only
      const isDestructiveOperation = 
        request.method === 'DELETE' ||
        pathname.includes('/bulk-operations') ||
        pathname.includes('/users') ||
        pathname.includes('/system');

      if (isDestructiveOperation && userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Admin role required for this operation' },
          { status: 403 }
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Allow public routes
        if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
          return true;
        }

        // Allow login page
        if (pathname.startsWith('/admin/login')) {
          return true;
        }

        // For protected routes, require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*'
  ]
};