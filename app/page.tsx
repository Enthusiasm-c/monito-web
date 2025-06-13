"use client";

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  standardizedName: string;
  category: string;
  unit: string;
  priceComparison: {
    bestPrice: { amount: number; supplier: string; supplierId: string } | null;
    highestPrice: { amount: number; supplier: string; supplierId: string } | null;
    supplierCount: number;
    savings: number;
    priceRange: { min: number; max: number } | null;
  };
}

interface Stats {
  products: number;
  suppliers: number;
  lastUpdate: string;
}

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface Upload {
  id: string;
  originalName: string;
  status: string;
  supplier: {
    name: string;
  };
  _count: {
    prices: number;
  };
  createdAt: string;
}

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats>({ products: 0, suppliers: 0, lastUpdate: 'Never' });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [recentUploads, setRecentUploads] = useState<Upload[]>([]);
  const [productsPerPage, setProductsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSupplierCard, setSelectedSupplierCard] = useState<Supplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [supplierDetails, setSupplierDetails] = useState<any>(null);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [editingSupplierData, setEditingSupplierData] = useState<any>(null);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [tokenUsage, setTokenUsage] = useState<{totalCostUsd: number; totalCostFormatted: string}>({totalCostUsd: 0, totalCostFormatted: '$0.0000'});
  const [pendingUploadsCount, setPendingUploadsCount] = useState<number>(0);
  // AI mode is now always enabled

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Data fetching functions
  const fetchData = async () => {
    try {
      const [productsRes, statsRes, suppliersRes, uploadsRes, tokenRes, pendingRes] = await Promise.all([
        fetch(`/api/products?category=${categoryFilter}&limit=${productsPerPage}&page=${currentPage}&sortBy=${sortBy}&sortOrder=${sortOrder}&search=${encodeURIComponent(debouncedSearchQuery)}`),
        fetch('/api/stats'),
        fetch('/api/suppliers'),
        fetch('/api/uploads/status?limit=5'),
        fetch('/api/token-usage'),
        fetch('/api/uploads/pending-count')
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.products || []);
        if (productsData.pagination) {
          setTotalPages(productsData.pagination.pages);
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData);
      }

      if (uploadsRes.ok) {
        const uploadsData = await uploadsRes.json();
        setRecentUploads(uploadsData);
      }

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        setTokenUsage(tokenData);
      }

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingUploadsCount(pendingData.count);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, productsPerPage, currentPage, sortBy, sortOrder, debouncedSearchQuery]);

  // Reset to first page when category, products per page, sorting, or search changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, productsPerPage, sortBy, sortOrder, debouncedSearchQuery]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleFiles = (files: FileList) => {
    const fileArray = Array.from(files).filter(file => 
      file.type.includes('pdf') || 
      file.type.includes('excel') || 
      file.type.includes('csv') ||
      file.type.includes('sheet') ||
      file.type.includes('image')
    );
    setSelectedFiles(prev => [...prev, ...fileArray]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    setUploading(true);
    setUploadStatus('Uploading files...');
    
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Use new Gemini-powered endpoint
      let endpoint = '/api/upload-gemini';
      
      // Add model selection (default to free experimental model)
      formData.append('model', 'gemini-2.0-flash-exp');
      
      // Add supplier ID if selected (AI will use it as a hint)
      if (selectedSupplier) {
        formData.append('supplierId', selectedSupplier);
      }

      setUploadStatus('Processing with AI... This may take 20-30 seconds...');
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Upload successful:', result);
        setUploadStatus(`Success! Extracted ${result.stats?.totalExtracted || 0} products.`);
        setSelectedFiles([]);
        setSelectedSupplier('');
        
        // Refresh data after upload
        await fetchData();
        
        setTimeout(() => {
          setUploadStatus('');
        }, 3000);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`Error: ${error instanceof Error ? error.message : 'Upload failed'}`);
      setTimeout(() => {
        setUploadStatus('');
      }, 5000);
    } finally {
      setUploading(false);
    }
  };

  const createSupplier = async (name: string, email: string) => {
    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuppliers(prev => [...prev, result]);
        setSelectedSupplier(result.id);
        setShowSupplierModal(false);
        alert(`Supplier "${name}" created successfully!`);
        return true;
      } else {
        console.error('Supplier creation failed:', result);
        alert(result.error || 'Failed to create supplier. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('Error creating supplier:', error);
      alert('Network error. Please check your connection and try again.');
      return false;
    }
  };

  const handleExport = async (format: string = 'excel') => {
    try {
      const response = await fetch(`/api/export?format=${format}&category=${categoryFilter}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `price-comparison-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const openSupplierCard = async (supplier: Supplier) => {
    try {
      setSelectedSupplierCard(supplier);
      setIsEditingSupplier(false);
      setEditingSupplierData(null);
      const response = await fetch(`/api/suppliers/${supplier.id}/products`);
      if (response.ok) {
        const data = await response.json();
        setSupplierDetails(data.supplier);
        setSupplierProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching supplier products:', error);
    }
  };

  const startEditingSupplier = () => {
    setIsEditingSupplier(true);
    setEditingSupplierData({
      name: supplierDetails?.name || '',
      email: supplierDetails?.email || '',
      phone: supplierDetails?.phone || '',
      address: supplierDetails?.address || ''
    });
  };

  const cancelEditingSupplier = () => {
    setIsEditingSupplier(false);
    setEditingSupplierData(null);
  };

  const saveSupplierChanges = async () => {
    if (!selectedSupplierCard || !editingSupplierData) return;

    // Validate required fields
    if (!editingSupplierData.name || editingSupplierData.name.trim().length === 0) {
      alert('Supplier name is required');
      return;
    }

    // Validate email format if provided
    if (editingSupplierData.email && editingSupplierData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editingSupplierData.email.trim())) {
        alert('Please enter a valid email address');
        return;
      }
    }

    try {
      const response = await fetch(`/api/suppliers/${selectedSupplierCard.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingSupplierData),
      });

      if (response.ok) {
        const updatedSupplier = await response.json();
        
        // Update local state
        setSupplierDetails(updatedSupplier);
        setSuppliers(prev => prev.map(s => 
          s.id === selectedSupplierCard.id 
            ? { 
                ...s, 
                name: updatedSupplier.name, 
                email: updatedSupplier.email,
                phone: updatedSupplier.phone,
                address: updatedSupplier.address 
              }
            : s
        ));
        setSelectedSupplierCard(prev => 
          prev ? { 
            ...prev, 
            name: updatedSupplier.name, 
            email: updatedSupplier.email,
            phone: updatedSupplier.phone,
            address: updatedSupplier.address 
          } : null
        );
        
        setIsEditingSupplier(false);
        setEditingSupplierData(null);
        alert('Supplier information updated successfully!');
        
        // Refresh data to ensure consistency
        await fetchData();
      } else {
        const errorData = await response.json();
        alert('Error: ' + (errorData.error || 'Failed to update supplier information'));
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
      alert('Network error. Please check your connection and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Supplier Price Comparison</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a 
                href="/admin"
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium relative"
              >
                Admin Panel
                {pendingUploadsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingUploadsCount > 9 ? '9+' : pendingUploadsCount}
                  </span>
                )}
              </a>
              <button 
                onClick={() => setShowSupplierModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Add Supplier
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* File Upload Section */}
        <div className="mb-8 px-4 sm:px-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upload Price Lists</h2>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="mx-auto max-w-md">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Drag and drop your price lists here, or{' '}
                  <label htmlFor="file-upload" className="cursor-pointer text-blue-600 hover:text-blue-500">
                    browse files
                  </label>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  PDF, Excel, CSV, Images up to 10MB each
                </p>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Selected Files:</h3>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                      <button
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Supplier (Optional)
                    </label>
                    <div className="flex gap-2">
                      <select 
                        value={selectedSupplier} 
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                      >
                        <option value="">Let AI detect supplier from document...</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => setShowSupplierModal(true)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                      >
                        New
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {selectedSupplier 
                        ? "Files will be assigned to the selected supplier" 
                        : "AI will automatically detect and create/match suppliers from your documents"
                      }
                    </p>
                  </div>
                  
                  {/* AI-powered extraction is always enabled */}
                  {!selectedSupplier && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        AI-powered extraction enabled
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Active
                      </span>
                    </div>
                  )}
                  
                  <button 
                    onClick={handleUpload}
                    disabled={uploading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium w-full"
                  >
                    {uploading ? 'Processing...' : 'AI Process Files'}
                  </button>
                  
                  {/* Upload Status */}
                  {uploadStatus && (
                    <div className={`mt-2 p-2 rounded text-sm text-center ${
                      uploadStatus.includes('Error') 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        : uploadStatus.includes('Success') 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {uploadStatus}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 px-4 sm:px-0">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">P</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Products</dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.products.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">S</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Suppliers</dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.suppliers}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>


          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">U</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Last Update</dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">{stats.lastUpdate}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-emerald-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">$</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">AI Cost</dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">{tokenUsage.totalCostFormatted}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Uploads Section */}
        {recentUploads.length > 0 && (
          <div className="mb-8 px-4 sm:px-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Recent Uploads</h2>
              <div className="space-y-3">
                {recentUploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {upload.originalName}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          upload.status === 'completed' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : upload.status === 'processing'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : upload.status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {upload.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {upload.supplier.name} • {upload._count.prices} products • {new Date(upload.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Product Search Section */}
        <div className="mb-8 px-4 sm:px-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Search Products</h2>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, category, or supplier name..."
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Searching for: <span className="font-medium">&quot;{searchQuery}&quot;</span>
                {products.length > 0 && (
                  <span> - Found {products.length} results</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Price Comparison Table */}
        <div className="px-4 sm:px-0">
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Price Comparison</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                    Compare prices across all suppliers for optimal purchasing decisions.
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Showing {products.length} of {stats.products} total products
                    {categoryFilter !== 'All Categories' && ` in ${categoryFilter}`}
                    {debouncedSearchQuery && ` matching "${debouncedSearchQuery}"`}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option>All Categories</option>
                    <option>Vegetables</option>
                    <option>Meat</option>
                    <option>Seafood</option>
                    <option>Grains</option>
                    <option>Dairy</option>
                    <option>Other</option>
                  </select>
                  <select 
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortBy(field);
                      setSortOrder(order as 'asc' | 'desc');
                    }}
                    className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="category-asc">Category A-Z</option>
                    <option value="category-desc">Category Z-A</option>
                    <option value="price-asc">Price Low-High</option>
                    <option value="price-desc">Price High-Low</option>
                    <option value="suppliers-desc">Most Suppliers</option>
                    <option value="suppliers-asc">Fewest Suppliers</option>
                  </select>
                  <select 
                    value={productsPerPage}
                    onChange={(e) => setProductsPerPage(Number(e.target.value))}
                    className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={200}>200 per page</option>
                    <option value={500}>500 per page</option>
                    <option value={1000}>Show All</option>
                  </select>
                  <div className="relative">
                    <button 
                      onClick={() => handleExport('excel')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Export
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Product</span>
                        <span className="text-sm">{getSortIcon('name')}</span>
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Category</span>
                        <span className="text-sm">{getSortIcon('category')}</span>
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('unit')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Unit</span>
                        <span className="text-sm">{getSortIcon('unit')}</span>
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Best Price</span>
                        <span className="text-sm">{getSortIcon('price')}</span>
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('suppliers')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Suppliers</span>
                        <span className="text-sm">{getSortIcon('suppliers')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Price Range
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Loading products...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No products found. Upload some price lists to get started.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => setSelectedProduct(product)}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{product.standardizedName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{product.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{product.unit}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.priceComparison.bestPrice ? (
                            <>
                              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                                {formatCurrency(product.priceComparison.bestPrice.amount)}
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const supplier = suppliers.find(s => s.name === product.priceComparison.bestPrice?.supplier);
                                  if (supplier) openSupplierCard(supplier);
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {product.priceComparison.bestPrice.supplier}
                              </button>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400">No prices</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {product.priceComparison.supplierCount} suppliers
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.priceComparison.priceRange ? (
                            <div className="text-sm text-gray-900 dark:text-white">
                              {formatCurrency(product.priceComparison.priceRange.min)} - {formatCurrency(product.priceComparison.priceRange.max)}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400">-</div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Showing page <span className="font-medium">{currentPage}</span> of{' '}
                      <span className="font-medium">{totalPages}</span>
                      {productsPerPage < 1000 && (
                        <span> ({productsPerPage} products per page)</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        ←
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === pageNum
                                ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        →
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add New Supplier</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('name') as string;
                const email = formData.get('email') as string;
                if (name) {
                  createSupplier(name, email);
                }
              }}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter supplier name"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter email address"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(false)}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Supplier
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">{selectedProduct.standardizedName}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Original name: {selectedProduct.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Category: {selectedProduct.category}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Unit: {selectedProduct.unit}</p>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Price Overview */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Price Overview</h4>
                  
                  {selectedProduct.priceComparison.bestPrice && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Best Price:</span>
                        <span className="text-lg font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(selectedProduct.priceComparison.bestPrice.amount)}
                        </span>
                      </div>
                      
                      {selectedProduct.priceComparison.highestPrice && selectedProduct.priceComparison.supplierCount > 1 && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Highest Price:</span>
                            <span className="text-lg font-medium text-red-600 dark:text-red-400">
                              {formatCurrency(selectedProduct.priceComparison.highestPrice.amount)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Potential Savings:</span>
                            <span className="text-lg font-medium text-blue-600 dark:text-blue-400">
                              {selectedProduct.priceComparison.savings}%
                            </span>
                          </div>
                        </>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Available from:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedProduct.priceComparison.supplierCount} supplier{selectedProduct.priceComparison.supplierCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Supplier Prices */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Supplier Prices</h4>
                  
                  {selectedProduct.prices && selectedProduct.prices.length > 0 ? (
                    <div className="space-y-3">
                      {selectedProduct.prices
                        .sort((a, b) => Number(a.amount) - Number(b.amount))
                        .map((price, index) => (
                          <div key={price.id || index} className="p-3 bg-white dark:bg-gray-600 rounded-md">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const supplier = suppliers.find(s => s.name === price.supplier?.name);
                                    if (supplier) {
                                      setSelectedProduct(null);
                                      openSupplierCard(supplier);
                                    }
                                  }}
                                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                                >
                                  {price.supplier?.name || 'Unknown Supplier'}
                                </button>
                                <p className="text-xs text-gray-500 dark:text-gray-400">per {price.unit}</p>
                              </div>
                              <div className="text-right">
                                <p className={`font-medium ${index === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                  {formatCurrency(Number(price.amount))}
                                </p>
                                {index === 0 && (
                                  <p className="text-xs text-green-600 dark:text-green-400">Best Price</p>
                                )}
                              </div>
                            </div>
                            {/* Supplier's original name and update date */}
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-500">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Supplier calls it:</span> {price.product?.rawName || price.product?.name || selectedProduct.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span className="font-medium">Last updated:</span> {new Date(price.updatedAt || price.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No price information available</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Card Modal */}
      {selectedSupplierCard && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-5xl shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  {isEditingSupplier ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Supplier Name *
                        </label>
                        <input
                          type="text"
                          value={editingSupplierData?.name || ''}
                          onChange={(e) => setEditingSupplierData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter supplier name"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editingSupplierData?.email || ''}
                            onChange={(e) => setEditingSupplierData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Enter email address"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={editingSupplierData?.phone || ''}
                            onChange={(e) => setEditingSupplierData(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Enter phone number"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Address
                        </label>
                        <textarea
                          value={editingSupplierData?.address || ''}
                          onChange={(e) => setEditingSupplierData(prev => ({ ...prev, address: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter full address"
                        />
                      </div>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={saveSupplierChanges}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={cancelEditingSupplier}
                          className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-xl font-medium text-gray-900 dark:text-white">{selectedSupplierCard.name}</h3>
                        <button
                          onClick={startEditingSupplier}
                          className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 px-3 py-1 rounded-md text-sm font-medium transition-colors"
                          title="Edit supplier information"
                        >
                          Edit Information
                        </button>
                      </div>
                      
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <span className="text-yellow-400 text-sm">!</span>
                          </div>
                          <div className="ml-2">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              <strong>Note:</strong> This information was automatically extracted from documents. 
                              Click "Edit Information" to correct any errors or add missing details.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          {supplierDetails?.email ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <span className="font-medium">Email:</span> {supplierDetails.email}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mb-1 italic">
                              <span className="font-medium">Email:</span> Not provided
                            </p>
                          )}
                          {supplierDetails?.phone ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <span className="font-medium">Phone:</span> {supplierDetails.phone}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mb-1 italic">
                              <span className="font-medium">Phone:</span> Not provided
                            </p>
                          )}
                          {supplierDetails?.address ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <span className="font-medium">Address:</span> {supplierDetails.address}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mb-1 italic">
                              <span className="font-medium">Address:</span> Not provided
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            <span className="font-medium">Products:</span> {supplierProducts.length}
                          </p>
                          {supplierDetails?.createdAt && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <span className="font-medium">In database since:</span> {new Date(supplierDetails.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    setSelectedSupplierCard(null);
                    setSupplierProducts([]);
                    setSupplierDetails(null);
                    setIsEditingSupplier(false);
                    setEditingSupplierData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-4"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">All Products from {selectedSupplierCard.name}</h4>
                
                {supplierProducts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                      <thead className="bg-gray-100 dark:bg-gray-600">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Unit
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Competition
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Last Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {supplierProducts.map((product) => (
                          <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div>
                                <button
                                  onClick={async () => {
                                    try {
                                      // Fetch full product details with all suppliers
                                      const response = await fetch(`/api/products/${product.id}`);
                                      if (response.ok) {
                                        const fullProduct = await response.json();
                                        setSelectedSupplierCard(null);
                                        setSupplierProducts([]);
                                        setSupplierDetails(null);
                                        setSelectedProduct(fullProduct);
                                      }
                                    } catch (error) {
                                      console.error('Error fetching product details:', error);
                                    }
                                  }}
                                  className="text-left w-full"
                                >
                                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                    {product.standardizedName}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {product.name}
                                  </div>
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {product.category}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {product.unit}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatCurrency(product.price.amount)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                per {product.price.unit}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {product.totalSuppliers} supplier{product.totalSuppliers !== 1 ? 's' : ''}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {new Date(product.price.updatedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading products...</p>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedSupplierCard(null);
                    setSupplierProducts([]);
                    setSupplierDetails(null);
                  }}
                  className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
