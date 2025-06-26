'use client';

import React, { useState } from 'react';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  title: string;
  description: string;
  itemCount?: number;
  itemType?: string;
  destructive?: boolean;
}

export function BulkDeleteModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title,
  description,
  itemCount,
  itemType = 'items',
  destructive = true 
}: BulkDeleteModalProps) {
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const confirmationPhrase = 'DELETE';
  const isConfirmationValid = confirmText === confirmationPhrase;

  const handleConfirm = async () => {
    if (!isConfirmationValid) return;
    
    setIsDeleting(true);
    try {
      await onConfirm(reason || undefined);
      handleClose();
    } catch (error) {
      console.error('Delete operation failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setConfirmText('');
    setIsDeleting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        ></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="sm:flex sm:items-start">
            {/* Warning icon */}
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${
              destructive ? 'bg-red-100' : 'bg-yellow-100'
            } sm:mx-0 sm:h-10 sm:w-10`}>
              {destructive ? (
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>

            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {title}
              </h3>
              
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {description}
                </p>
                
                {itemCount && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium text-gray-900">
                      This will delete {itemCount.toLocaleString()} {itemType}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      This action cannot be undone.
                    </p>
                  </div>
                )}

                {/* Reason input */}
                <div className="mt-4">
                  <label htmlFor="delete-reason" className="block text-sm font-medium text-gray-700">
                    Reason for deletion (optional)
                  </label>
                  <textarea
                    id="delete-reason"
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    placeholder="Explain why you're deleting these items..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                {/* Confirmation input */}
                <div className="mt-4">
                  <label htmlFor="confirm-text" className="block text-sm font-medium text-gray-700">
                    Type <span className="font-mono bg-gray-100 px-1 rounded">{confirmationPhrase}</span> to confirm
                  </label>
                  <input
                    id="confirm-text"
                    type="text"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    placeholder={confirmationPhrase}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isConfirmationValid || isDeleting}
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                !isConfirmationValid || isDeleting
                  ? 'bg-gray-300 cursor-not-allowed'
                  : destructive
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
              }`}
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </div>
              ) : (
                `Delete ${itemCount ? itemCount.toLocaleString() : ''} ${itemType}`
              )}
            </button>
            
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Success modal for after deletion
interface DeleteSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedCount: number;
  itemType: string;
  operationId?: string;
}

export function DeleteSuccessModal({ 
  isOpen, 
  onClose, 
  deletedCount, 
  itemType,
  operationId 
}: DeleteSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full sm:p-6">
          <div className="text-center">
            {/* Success icon */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h3 className="mt-4 text-lg leading-6 font-medium text-gray-900">
              Deletion Successful
            </h3>
            
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Successfully deleted {deletedCount.toLocaleString()} {itemType}.
              </p>
              
              {operationId && (
                <p className="text-xs text-gray-400 mt-2">
                  Operation ID: {operationId}
                </p>
              )}
            </div>
            
            <div className="mt-5">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:text-sm"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}