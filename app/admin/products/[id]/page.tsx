'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AliasManager from './aliases';
import { ProductPriceChart } from '../../components/PriceAnalytics/ProductPriceChart';

interface Product {
  id: string;
  name: string;
  standardizedName: string;
  category: string;
  unit: string;
  standardizedUnit: string;
  description?: string;
  rawName?: string;
  createdAt: string;
  updatedAt: string;
  prices: Array<{
    id: string;
    amount: number;
    unit?: string;
    createdAt: string;
    supplier: {
      id: string;
      name: string;
    };
    upload?: {
      id: string;
      originalName: string;
    };
  }>;
}

interface FormData {
  name: string;
  standardizedName: string;
  category: string;
  unit: string;
  standardizedUnit: string;
  description: string;
  rawName: string;
}

export default function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    standardizedName: '',
    category: '',
    unit: '',
    standardizedUnit: '',
    description: '',
    rawName: ''
  });

  const isNew = resolvedParams?.id === 'new';

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setResolvedParams(resolved);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (resolvedParams) {
      if (!isNew) {
        fetchProduct();
      } else {
        setLoading(false);
      }
    }
  }, [resolvedParams, isNew]);

  const fetchProduct = async () => {
    if (!resolvedParams) return;
    
    try {
      const response = await fetch(`/api/admin/products/${resolvedParams.id}`);
      if (response.ok) {
        const data: Product = await response.json();
        setProduct(data);
        setFormData({
          name: data.name,
          standardizedName: data.standardizedName,
          category: data.category,
          unit: data.unit,
          standardizedUnit: data.standardizedUnit,
          description: data.description || '',
          rawName: data.rawName || ''
        });
      } else {
        console.error('Failed to fetch product');
        router.push('/admin/products');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      router.push('/admin/products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (!resolvedParams) return;

    try {
      const url = isNew ? '/api/admin/products' : `/api/admin/products/${resolvedParams.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        router.push('/admin/products');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const commonCategories = [
    'Vegetables', 'Fruits', 'Meat', 'Seafood', 'Dairy', 'Grains', 'Spices', 'Beverages', 'Other'
  ];

  const commonUnits = [
    'kg', 'g', 'l', 'ml', 'pcs', 'pack', 'box', 'bottle', 'can', 'bag'
  ];

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            {isNew ? 'Create Product' : `Edit Product: ${product?.name}`}
          </h2>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            href="/admin/products"
            className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Products
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Product Information</h3>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="standardizedName" className="block text-sm font-medium text-gray-700">
                    Standardized Name
                  </label>
                  <input
                    type="text"
                    id="standardizedName"
                    name="standardizedName"
                    value={formData.standardizedName}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select Category</option>
                    {commonCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
                    Unit *
                  </label>
                  <select
                    id="unit"
                    name="unit"
                    required
                    value={formData.unit}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select Unit</option>
                    {commonUnits.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="standardizedUnit" className="block text-sm font-medium text-gray-700">
                    Standardized Unit
                  </label>
                  <select
                    id="standardizedUnit"
                    name="standardizedUnit"
                    value={formData.standardizedUnit}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select Standardized Unit</option>
                    {commonUnits.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="rawName" className="block text-sm font-medium text-gray-700">
                    Raw Name
                  </label>
                  <input
                    type="text"
                    id="rawName"
                    name="rawName"
                    value={formData.rawName}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Link
                  href="/admin/products"
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (isNew ? 'Create Product' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Price Information */}
        {!isNew && product && (
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Current Prices</h3>
              </div>
              <div className="px-6 py-4">
                {product.prices.length === 0 ? (
                  <p className="text-sm text-gray-500">No prices available</p>
                ) : (
                  <div className="space-y-4">
                    {product.prices.map((price) => (
                      <div key={price.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatPrice(price.amount)}
                            </div>
                            <div className="text-xs text-gray-500">
                              per {price.unit || product.unit}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-900">
                              {price.supplier.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(price.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {price.upload && (
                          <div className="mt-2 text-xs text-gray-400">
                            From: {price.upload.originalName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Product Metadata */}
            <div className="mt-6 bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Metadata</h3>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(product.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(product.updatedAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Product ID</dt>
                  <dd className="text-sm text-gray-900 font-mono">{product.id}</dd>
                </div>
              </div>
            </div>

            {/* Price History Chart */}
            <div className="mt-6 bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Price History (6 Months)</h3>
                <p className="text-sm text-gray-500 mt-1">Price dynamics across suppliers</p>
              </div>
              <div className="px-6 py-4">
                <ProductPriceChart productId={product.id} />
              </div>
            </div>

            {/* Alias Manager */}
            <div className="mt-6">
              <AliasManager productId={product.id} productName={product.name} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}