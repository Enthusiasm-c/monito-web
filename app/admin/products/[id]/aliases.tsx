'use client';

import { useState, useEffect } from 'react';

interface Alias {
  id: string;
  alias: string;
  language?: string | null;
  createdAt: string;
}

interface AliasManagerProps {
  productId: string;
  productName: string;
}

export default function AliasManager({ productId, productName }: AliasManagerProps) {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAlias, setNewAlias] = useState('');
  const [newLanguage, setNewLanguage] = useState('en');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAliases();
  }, [productId]);

  const fetchAliases = async () => {
    try {
      const response = await fetch(`/api/admin/aliases?productId=${productId}`);
      if (response.ok) {
        const data = await response.json();
        setAliases(data.aliases);
      }
    } catch (error) {
      console.error('Error fetching aliases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          alias: newAlias,
          language: newLanguage
        })
      });

      if (response.ok) {
        setNewAlias('');
        fetchAliases();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error adding alias:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    if (!confirm('Delete this alias?')) return;

    try {
      const response = await fetch(`/api/admin/aliases/${aliasId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchAliases();
      }
    } catch (error) {
      console.error('Error deleting alias:', error);
    }
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'id', name: 'Indonesian' },
    { code: 'es', name: 'Spanish' }
  ];

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Product Aliases</h3>
        <p className="mt-1 text-sm text-gray-500">
          Alternative names for "{productName}" in different languages
        </p>
      </div>

      <div className="px-6 py-4">
        {/* Add alias form */}
        <form onSubmit={handleAddAlias} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="Add alias (e.g., wortel, zanahoria)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={saving || !newAlias.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        {/* Aliases list */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading aliases...</p>
        ) : aliases.length === 0 ? (
          <p className="text-sm text-gray-500">No aliases yet</p>
        ) : (
          <div className="space-y-2">
            {aliases.map((alias) => (
              <div key={alias.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <span className="text-sm font-medium text-gray-900">{alias.alias}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    ({languages.find(l => l.code === alias.language)?.name || alias.language})
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteAlias(alias.id)}
                  className="text-xs text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}