"use client";

import { useState, useEffect } from 'react';

interface Upload {
  id: string;
  originalName: string;
  status: string;
  errorMessage?: string;
  supplier: {
    name: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
  fileSize: number;
  mimeType: string;
  statusDetails: {
    description: string;
    color: string;
    icon: string;
  };
  processingTime: number;
  fileInfo: {
    name: string;
    size: string;
    type: string;
  };
}

interface UploadLogs {
  uploads: Upload[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    averageProcessingTime: number;
  };
}

export default function DebugPage() {
  const [logs, setLogs] = useState<UploadLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/upload-logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const testUpload = async () => {
    if (!testFile) return;

    setTesting(true);
    setTestResult(null);

    try {
      const formData = new FormData();
      formData.append('files', testFile);

      const response = await fetch('/api/upload-debug', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      setTestResult(result);
      
      // Refresh logs after test
      setTimeout(fetchLogs, 1000);
    } catch (error) {
      setTestResult({ error: 'Test failed', details: error });
    } finally {
      setTesting(false);
    }
  };

  const clearFailedUploads = async () => {
    try {
      const response = await fetch('/api/upload-logs?clearAll=true', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchLogs();
      }
    } catch (error) {
      console.error('Error clearing failed uploads:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading debug information...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          🔍 Upload Debug Dashboard
        </h1>

        {/* Test Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Upload</h2>
          <div className="space-y-4">
            <div>
              <input
                type="file"
                onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <button
              onClick={testUpload}
              disabled={!testFile || testing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium"
            >
              {testing ? 'Testing...' : 'Test Upload'}
            </button>
          </div>

          {testResult && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-2">Test Result:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Summary Section */}
        {logs && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Upload Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{logs.summary.total}</div>
                <div className="text-sm text-gray-600">Total Uploads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {logs.summary.byStatus.completed || 0}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {logs.summary.byStatus.failed || 0}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.round(logs.summary.averageProcessingTime / 1000)}s
                </div>
                <div className="text-sm text-gray-600">Avg Time</div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Logs */}
        {logs && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Upload Logs</h2>
              <div className="space-x-2">
                <button
                  onClick={fetchLogs}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm"
                >
                  Refresh
                </button>
                <button
                  onClick={clearFailedUploads}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm"
                >
                  Clear Failed
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Supplier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.uploads.map((upload) => (
                    <tr key={upload.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{upload.statusDetails.icon}</span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            upload.statusDetails.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            upload.statusDetails.color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            upload.statusDetails.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {upload.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {upload.fileInfo.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {upload.fileInfo.size} • {upload.fileInfo.type}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {upload.supplier.name}
                          </div>
                          {upload.supplier.email && (
                            <div className="text-sm text-gray-500">
                              {upload.supplier.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div>{new Date(upload.createdAt).toLocaleString()}</div>
                        <div>{Math.round(upload.processingTime / 1000)}s processing</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {upload.statusDetails.description}
                        </div>
                        {upload.errorMessage && (
                          <div className="text-sm text-red-600 mt-1">
                            {upload.errorMessage}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}