'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function AdminNavigation() {
  const pathname = usePathname();

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
            <div className="text-sm text-gray-700">
              <span className="font-medium">Debug User</span>
              <span className="ml-2 px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                admin
              </span>
            </div>
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

  // TEMPORARY: Bypass auth guard for debugging
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavigation />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminContent>{children}</AdminContent>;
}