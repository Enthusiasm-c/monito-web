"use client";

import { useState, useEffect } from 'react';

interface PendingUpload {
  id: string;
  originalName: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  completenessRatio?: number;
  totalRowsDetected?: number;
  totalRowsProcessed?: number;
  estimatedProductsCount: number;
  extractedProducts: any[];
  supplier: {
    id: string;
    name: string;
    email?: string;
  };
  processingCostUsd?: number;
  tokensUsed?: number;
}

interface ApprovalModalData {
  upload: PendingUpload;
  action: 'approve' | 'reject';
}

export default function AdminPage() {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<PendingUpload | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [approvalModal, setApprovalModal] = useState<ApprovalModalData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [adminName, setAdminName] = useState('');

  // Load admin name from localStorage
  useEffect(() => {
    const savedAdminName = localStorage.getItem('adminName');
    if (savedAdminName) {
      setAdminName(savedAdminName);
    } else {
      const name = prompt('Enter your admin name:');
      if (name) {
        setAdminName(name);
        localStorage.setItem('adminName', name);
      }
    }
  }, []);

  const fetchPendingUploads = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/uploads/pending?page=${currentPage}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setPendingUploads(data.uploads);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching pending uploads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUploads();
  }, [currentPage]);

  const handleApprove = async (upload: PendingUpload, reviewNotes?: string) => {
    try {
      const response = await fetch('/api/uploads/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: upload.id,
          approvedBy: adminName,
          reviewNotes
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Upload approved! Created ${result.productsCreated} products.`);
        fetchPendingUploads();
        setApprovalModal(null);
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error approving upload:', error);
      alert('❌ Failed to approve upload');
    }
  };

  const handleReject = async (upload: PendingUpload, reason: string) => {
    try {
      const response = await fetch('/api/uploads/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: upload.id,
          rejectedBy: adminName,
          reason
        })
      });

      if (response.ok) {
        alert('✅ Upload rejected successfully');
        fetchPendingUploads();
        setApprovalModal(null);
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error rejecting upload:', error);
      alert('❌ Failed to reject upload');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                {pendingUploads.length} pending approval
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Admin: {adminName}
              </span>
              <a 
                href="/"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Back to Main
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Pending Uploads List */}
        <div className="px-4 sm:px-0">
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Pending Uploads for Review
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Review extracted data and approve or reject uploads before they are added to the database.
              </p>
            </div>

            {loading ? (
              <div className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                Loading pending uploads...
              </div>
            ) : pendingUploads.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <div className="text-gray-400 text-6xl mb-4">✅</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No uploads pending review
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  All uploads have been reviewed. New uploads will appear here for approval.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {pendingUploads.map((upload) => (
                  <div key={upload.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                                {upload.mimeType?.includes('pdf') ? '📄' : '📊'}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {upload.originalName}
                            </h4>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mt-1">
                              <div>Supplier: <span className="font-medium">{upload.supplier.name}</span></div>
                              <div>
                                File: {formatFileSize(upload.fileSize)} • 
                                Products: <span className="font-medium text-blue-600 dark:text-blue-400">{upload.estimatedProductsCount}</span> • 
                                Completeness: <span className="font-medium">{((upload.completenessRatio || 0) * 100).toFixed(1)}%</span>
                              </div>
                              <div>
                                Uploaded: {new Date(upload.createdAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                              {upload.processingCostUsd && (
                                <div>
                                  Processing cost: <span className="font-medium">${upload.processingCostUsd.toFixed(4)}</span> ({upload.tokensUsed} tokens)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUpload(upload);
                            setShowPreview(true);
                          }}
                          className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-medium"
                        >
                          👁️ Preview
                        </button>
                        <button
                          onClick={() => setApprovalModal({ upload, action: 'approve' })}
                          className="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 px-3 py-2 rounded-md text-sm font-medium"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => setApprovalModal({ upload, action: 'reject' })}
                          className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 px-3 py-2 rounded-md text-sm font-medium"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                      Page <span className="font-medium">{currentPage}</span> of{' '}
                      <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
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

      {/* Preview Modal */}
      {showPreview && selectedUpload && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                    Preview: {selectedUpload.originalName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Supplier: {selectedUpload.supplier.name} • 
                    {selectedUpload.estimatedProductsCount} products extracted
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setSelectedUpload(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Product Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {selectedUpload.extractedProducts.map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {product.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {product.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {product.category || 'Other'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setSelectedUpload(null);
                  }}
                  className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setApprovalModal({ upload: selectedUpload, action: 'approve' });
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                >
                  Approve This Upload
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setApprovalModal({ upload: selectedUpload, action: 'reject' });
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
                >
                  Reject This Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval/Rejection Modal */}
      {approvalModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {approvalModal.action === 'approve' ? '✅ Approve Upload' : '❌ Reject Upload'}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <strong>File:</strong> {approvalModal.upload.originalName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <strong>Supplier:</strong> {approvalModal.upload.supplier.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <strong>Products:</strong> {approvalModal.upload.estimatedProductsCount}
                </p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const notes = formData.get('notes') as string;
                
                if (approvalModal.action === 'approve') {
                  handleApprove(approvalModal.upload, notes);
                } else {
                  if (!notes.trim()) {
                    alert('Rejection reason is required');
                    return;
                  }
                  handleReject(approvalModal.upload, notes);
                }
              }}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {approvalModal.action === 'approve' ? 'Review Notes (Optional)' : 'Rejection Reason *'}
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    required={approvalModal.action === 'reject'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder={approvalModal.action === 'approve' 
                      ? 'Optional notes about this approval...' 
                      : 'Please explain why this upload is being rejected...'
                    }
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setApprovalModal(null)}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-md text-white ${
                      approvalModal.action === 'approve'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {approvalModal.action === 'approve' ? 'Approve' : 'Reject'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}