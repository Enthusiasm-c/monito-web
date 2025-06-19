"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileViewer } from '../components/FileViewer';
import { DataComparison } from '../components/DataComparison';

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

function PreviewPageContent() {
  const searchParams = useSearchParams();
  const uploadId = searchParams.get('id');
  const [upload, setUpload] = useState<PendingUpload | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!uploadId) {
      setError('Upload ID not provided');
      setLoading(false);
      return;
    }

    const fetchUploadData = async () => {
      try {
        setLoading(true);
        
        // Fetch upload details
        const uploadResponse = await fetch(`/api/uploads/pending?id=${uploadId}`);
        if (!uploadResponse.ok) {
          throw new Error('Failed to fetch upload details');
        }
        
        const uploadData = await uploadResponse.json();
        const foundUpload = uploadData.uploads?.find((u: PendingUpload) => u.id === uploadId);
        
        if (!foundUpload) {
          throw new Error('Upload not found');
        }
        
        setUpload(foundUpload);
        
        // Get file URL for preview
        const fileResponse = await fetch(`/api/uploads/${uploadId}/file`);
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          setFileUrl(fileData.fileUrl);
        } else {
          console.warn('Could not fetch file URL, using API endpoint as fallback');
          setFileUrl(`/api/uploads/${uploadId}/file`);
        }
        
      } catch (err) {
        console.error('Error fetching upload data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load upload data');
      } finally {
        setLoading(false);
      }
    };

    fetchUploadData();
  }, [uploadId]);

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApprove = async (reviewNotes?: string) => {
    if (!upload || isApproving) {
      console.error('No upload data available or already approving');
      return;
    }
    
    setIsApproving(true);
    console.log('Approving upload:', upload.id);
    
    try {
      const response = await fetch('/api/uploads/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: upload.id,
          approvedBy: 'Admin Preview',
          reviewNotes
        })
      });

      console.log('Approve response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Approve result:', result);
        alert(`Upload approved! Created ${result.productsCreated} products.`);
        window.close();
      } else {
        const error = await response.json();
        console.error('Approve error response:', error);
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error approving upload:', error);
      alert('Failed to approve upload');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!upload || isRejecting) return;
    
    setIsRejecting(true);
    try {
      const response = await fetch('/api/uploads/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: upload.id,
          rejectedBy: 'Admin Preview',
          reason: 'Rejected from preview window'
        })
      });

      if (response.ok) {
        alert('Upload rejected successfully');
        window.close();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error rejecting upload:', error);
      alert('Failed to reject upload');
    } finally {
      setIsRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error || !upload) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Upload not found'}</p>
          <button
            onClick={() => window.close()}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Preview: {upload.originalName}
              </h1>
              <p className="text-sm text-gray-500">
                Supplier: {upload.supplier.name} • {upload.estimatedProductsCount} products extracted
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleApprove()}
                disabled={isApproving || isRejecting}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isApproving || isRejecting
                    ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isApproving ? '⏳ Approving...' : '✓ Approve'}
              </button>
              <button
                onClick={handleReject}
                disabled={isApproving || isRejecting}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isApproving || isRejecting
                    ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isRejecting ? '⏳ Rejecting...' : '✗ Reject'}
              </button>
              <button
                onClick={() => window.close()}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Split View Content */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Left Panel - Original File */}
        <div className="flex-1 border-r border-gray-200">
          <FileViewer
            fileUrl={fileUrl}
            fileName={upload.originalName}
            mimeType={upload.mimeType || ''}
            className="h-full border-0 rounded-none"
          />
        </div>

        {/* Right Panel - Extracted Data */}
        <div className="flex-1">
          <DataComparison
            extractedProducts={upload.extractedProducts}
            fileName={upload.originalName}
            className="h-full border-0 rounded-none"
          />
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading preview...</p>
        </div>
      </div>
    }>
      <PreviewPageContent />
    </Suspense>
  );
}