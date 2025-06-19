'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UnmatchedEntry {
  id: string;
  rawName: string;
  normalizedName?: string;
  context?: any;
  frequency: number;
  status: 'pending' | 'assigned' | 'ignored';
  assignedProductId?: string;
  assignedBy?: string;
  assignedAt?: string;
  notes?: string;
  createdAt: string;
  supplier?: {
    id: string;
    name: string;
  };
  upload?: {
    id: string;
    originalName: string;
    createdAt: string;
  };
  assignedProduct?: {
    id: string;
    name: string;
    standardizedName: string;
  };
}

interface Product {
  id: string;
  name: string;
  standardizedName: string;
  unit: string;
}

export default function UnmatchedPage() {
  const [entries, setEntries] = useState<UnmatchedEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    assigned: 0,
    ignored: 0,
    total: 0
  });

  useEffect(() => {
    fetchUnmatchedEntries();
    fetchProducts();
  }, [statusFilter, searchTerm]);

  const fetchUnmatchedEntries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter,
        ...(searchTerm && { search: searchTerm }),
        limit: '100'
      });

      const response = await fetch(`/api/admin/unmatched?${params}`);
      const data = await response.json();

      if (data.success) {
        setEntries(data.data);
        setStatusCounts(data.statusCounts);
      }
    } catch (error) {
      console.error('Failed to fetch unmatched entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams({
        limit: '500',
        ...(productSearch && { search: productSearch })
      });

      const response = await fetch(`/api/admin/products?${params}`);
      const data = await response.json();

      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleAssign = async (entryId: string, action: 'assign' | 'ignore') => {
    try {
      const body: any = {
        action,
        assignedBy: 'admin'
      };

      if (action === 'assign' && selectedProductId) {
        body.productId = selectedProductId;
      }

      const response = await fetch(`/api/admin/unmatched/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setAssigningId(null);
        setSelectedProductId('');
        fetchUnmatchedEntries();
      } else {
        console.error('Failed to assign entry');
      }
    } catch (error) {
      console.error('Error assigning entry:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-green-100 text-green-800',
      ignored: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Unmatched Products Queue</h1>
          <p className="mt-2 text-sm text-gray-700">
            Review products that couldn't be automatically matched and assign them to existing products
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Status Overview */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{statusCounts.pending}</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                  <dd className="text-lg font-medium text-gray-900">{statusCounts.pending}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{statusCounts.assigned}</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Assigned</dt>
                  <dd className="text-lg font-medium text-gray-900">{statusCounts.assigned}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{statusCounts.ignored}</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Ignored</dt>
                  <dd className="text-lg font-medium text-gray-900">{statusCounts.ignored}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{statusCounts.total}</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total</dt>
                  <dd className="text-lg font-medium text-gray-900">{statusCounts.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search product names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div className="flex-none">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="ignored">Ignored</option>
            <option value="all">All Status</option>
          </select>
        </div>
      </div>

      {/* Entries Table */}
      <div className="mt-8">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Context
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div>
                      <div className="font-semibold">{entry.rawName}</div>
                      {entry.normalizedName && entry.normalizedName !== entry.rawName && (
                        <div className="text-xs text-gray-500">→ {entry.normalizedName}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {entry.frequency}×
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(entry.status)}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.supplier?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.context && (
                      <div className="max-w-xs">
                        {entry.context.scanned_price && (
                          <div>Price: ${entry.context.scanned_price}</div>
                        )}
                        {entry.context.unit && (
                          <div>Unit: {entry.context.unit}</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.assignedProduct ? (
                      <div>
                        <div className="font-medium">{entry.assignedProduct.name}</div>
                        <div className="text-xs text-gray-400">by {entry.assignedBy}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {entry.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setAssigningId(entry.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => handleAssign(entry.id, 'ignore')}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Ignore
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {entries.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">
                No unmatched products found with the current filters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Modal */}
      {assigningId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Assign Product
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search for existing product:
                </label>
                <input
                  type="text"
                  placeholder="Type to search products..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    fetchProducts();
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div className="mb-4 max-h-60 overflow-y-auto">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select product:
                </label>
                <div className="space-y-2">
                  {products.map((product) => (
                    <label key={product.id} className="flex items-center">
                      <input
                        type="radio"
                        name="product"
                        value={product.id}
                        checked={selectedProductId === product.id}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="mr-2"
                      />
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-gray-500">
                          {product.standardizedName} • {product.unit}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setAssigningId(null);
                    setSelectedProductId('');
                    setProductSearch('');
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAssign(assigningId, 'assign')}
                  disabled={!selectedProductId}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}