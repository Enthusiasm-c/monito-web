'use client';

import { useState, useEffect } from 'react';
import { FileViewer } from '../components/FileViewer';
import { DataComparison } from '../components/DataComparison';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

interface Upload {
  id: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
  completenessRatio: number;
  processingCostUsd: number;
  totalRowsDetected: number;
  totalRowsProcessed: number;
  estimatedProductsCount: number;
  extractedProducts: any[];
  supplier: {
    id: string;
    name: string;
    email: string;
  };
  url?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function UploadsManagement() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  const fetchUploads = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/uploads/pending?page=${page}&limit=${pagination.limit}`);
      const data = await response.json();
      
      if (response.ok) {
        setUploads(data.uploads || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      } else {
        console.error('Failed to fetch uploads:', data.error);
      }
    } catch (error) {
      console.error('Error fetching uploads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleApprove = async (uploadId: string) => {
    if (approving) return;
    
    try {
      setApproving(uploadId);
      
      const response = await fetch('/api/admin/uploads/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId,
          approvedBy: 'Admin User',
          reviewNotes: 'Approved via admin interface'
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploads(prev => prev.filter(upload => upload.id !== uploadId));
        alert(`Upload approved successfully! Created ${result.productsCreated} products.`);
      } else {
        alert(`Failed to approve upload: ${result.error}`);
      }
    } catch (error) {
      console.error('Error approving upload:', error);
      alert('Error approving upload. Please try again.');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (uploadId: string) => {
    const confirmed = confirm('Are you sure you want to reject this upload?');
    if (!confirmed) return;

    try {
      setRejecting(uploadId);
      
      const response = await fetch('/api/admin/uploads/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId,
          rejectedBy: 'Admin User',
          rejectionReason: 'Rejected via admin interface'
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploads(prev => prev.filter(upload => upload.id !== uploadId));
        alert('Upload rejected successfully.');
      } else {
        alert(`Failed to reject upload: ${result.error}`);
      }
    } catch (error) {
      console.error('Error rejecting upload:', error);
      alert('Error rejecting upload. Please try again.');
    } finally {
      setRejecting(null);
    }
  };

  const handlePreview = (upload: Upload) => {
    setSelectedUpload(upload);
    setShowPreview(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Review' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
      processing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Processing' }
    };
    
    const config = statusMap[status as keyof typeof statusMap] || 
      { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (showPreview && selectedUpload) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Preview Upload: {selectedUpload.originalName}
                </h1>
                <p className="text-sm text-gray-600">
                  Supplier: {selectedUpload.supplier.name} • 
                  {selectedUpload.estimatedProductsCount} products detected
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleApprove(selectedUpload.id)}
                  disabled={approving === selectedUpload.id}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {approving === selectedUpload.id ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReject(selectedUpload.id)}
                  disabled={rejecting === selectedUpload.id}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {rejecting === selectedUpload.id ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Back to List
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[80vh]">
            {/* Left Panel - Original File */}
            <FileViewer
              fileUrl={selectedUpload.url || `/api/admin/uploads/${selectedUpload.id}/file`}
              fileName={selectedUpload.originalName}
              mimeType={selectedUpload.mimeType}
              className="h-full"
            />
            
            {/* Right Panel - Extracted Data */}
            <DataComparison
              extractedProducts={selectedUpload.extractedProducts || []}
              fileName={selectedUpload.originalName}
              className="h-full"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Upload Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Review and approve pending uploads from suppliers
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
                  <dd className="text-lg font-medium text-gray-900">{pagination.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Products</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {uploads.reduce((sum, upload) => sum + (upload.estimatedProductsCount || 0), 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Completeness</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {uploads.length > 0 ? 
                      Math.round(uploads.reduce((sum, upload) => sum + (upload.completenessRatio || 0), 0) / uploads.length * 100) + '%'
                      : '0%'
                    }
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Processing Cost</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${uploads.reduce((sum, upload) => sum + (upload.processingCostUsd || 0), 0).toFixed(3)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Uploads Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Pending Uploads ({pagination.total})
            </h3>
            <button
              onClick={() => fetchUploads(pagination.page)}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-2 text-gray-600">Loading uploads...</span>
          </div>
        ) : uploads.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.712-3.714M14 40v-4a9.971 9.971 0 01.712-3.714M28 20a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pending uploads</h3>
            <p className="mt-1 text-sm text-gray-500">All uploads have been processed or reviewed.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {uploads.map((upload) => (
              <li key={upload.id} className="px-4 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {upload.originalName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {upload.supplier.name} • {formatFileSize(upload.fileSize)} • 
                            {upload.estimatedProductsCount} products
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(upload.approvalStatus)}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span>
                          Uploaded {new Date(upload.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {upload.completenessRatio && (
                          <span className="ml-4">
                            Completeness: {Math.round(upload.completenessRatio * 100)}%
                          </span>
                        )}
                        {upload.processingCostUsd && (
                          <span className="ml-4">
                            Cost: ${upload.processingCostUsd.toFixed(3)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handlePreview(upload)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleApprove(upload.id)}
                      disabled={approving === upload.id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      {approving === upload.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(upload.id)}
                      disabled={rejecting === upload.id}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      {rejecting === upload.id ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => fetchUploads(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchUploads(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination.page}</span> of{' '}
                  <span className="font-medium">{pagination.pages}</span> ({pagination.total} total uploads)
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => fetchUploads(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchUploads(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}