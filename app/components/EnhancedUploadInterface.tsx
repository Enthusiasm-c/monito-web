'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { XMarkIcon, DocumentIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';

interface FileUploadItem {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  detailedProgress?: {
    totalProducts?: number;
    processedProducts?: number;
    extractedData?: any;
    errors?: string[];
  };
  supplierId?: string;
  uploadId?: string;
  startTime?: number;
  endTime?: number;
}

interface Props {
  suppliers: Array<{ id: string; name: string }>;
  onUploadComplete?: () => void;
}

export default function EnhancedUploadInterface({ suppliers, onUploadComplete }: Props) {
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
  const [activeUploads, setActiveUploads] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  const MAX_PARALLEL_UPLOADS = 3;

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  // Handle file selection
  const handleFiles = (files: FileList) => {
    const newFiles = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'queued' as const,
      progress: 0,
      currentStep: 'Waiting in queue...',
      supplierId: selectedSupplier,
      startTime: Date.now()
    }));
    
    setUploadQueue(prev => [...prev, ...newFiles]);
  };

  // Process upload queue
  useEffect(() => {
    const processQueue = async () => {
      // Find items that are queued and we have capacity to process
      const queuedItems = uploadQueue.filter(item => item.status === 'queued');
      const availableSlots = MAX_PARALLEL_UPLOADS - activeUploads;
      
      if (queuedItems.length === 0 || availableSlots <= 0) return;
      
      // Start processing items up to available slots
      const itemsToProcess = queuedItems.slice(0, availableSlots);
      
      itemsToProcess.forEach(item => {
        processUpload(item);
      });
    };
    
    processQueue();
  }, [uploadQueue, activeUploads]);

  // Process individual upload
  const processUpload = async (item: FileUploadItem) => {
    // Update status to uploading
    updateUploadItem(item.id, { 
      status: 'uploading', 
      currentStep: 'Uploading file...',
      progress: 10 
    });
    
    setActiveUploads(prev => prev + 1);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', item.file);
      if (item.supplierId) {
        formData.append('supplierId', item.supplierId);
      }
      formData.append('autoApprove', autoApprove.toString());

      // Start SSE connection for real-time updates
      const uploadId = await initiateUpload(formData);
      
      if (uploadId) {
        updateUploadItem(item.id, { uploadId });
        
        // Connect to SSE stream
        const eventSource = new EventSource(`/api/admin/uploads/status/${uploadId}/stream`);
        
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleProgressUpdate(item.id, data);
        };
        
        eventSource.onerror = () => {
          eventSource.close();
          updateUploadItem(item.id, { 
            status: 'failed', 
            currentStep: 'Connection lost',
            endTime: Date.now()
          });
          setActiveUploads(prev => prev - 1);
        };
        
        // Also do the actual file processing
        await processFile(item, formData);
      }
    } catch (error) {
      updateUploadItem(item.id, { 
        status: 'failed', 
        currentStep: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        endTime: Date.now()
      });
      setActiveUploads(prev => prev - 1);
    }
  };

  // Initiate upload and get upload ID
  const initiateUpload = async (formData: FormData): Promise<string | null> => {
    try {
      const response = await fetch('/api/async-upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to initiate upload');
      
      const data = await response.json();
      return data.uploadId;
    } catch (error) {
      console.error('Failed to initiate upload:', error);
      return null;
    }
  };

  // Process file with detailed progress
  const processFile = async (item: FileUploadItem, formData: FormData) => {
    try {
      updateUploadItem(item.id, { 
        status: 'processing',
        currentStep: 'Processing file with AI...',
        progress: 30
      });

      const response = await fetch('/api/upload-unified', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      const result = await response.json();
      
      updateUploadItem(item.id, {
        status: 'completed',
        currentStep: 'Upload completed successfully!',
        progress: 100,
        detailedProgress: {
          totalProducts: result.products?.length || 0,
          processedProducts: result.products?.length || 0,
          extractedData: result
        },
        endTime: Date.now()
      });
      
      setActiveUploads(prev => prev - 1);
      
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      throw error;
    }
  };

  // Handle progress updates from SSE
  const handleProgressUpdate = (itemId: string, data: any) => {
    const progressMap: Record<string, number> = {
      'upload': 20,
      'validation': 30,
      'extraction': 50,
      'ai_processing': 70,
      'standardization': 80,
      'storage': 90,
      'completed': 100
    };
    
    const progress = progressMap[data.step] || 0;
    
    updateUploadItem(itemId, {
      currentStep: data.message || 'Processing...',
      progress,
      detailedProgress: {
        ...data.details,
        errors: data.error ? [data.error] : undefined
      }
    });
    
    if (data.status === 'completed') {
      updateUploadItem(itemId, {
        status: 'completed',
        endTime: Date.now()
      });
      setActiveUploads(prev => prev - 1);
    } else if (data.status === 'error') {
      updateUploadItem(itemId, {
        status: 'failed',
        endTime: Date.now()
      });
      setActiveUploads(prev => prev - 1);
    }
  };

  // Update upload item
  const updateUploadItem = (id: string, updates: Partial<FileUploadItem>) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  // Remove upload item
  const removeUploadItem = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  // Toggle details view
  const toggleDetails = (id: string) => {
    setShowDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Format time duration
  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime) return '';
    const end = endTime || Date.now();
    const duration = Math.floor((end - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  // Get status color
  const getStatusColor = (status: FileUploadItem['status']) => {
    switch (status) {
      case 'queued': return 'text-gray-500';
      case 'uploading': return 'text-blue-500';
      case 'processing': return 'text-yellow-500';
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Enhanced File Upload System
        </h2>
        
        {/* Settings */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Supplier (Optional)
            </label>
            <select 
              value={selectedSupplier} 
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">Let AI detect supplier...</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Auto-approve uploads
              </span>
            </label>
          </div>
        </div>
        
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Drag and drop files here, or{' '}
            <label htmlFor="enhanced-file-upload" className="cursor-pointer text-blue-600 hover:text-blue-500">
              browse files
            </label>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            PDF, Excel, CSV, Images • Multiple files supported • Up to 20 files in parallel
          </p>
          <input
            id="enhanced-file-upload"
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Upload Queue ({uploadQueue.length} files)
            </h3>
            <div className="text-sm text-gray-500">
              Active: {activeUploads}/{MAX_PARALLEL_UPLOADS}
            </div>
          </div>
          
          <div className="space-y-3">
            {uploadQueue.map((item) => (
              <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <DocumentIcon className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                          {item.supplierId && ` • ${suppliers.find(s => s.id === item.supplierId)?.name}`}
                          {item.startTime && ` • ${formatDuration(item.startTime, item.endTime)}`}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
                          {item.currentStep}
                        </span>
                        <span className="text-sm text-gray-500">{item.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            item.status === 'failed' ? 'bg-red-600' :
                            item.status === 'completed' ? 'bg-green-600' :
                            'bg-blue-600'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Detailed Progress */}
                    {item.detailedProgress && (item.status === 'processing' || item.status === 'completed') && (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleDetails(item.id)}
                          className="text-xs text-blue-600 hover:text-blue-500"
                        >
                          {showDetails[item.id] ? 'Hide' : 'Show'} details
                        </button>
                        
                        {showDetails[item.id] && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                            {item.detailedProgress.totalProducts !== undefined && (
                              <p>Products found: {item.detailedProgress.totalProducts}</p>
                            )}
                            {item.detailedProgress.processedProducts !== undefined && (
                              <p>Products processed: {item.detailedProgress.processedProducts}</p>
                            )}
                            {item.detailedProgress.errors && item.detailedProgress.errors.length > 0 && (
                              <div className="mt-2 text-red-600">
                                Errors:
                                {item.detailedProgress.errors.map((error, i) => (
                                  <p key={i}>• {error}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="ml-4 flex items-center space-x-2">
                    {item.status === 'completed' && (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    )}
                    {item.status === 'failed' && (
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                    {(item.status === 'completed' || item.status === 'failed') && (
                      <button
                        onClick={() => removeUploadItem(item.id)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}