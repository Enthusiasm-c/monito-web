'use client';

import React, { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string | number | null;
  type?: 'text' | 'number' | 'email' | 'tel';
  placeholder?: string;
  onSave: (newValue: string | number) => Promise<void> | void;
  onCancel?: () => void;
  disabled?: boolean;
  validation?: (value: string | number) => string | null; // Return error message or null
  formatDisplay?: (value: string | number | null) => string;
  className?: string;
}

export function EditableCell({
  value,
  type = 'text',
  placeholder,
  onSave,
  onCancel,
  disabled = false,
  validation,
  formatDisplay,
  className = ''
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format value for display
  const displayValue = formatDisplay 
    ? formatDisplay(value) 
    : (value?.toString() || '');

  // Start editing
  const startEditing = () => {
    if (disabled) return;
    
    setIsEditing(true);
    setEditValue(value?.toString() || '');
    setError(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditValue('');
    setError(null);
    onCancel?.();
  };

  // Save changes
  const saveChanges = async () => {
    setError(null);

    // Validate input
    if (validation) {
      const validationError = validation(type === 'number' ? Number(editValue) : editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Check if value actually changed
    const newValue = type === 'number' ? Number(editValue) : editValue;
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveChanges();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="relative">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSaving}
            className={`
              px-2 py-1 text-sm border rounded
              ${error 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
              }
              focus:outline-none focus:ring-1
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${className}
            `}
          />
          
          {/* Save/Cancel buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={saveChanges}
              disabled={isSaving}
              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
              title="Save (Enter)"
            >
              {isSaving ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            
            <button
              onClick={cancelEditing}
              disabled={isSaving}
              className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
              title="Cancel (Esc)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="absolute top-full left-0 mt-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 z-10">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Display mode
  return (
    <div
      onClick={startEditing}
      className={`
        group cursor-pointer px-2 py-1 rounded transition-colors
        ${disabled 
          ? 'cursor-not-allowed text-gray-400' 
          : 'hover:bg-gray-50 hover:border hover:border-gray-200'
        }
        ${className}
      `}
      title={disabled ? 'Cannot edit this field' : 'Click to edit'}
    >
      <div className="flex items-center justify-between">
        <span className={displayValue ? 'text-gray-900' : 'text-gray-400'}>
          {displayValue || placeholder || 'Click to edit'}
        </span>
        
        {!disabled && (
          <svg className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )}
      </div>
    </div>
  );
}

// Specialized components for different data types
export function EditablePriceCell({ value, onSave, ...props }: Omit<EditableCellProps, 'type' | 'formatDisplay' | 'validation'>) {
  return (
    <EditableCell
      {...props}
      value={value}
      type="number"
      onSave={onSave}
      formatDisplay={(val) => val ? `IDR ${Number(val).toLocaleString()}` : ''}
      validation={(val) => {
        const num = Number(val);
        if (isNaN(num) || num < 0) return 'Price must be a positive number';
        if (num > 999999999) return 'Price too large';
        return null;
      }}
    />
  );
}

export function EditableEmailCell({ value, onSave, ...props }: Omit<EditableCellProps, 'type' | 'validation'>) {
  return (
    <EditableCell
      {...props}
      value={value}
      type="email"
      onSave={onSave}
      validation={(val) => {
        const email = val.toString();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return 'Invalid email format';
        }
        return null;
      }}
    />
  );
}

export function EditablePhoneCell({ value, onSave, ...props }: Omit<EditableCellProps, 'type' | 'validation'>) {
  return (
    <EditableCell
      {...props}
      value={value}
      type="tel"
      onSave={onSave}
      validation={(val) => {
        const phone = val.toString();
        if (phone && !/^[\+]?[\d\s\-\(\)]{7,20}$/.test(phone)) {
          return 'Invalid phone number format';
        }
        return null;
      }}
    />
  );
}