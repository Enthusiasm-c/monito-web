'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LanguageEntry {
  id: string;
  sourceWord: string;
  targetWord: string;
  language: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

interface UnitEntry {
  id: string;
  sourceUnit: string;
  targetUnit: string;
  conversionFactor: number;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DictionariesPage() {
  const [activeTab, setActiveTab] = useState<'language' | 'unit'>('language');
  const [languageEntries, setLanguageEntries] = useState<LanguageEntry[]>([]);
  const [unitEntries, setUnitEntries] = useState<UnitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    sourceWord: '',
    targetWord: '',
    language: 'id',
    category: '',
    sourceUnit: '',
    targetUnit: '',
    conversionFactor: 1.0
  });

  useEffect(() => {
    fetchDictionaries();
  }, []);

  const fetchDictionaries = async () => {
    try {
      setLoading(true);
      const [langResponse, unitResponse] = await Promise.all([
        fetch('/api/admin/dictionaries?type=language'),
        fetch('/api/admin/dictionaries?type=unit')
      ]);

      const langData = await langResponse.json();
      const unitData = await unitResponse.json();

      if (langData.success) {
        setLanguageEntries(langData.data);
      }
      if (unitData.success) {
        setUnitEntries(unitData.data);
      }
    } catch (error) {
      console.error('Failed to fetch dictionaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    try {
      const data = activeTab === 'language' 
        ? {
            type: 'language',
            sourceWord: newEntry.sourceWord,
            targetWord: newEntry.targetWord,
            language: newEntry.language,
            category: newEntry.category || null
          }
        : {
            type: 'unit',
            sourceUnit: newEntry.sourceUnit,
            targetUnit: newEntry.targetUnit,
            conversionFactor: newEntry.conversionFactor,
            category: newEntry.category || null
          };

      const response = await fetch('/api/admin/dictionaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        setNewEntry({
          sourceWord: '',
          targetWord: '',
          language: 'id',
          category: '',
          sourceUnit: '',
          targetUnit: '',
          conversionFactor: 1.0
        });
        setIsAddingEntry(false);
        fetchDictionaries();
      } else {
        console.error('Failed to add entry');
      }
    } catch (error) {
      console.error('Error adding entry:', error);
    }
  };

  const handleDeleteEntry = async (id: string, type: 'language' | 'unit') => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const response = await fetch(`/api/admin/dictionaries/${id}?type=${type}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchDictionaries();
      } else {
        console.error('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Dictionary Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage language translations and unit conversions for product normalization
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('language')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'language'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Language Dictionary ({languageEntries.length})
            </button>
            <button
              onClick={() => setActiveTab('unit')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'unit'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Unit Dictionary ({unitEntries.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Add Entry Button */}
      <div className="mt-6">
        {!isAddingEntry ? (
          <button
            onClick={() => setIsAddingEntry(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Add New {activeTab === 'language' ? 'Language' : 'Unit'} Entry
          </button>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-4">
              Add New {activeTab === 'language' ? 'Language' : 'Unit'} Entry
            </h3>
            
            {activeTab === 'language' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <input
                  type="text"
                  placeholder="Source word (e.g., wortel)"
                  value={newEntry.sourceWord}
                  onChange={(e) => setNewEntry({ ...newEntry, sourceWord: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <input
                  type="text"
                  placeholder="Target word (e.g., carrot)"
                  value={newEntry.targetWord}
                  onChange={(e) => setNewEntry({ ...newEntry, targetWord: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <select
                  value={newEntry.language}
                  onChange={(e) => setNewEntry({ ...newEntry, language: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="id">Indonesian</option>
                  <option value="es">Spanish</option>
                  <option value="en">English</option>
                </select>
                <input
                  type="text"
                  placeholder="Category (optional)"
                  value={newEntry.category}
                  onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <input
                  type="text"
                  placeholder="Source unit (e.g., g)"
                  value={newEntry.sourceUnit}
                  onChange={(e) => setNewEntry({ ...newEntry, sourceUnit: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <input
                  type="text"
                  placeholder="Target unit (e.g., kg)"
                  value={newEntry.targetUnit}
                  onChange={(e) => setNewEntry({ ...newEntry, targetUnit: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <input
                  type="number"
                  step="0.001"
                  placeholder="Conversion factor"
                  value={newEntry.conversionFactor}
                  onChange={(e) => setNewEntry({ ...newEntry, conversionFactor: parseFloat(e.target.value) || 1.0 })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <input
                  type="text"
                  placeholder="Category (optional)"
                  value={newEntry.category}
                  onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            )}
            
            <div className="mt-4 flex space-x-3">
              <button
                onClick={handleAddEntry}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Save Entry
              </button>
              <button
                onClick={() => setIsAddingEntry(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dictionary Table */}
      <div className="mt-8">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                {activeTab === 'language' ? (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source Word
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target Word
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Language
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source Unit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target Unit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conversion Factor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                  </>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTab === 'language' 
                ? languageEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.sourceWord}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.targetWord}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {entry.language}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteEntry(entry.id, 'language')}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                : unitEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.sourceUnit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.targetUnit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.conversionFactor}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteEntry(entry.id, 'unit')}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
          
          {((activeTab === 'language' && languageEntries.length === 0) || 
            (activeTab === 'unit' && unitEntries.length === 0)) && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">
                No {activeTab} dictionary entries found. Add some entries to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}