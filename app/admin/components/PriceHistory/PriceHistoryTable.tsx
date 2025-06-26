'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';

interface PriceHistoryEntry {
  id: string;
  price: number;
  unit: string;
  unitPrice?: number;
  quantity?: number;
  changedFrom?: number;
  changePercentage?: number;
  changeReason: string;
  changedBy?: string;
  notes?: string;
  createdAt: Date;
  supplier?: {
    id: string;
    name: string;
  };
  upload?: {
    id: string;
    originalName: string;
  };
}

interface PriceHistoryTableProps {
  data: PriceHistoryEntry[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function PriceHistoryTable({ 
  data, 
  loading = false, 
  onLoadMore,
  hasMore = false 
}: PriceHistoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getChangeReasonBadge = (reason: string) => {
    const colors = {
      upload: 'bg-blue-100 text-blue-800',
      manual: 'bg-green-100 text-green-800',
      api: 'bg-purple-100 text-purple-800',
      initial: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[reason as keyof typeof colors] || colors.initial
      }`}>
        {reason.charAt(0).toUpperCase() + reason.slice(1).replace('_', ' ')}
      </span>
    );
  };

  const getChangeIcon = (changePercentage?: number) => {
    if (!changePercentage) return null;
    
    if (changePercentage > 0) {
      return (
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Price History</h3>
        </div>
        <div className="animate-pulse">
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

  if (data.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Price History</h3>
        </div>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No price history</h3>
          <p className="mt-1 text-sm text-gray-500">
            Price changes will appear here as they happen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Price History ({data.length} entries)
        </h3>
      </div>
      
      <div className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price Change
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Changed By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">
                        {format(new Date(entry.createdAt), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {format(new Date(entry.createdAt), 'HH:mm:ss')}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          IDR {entry.price.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {entry.unit}
                        </div>
                      </div>
                      
                      {entry.changePercentage && (
                        <div className="flex items-center space-x-1">
                          {getChangeIcon(entry.changePercentage)}
                          <span className={`text-xs font-medium ${
                            entry.changePercentage > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {entry.changePercentage > 0 ? '+' : ''}{entry.changePercentage.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {entry.changedFrom && (
                      <div className="text-xs text-gray-500 mt-1">
                        From: IDR {entry.changedFrom.toLocaleString()}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.supplier?.name || 'Unknown'}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getChangeReasonBadge(entry.changeReason)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.changedBy || '-'}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => toggleRowExpansion(entry.id)}
                      className="text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                      {expandedRows.has(entry.id) ? 'Hide Details' : 'Show Details'}
                    </button>
                  </td>
                </tr>
                
                {/* Expanded row details */}
                {expandedRows.has(entry.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Additional Details</h4>
                          {entry.unitPrice && (
                            <div className="mb-2">
                              <span className="text-gray-600">Unit Price: </span>
                              <span className="font-medium">IDR {entry.unitPrice.toLocaleString()}</span>
                            </div>
                          )}
                          {entry.quantity && (
                            <div className="mb-2">
                              <span className="text-gray-600">Quantity: </span>
                              <span className="font-medium">{entry.quantity}</span>
                            </div>
                          )}
                          {entry.upload && (
                            <div className="mb-2">
                              <span className="text-gray-600">Source File: </span>
                              <span className="font-medium">{entry.upload.originalName}</span>
                            </div>
                          )}
                        </div>
                        
                        {entry.notes && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                            <p className="text-gray-600 text-sm bg-white p-3 rounded border">
                              {entry.notes}
                            </p>
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
        
        {/* Load more button */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-gray-200 text-center">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}