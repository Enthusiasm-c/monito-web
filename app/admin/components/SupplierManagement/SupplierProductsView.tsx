'use client';

import React, { useState, useEffect } from 'react';
import { EditableProductTable } from '../EditableTable/EditableProductTable';
import { BulkDeleteModal } from '../BulkActions/BulkDeleteModal';
import { ProductPriceChart } from '../PriceAnalytics/ProductPriceChart';

interface Product {
  id: string;
  name: string;
  standardizedName: string;
  category?: string;
  unit: string;
  standardizedUnit?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Price {
  id: string;
  amount: number;
  unit: string;
  unitPrice?: number;
  validFrom: Date;
  validTo?: Date;
  supplierId: string;
  productId: string;
}

interface ProductWithPrices extends Product {
  prices: Price[];
  _count?: {
    prices: number;
  };
}

interface SupplierProductsViewProps {
  supplierId: string;
  supplierName: string;
}

export function SupplierProductsView({ supplierId, supplierName }: SupplierProductsViewProps) {
  const [products, setProducts] = useState<ProductWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedProductForAnalytics, setSelectedProductForAnalytics] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/suppliers/${supplierId}/prices?page=${page}&limit=50&search=${encodeURIComponent(search)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load products');
      }
      
      const data = await response.json();
      
      // Group prices by product
      const productsMap = new Map<string, ProductWithPrices>();
      
      data.data.prices.forEach((price: any) => {
        const product = price.product;
        if (!productsMap.has(product.id)) {
          productsMap.set(product.id, {
            ...product,
            prices: [],
            _count: { prices: 0 }
          });
        }
        
        const productData = productsMap.get(product.id)!;
        productData.prices.push(price);
        productData._count!.prices = productData.prices.length;
      });
      
      setProducts(Array.from(productsMap.values()));
      setTotalPages(data.data.pagination.totalPages);
      setError(null);
    } catch (error) {
      console.error('Error loading products:', error);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [supplierId, page, search]);

  const handleUpdateProduct = async (productId: string, field: string, value: string | number) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field, value }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update product');
      }

      // Update local state
      setProducts(prev => prev.map(product => 
        product.id === productId 
          ? { ...product, [field]: value }
          : product
      ));
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const handleUpdatePrice = async (priceId: string, field: string, value: string | number) => {
    try {
      const response = await fetch(`/api/admin/prices/${priceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field, value }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update price');
      }

      // Update local state
      setProducts(prev => prev.map(product => ({
        ...product,
        prices: product.prices.map(price => 
          price.id === priceId 
            ? { ...price, [field]: field === 'amount' || field === 'unitPrice' ? Number(value) : value }
            : price
        )
      })));
    } catch (error) {
      console.error('Error updating price:', error);
      throw error;
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product and all its prices?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete product');
      }

      // Remove from local state
      setProducts(prev => prev.filter(product => product.id !== productId));
      setSelectedProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      alert(`Failed to delete product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSelectProduct = (productId: string, selected: boolean) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedProducts(new Set(products.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleBulkDelete = async (reason?: string) => {
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/prices`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete prices');
      }

      const result = await response.json();
      alert(`Successfully deleted ${result.data.deletedCount} prices`);
      
      // Reload data
      await loadProducts();
      setSelectedProducts(new Set());
      setShowBulkDeleteModal(false);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      throw error;
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <div className="mt-4">
              <button
                onClick={loadProducts}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Products for {supplierName}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Click any cell to edit • Select products for bulk actions
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {selectedProducts.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Delete All Prices ({selectedProducts.size} products)
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Products Table */}
      <EditableProductTable
        products={products}
        onUpdateProduct={handleUpdateProduct}
        onUpdatePrice={handleUpdatePrice}
        onDeleteProduct={handleDeleteProduct}
        onViewAnalytics={setSelectedProductForAnalytics}
        loading={loading}
        selectedProducts={selectedProducts}
        onSelectProduct={handleSelectProduct}
        onSelectAll={handleSelectAll}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <BulkDeleteModal
          title="Delete All Supplier Prices"
          message={`This will permanently delete ALL prices for supplier "${supplierName}". This action cannot be undone.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteModal(false)}
        />
      )}

      {/* Price Analytics Modal */}
      {selectedProductForAnalytics && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Анализ цен продукта
              </h3>
              <button
                onClick={() => setSelectedProductForAnalytics(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ProductPriceChart productId={selectedProductForAnalytics} />
          </div>
        </div>
      )}
    </div>
  );
}