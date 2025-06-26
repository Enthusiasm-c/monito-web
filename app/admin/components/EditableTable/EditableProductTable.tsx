'use client';

import React, { useState } from 'react';
import { EditableCell, EditablePriceCell } from './EditableCell';

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

interface EditableProductTableProps {
  products: ProductWithPrices[];
  onUpdateProduct: (productId: string, field: string, value: string | number) => Promise<void>;
  onUpdatePrice: (priceId: string, field: string, value: string | number) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
  onViewAnalytics?: (productId: string) => void;
  loading?: boolean;
  selectedProducts?: Set<string>;
  onSelectProduct?: (productId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}

export function EditableProductTable({
  products,
  onUpdateProduct,
  onUpdatePrice,
  onDeleteProduct,
  onViewAnalytics,
  loading = false,
  selectedProducts = new Set(),
  onSelectProduct,
  onSelectAll
}: EditableProductTableProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const toggleProductExpansion = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectAll?.(e.target.checked);
  };

  const handleSelectProduct = (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectProduct?.(productId, e.target.checked);
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="animate-pulse">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Products</h3>
        </div>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by uploading some price lists.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Editable Products ({products.length})
          </h3>
          <div className="text-xs text-gray-500">
            Click any cell to edit • Enter to save • Esc to cancel
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {(onSelectProduct || onSelectAll) && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedProducts.size === products.length && products.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Standardized Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prices
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <React.Fragment key={product.id}>
                <tr className="hover:bg-gray-50">
                  {(onSelectProduct || onSelectAll) && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedProducts.has(product.id)}
                        onChange={(e) => handleSelectProduct(product.id, e)}
                      />
                    </td>
                  )}
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <EditableCell
                      value={product.name}
                      onSave={(newValue) => onUpdateProduct(product.id, 'name', newValue)}
                      placeholder="Product name"
                      validation={(val) => val.toString().length < 2 ? 'Name must be at least 2 characters' : null}
                    />
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <EditableCell
                      value={product.standardizedName}
                      onSave={(newValue) => onUpdateProduct(product.id, 'standardizedName', newValue)}
                      placeholder="Standardized name"
                    />
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <EditableCell
                      value={product.category}
                      onSave={(newValue) => onUpdateProduct(product.id, 'category', newValue)}
                      placeholder="Category"
                    />
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <EditableCell
                        value={product.unit}
                        onSave={(newValue) => onUpdateProduct(product.id, 'unit', newValue)}
                        placeholder="Unit"
                        validation={(val) => val.toString().length < 1 ? 'Unit is required' : null}
                      />
                      {product.standardizedUnit && (
                        <div className="text-xs text-gray-500">
                          Std: {product.standardizedUnit}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-900">
                        {product._count?.prices || product.prices.length} prices
                      </span>
                      <button
                        onClick={() => toggleProductExpansion(product.id)}
                        className="text-sm text-indigo-600 hover:text-indigo-900"
                      >
                        {expandedProducts.has(product.id) ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => toggleProductExpansion(product.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {expandedProducts.has(product.id) ? 'Collapse' : 'Expand'}
                      </button>
                      {onViewAnalytics && product.prices.length > 0 && (
                        <button
                          onClick={() => onViewAnalytics(product.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Анализ цен"
                        >
                          📊 Analytics
                        </button>
                      )}
                      {onDeleteProduct && (
                        <button
                          onClick={() => onDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                
                {/* Expanded prices section */}
                {expandedProducts.has(product.id) && (
                  <tr>
                    <td colSpan={onSelectProduct ? 7 : 6} className="px-6 py-4 bg-gray-50">
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-900">Product Prices</h4>
                        
                        {product.prices.length === 0 ? (
                          <p className="text-sm text-gray-500">No prices available for this product.</p>
                        ) : (
                          <div className="space-y-2">
                            {product.prices.map((price) => (
                              <div key={price.id} className="flex items-center space-x-4 p-3 bg-white rounded border">
                                <div className="flex-1">
                                  <EditablePriceCell
                                    value={price.amount}
                                    onSave={(newValue) => onUpdatePrice(price.id, 'amount', newValue)}
                                  />
                                </div>
                                
                                <div className="flex-1">
                                  <EditableCell
                                    value={price.unit}
                                    onSave={(newValue) => onUpdatePrice(price.id, 'unit', newValue)}
                                    placeholder="Unit"
                                  />
                                </div>
                                
                                {price.unitPrice && (
                                  <div className="flex-1">
                                    <EditablePriceCell
                                      value={price.unitPrice}
                                      onSave={(newValue) => onUpdatePrice(price.id, 'unitPrice', newValue)}
                                    />
                                  </div>
                                )}
                                
                                <div className="text-xs text-gray-500">
                                  <div>Valid from: {new Date(price.validFrom).toLocaleDateString()}</div>
                                  {price.validTo && (
                                    <div>Valid to: {new Date(price.validTo).toLocaleDateString()}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}