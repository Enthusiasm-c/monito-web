'use client';

import Link from 'next/link';
import { SessionProvider } from '@/app/providers/SessionProvider';
import { AdminAuthGuard } from './components/AdminAuthGuard';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

function AdminNavigation() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/admin/login' });
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/admin" className="text-xl font-bold text-gray-900">
                Monito Admin
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/admin/products"
                className={`${
                  pathname.startsWith('/admin/products')
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Products
              </Link>
              <Link
                href="/admin/suppliers"
                className={`${
                  pathname.startsWith('/admin/suppliers')
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Suppliers
              </Link>
              <Link
                href="/admin/uploads"
                className={`${
                  pathname.startsWith('/admin/uploads')
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                Uploads
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {session && (
              <div className="text-sm text-gray-700">
                <span className="font-medium">{session.user?.name}</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  session.user?.role === 'admin' 
                    ? 'bg-red-100 text-red-800'
                    : session.user?.role === 'manager'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {session.user?.role}
                </span>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              ← Back to App
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function AdminContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show auth guard on login page
  if (pathname === '/admin/login') {
    return (
      <>
        {children}
      </>
    );
  }

  return (
    <AdminAuthGuard requiredRole="manager">
      <div className="min-h-screen bg-gray-50">
        <AdminNavigation />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </AdminAuthGuard>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AdminContent>{children}</AdminContent>
    </SessionProvider>
  );
}