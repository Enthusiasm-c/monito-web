'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    suppliers: 0,
    pendingUploads: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        setStats({
          products: data.products || 0,
          suppliers: data.suppliers || 0,
          pendingUploads: data.pendingUploads || 0
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Monito Administration
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Manage products, suppliers, and data integrity
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Products Card */}
            <Link
              href="/admin/products"
              className="group relative bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600">
                  Products Management
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Edit product details, units, categories, and standardized names
                </p>
              </div>
            </Link>

            {/* Suppliers Card */}
            <Link
              href="/admin/suppliers"
              className="group relative bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-600 group-hover:bg-green-100">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-green-600">
                  Suppliers Management
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Manage supplier contacts, addresses, and business information
                </p>
              </div>
            </Link>

            {/* Uploads Card */}
            <Link
              href="/admin/uploads"
              className="group relative bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-yellow-600">
                  Upload Management
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Review and approve pending uploads from suppliers
                </p>
              </div>
            </Link>

            {/* Dictionaries Card */}
            <Link
              href="/admin/dictionaries"
              className="group relative bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-600 group-hover:bg-purple-100">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-purple-600">
                  Dictionaries
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Manage language and unit dictionaries for product normalization
                </p>
              </div>
            </Link>

            {/* Unmatched Queue Card */}
            <Link
              href="/admin/unmatched"
              className="group relative bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-red-50 text-red-600 group-hover:bg-red-100">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-red-600">
                  Unmatched Products
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Review and assign unmatched products to existing items
                </p>
              </div>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats.products.toLocaleString()}
              </div>
              <div className="text-sm text-blue-600">Total Products</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {stats.suppliers}
              </div>
              <div className="text-sm text-green-600">Active Suppliers</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pendingUploads || '-'}
              </div>
              <div className="text-sm text-yellow-600">Pending Uploads</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}