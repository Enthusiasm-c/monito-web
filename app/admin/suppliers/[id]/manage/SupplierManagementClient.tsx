'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { BulkDeleteModal, DeleteSuccessModal } from '@/app/admin/components/BulkActions/BulkDeleteModal';
import { PriceHistoryChart } from '@/app/admin/components/PriceHistory/PriceHistoryChart';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactInfo?: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    prices: number;
    uploads: number;
  };
}

interface RecentPrice {
  id: string;
  amount: number;
  unit: string;
  unitPrice?: number;
  validFrom: Date;
  validTo?: Date;
  createdAt: Date;
  product: {
    id: string;
    name: string;
    standardizedName: string;
    category?: string;
    unit: string;
  };
}

interface PriceStats {
  totalPrices: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
}

interface SupplierManagementClientProps {
  supplier: Supplier;
  recentPrices: RecentPrice[];
  priceStats: PriceStats;
}

export function SupplierManagementClient({ 
  supplier, 
  recentPrices, 
  priceStats 
}: SupplierManagementClientProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [deleteResult, setDeleteResult] = useState<any>(null);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [supplierData, setSupplierData] = useState({
    name: supplier.name,
    email: supplier.email || '',
    phone: supplier.phone || '',
    address: supplier.address || '',
    contactInfo: supplier.contactInfo || ''
  });

  const handleBulkDelete = async (reason?: string) => {
    try {
      const response = await fetch(`/api/admin/suppliers/${supplier.id}/prices`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          userId: 'temp-admin-user' // TODO: Get from auth
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete prices');
      }

      const result = await response.json();
      setDeleteResult(result.data);
      setIsDeleteModalOpen(false);
      setIsSuccessModalOpen(true);
      
      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting prices:', error);
      alert('Failed to delete prices. Please try again.');
    }
  };

  const handleSupplierUpdate = async () => {
    try {
      const response = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supplierData)
      });

      if (!response.ok) {
        throw new Error('Failed to update supplier');
      }

      setIsEditingSupplier(false);
      // Show success message or refresh data
      
    } catch (error) {
      console.error('Error updating supplier:', error);
      alert('Failed to update supplier. Please try again.');
    }
  };

  // Convert recent prices to chart data
  const chartData = recentPrices.map(price => ({
    date: price.createdAt,
    price: price.amount,
    unitPrice: price.unitPrice,
    supplier: { id: supplier.id, name: supplier.name }
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Manage Supplier: {supplier.name}
            </h1>
            <div className="flex space-x-3">
              <button
                onClick={() => setIsEditingSupplier(!isEditingSupplier)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isEditingSupplier ? 'Cancel' : 'Edit Supplier'}
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete All Prices
              </button>
            </div>
          </div>
        </div>

        {/* Supplier Information */}
        <div className="px-6 py-4">
          {isEditingSupplier ? (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={supplierData.name}
                  onChange={(e) => setSupplierData({ ...supplierData, name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={supplierData.email}
                  onChange={(e) => setSupplierData({ ...supplierData, email: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  value={supplierData.phone}
                  onChange={(e) => setSupplierData({ ...supplierData, phone: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={supplierData.address}
                  onChange={(e) => setSupplierData({ ...supplierData, address: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Contact Info</label>
                <textarea
                  rows={3}
                  value={supplierData.contactInfo}
                  onChange={(e) => setSupplierData({ ...supplierData, contactInfo: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="col-span-2">
                <button
                  onClick={handleSupplierUpdate}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Contact Information</h3>
                <dl className="mt-2 space-y-1">
                  <div>
                    <dt className="text-xs text-gray-500">Email:</dt>
                    <dd className="text-sm text-gray-900">{supplier.email || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Phone:</dt>
                    <dd className="text-sm text-gray-900">{supplier.phone || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Address:</dt>
                    <dd className="text-sm text-gray-900">{supplier.address || 'Not provided'}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">System Information</h3>
                <dl className="mt-2 space-y-1">
                  <div>
                    <dt className="text-xs text-gray-500">Created:</dt>
                    <dd className="text-sm text-gray-900">{format(new Date(supplier.createdAt), 'MMM dd, yyyy')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Last Updated:</dt>
                    <dd className="text-sm text-gray-900">{format(new Date(supplier.updatedAt), 'MMM dd, yyyy')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Total Prices:</dt>
                    <dd className="text-sm text-gray-900">{supplier._count.prices.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Total Uploads:</dt>
                    <dd className="text-sm text-gray-900">{supplier._count.uploads.toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Prices</dt>
                  <dd className="text-lg font-medium text-gray-900">{priceStats.totalPrices.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Average Price</dt>
                  <dd className="text-lg font-medium text-gray-900">IDR {Math.round(priceStats.averagePrice).toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Lowest Price</dt>
                  <dd className="text-lg font-medium text-gray-900">IDR {Math.round(priceStats.minPrice).toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Highest Price</dt>
                  <dd className="text-lg font-medium text-gray-900">IDR {Math.round(priceStats.maxPrice).toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Price Trend Chart */}
      {chartData.length > 0 && (
        <PriceHistoryChart 
          data={chartData}
          title={`Recent Price Trends for ${supplier.name}`}
          height={300}
          period="30d"
        />
      )}

      {/* Recent Prices Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Prices</h3>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid From</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentPrices.map((price) => (
                <tr key={price.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{price.product.name}</div>
                      <div className="text-sm text-gray-500">{price.product.standardizedName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">IDR {price.amount.toLocaleString()}</div>
                    {price.unitPrice && (
                      <div className="text-sm text-gray-500">Unit: IDR {price.unitPrice.toLocaleString()}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{price.unit}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(price.validFrom), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      price.validTo ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {price.validTo ? 'Expired' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {recentPrices.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No prices found for this supplier.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <BulkDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete All Supplier Prices"
        description={`This will permanently delete all ${supplier._count.prices.toLocaleString()} prices for ${supplier.name}. This action cannot be undone.`}
        itemCount={supplier._count.prices}
        itemType="prices"
        destructive={true}
      />

      <DeleteSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        deletedCount={deleteResult?.deletedCount || 0}
        itemType="prices"
        operationId={deleteResult?.operationId}
      />
    </div>
  );
}