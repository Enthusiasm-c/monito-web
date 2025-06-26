'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AdminAuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'viewer';
}

export function AdminAuthGuard({ children, requiredRole = 'viewer' }: AdminAuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (!session) {
      // Not authenticated, redirect to login
      router.push('/admin/login');
      return;
    }

    if (!session.user?.role) {
      // No role assigned, redirect to login
      router.push('/admin/login?error=no_role');
      return;
    }

    // Check role permissions
    const userRole = session.user.role;
    const roleHierarchy = {
      'viewer': 1,
      'manager': 2,
      'admin': 3
    };

    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      // Insufficient permissions
      router.push('/admin/login?error=insufficient_permissions');
      return;
    }

    // Check if user account is active
    if (session.user.isActive === false) {
      router.push('/admin/login?error=account_deactivated');
      return;
    }
  }, [session, status, router, requiredRole]);

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Checking authentication...</div>
        </div>
      </div>
    );
  }

  // Show error if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ Authentication required</div>
          <div className="text-gray-600">Redirecting to login...</div>
        </div>
      </div>
    );
  }

  // Check role permissions
  const userRole = session.user?.role;
  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ No role assigned</div>
          <div className="text-gray-600">Contact administrator</div>
        </div>
      </div>
    );
  }

  const roleHierarchy = {
    'viewer': 1,
    'manager': 2,
    'admin': 3
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  if (userLevel < requiredLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ Insufficient permissions</div>
          <div className="text-gray-600">
            Required role: {requiredRole} (you have: {userRole})
          </div>
        </div>
      </div>
    );
  }

  // Check if account is active
  if (session.user.isActive === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ Account deactivated</div>
          <div className="text-gray-600">Contact administrator</div>
        </div>
      </div>
    );
  }

  // All checks passed, render children
  return <>{children}</>;
}