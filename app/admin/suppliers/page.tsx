'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  _count?: {
    prices: number;
  };
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Reusable Pagination Component
const PaginationComponent = ({ pagination, onPageChange }: { pagination: Pagination, onPageChange: (page: number) => void }) => {
  if (pagination.totalPages <= 1) return null;

  const pages = Array.from({ length: pagination.totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
      <div className="flex flex-1 justify-between sm:justify-end">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </nav>
  );
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSuppliers = useCallback(async (page: number, search: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        search: search,
      });
      const response = await fetch(`/api/admin/suppliers?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      const data = await response.json();
      setSuppliers(data.suppliers || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers(currentPage, searchTerm);
    }, 500); // Debounce search
    return () => clearTimeout(timer);
  }, [searchTerm, currentPage, fetchSuppliers]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Suppliers Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Total suppliers: {pagination ? pagination.total : '-'}. Showing {suppliers.length} suppliers on this page.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6">
        <div className="max-w-md">
          <input
            type="text"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Search by name, email, phone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on new search
            }}
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              {loading ? (
                 <div className="flex justify-center items-center h-64">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                 </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          No suppliers found.
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((supplier) => (
                        <tr key={supplier.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{supplier.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.email || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier._count?.prices || 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(supplier.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/admin/suppliers/${supplier.id}`} className="text-blue-600 hover:text-blue-900">Edit</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
               {pagination && <PaginationComponent pagination={pagination} onPageChange={handlePageChange} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
