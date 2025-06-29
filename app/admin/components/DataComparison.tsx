'use client';

import React, { useState } from 'react';

interface Product {
  name: string;
  price: number;
  unit: string;
  category?: string;
}

interface DataComparisonProps {
  extractedProducts: Product[];
  fileName: string;
  onProductEdit?: (index: number, product: Product) => void;
  className?: string;
}

export const DataComparison: React.FC<DataComparisonProps> = ({
  extractedProducts,
  fileName,
  onProductEdit,
  className = ""
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedProduct, setEditedProduct] = useState<Product | null>(null);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const handleEdit = (index: number, product: Product) => {
    setEditingIndex(index);
    setEditedProduct({ ...product });
  };

  const handleSave = (index: number) => {
    if (editedProduct && onProductEdit) {
      onProductEdit(index, editedProduct);
    }
    setEditingIndex(null);
    setEditedProduct(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditedProduct(null);
  };

  // Выявление проблемных записей
  const getRowStatus = (product: Product) => {
    const issues = [];
    
    // Проверка названия
    if (product.name.length < 3) {
      issues.push('Слишком короткое название');
    }
    if (/^\d+\s+\w+\s+\d+\s+\w+/.test(product.name)) {
      issues.push('Название содержит коды упаковки');
    }
    if (product.name.toLowerCase().includes('rp ') || product.name.toLowerCase().includes('idr')) {
      issues.push('Название содержит цену');
    }
    
    // Проверка цены
    if (product.price <= 0) {
      issues.push('Некорректная цена');
    }
    if (product.price > 10000000) {
      issues.push('Подозрительно высокая цена');
    }
    
    // Проверка единицы измерения
    if (!product.unit || product.unit.length < 1) {
      issues.push('Отсутствует единица измерения');
    }
    
    return {
      hasIssues: issues.length > 0,
      issues,
      severity: issues.length > 2 ? 'high' : issues.length > 0 ? 'medium' : 'low'
    };
  };

  const getRowClass = (status: ReturnType<typeof getRowStatus>) => {
    if (status.severity === 'high') {
      return 'bg-red-50 border-l-4 border-red-400';
    }
    if (status.severity === 'medium') {
      return 'bg-yellow-50 border-l-4 border-yellow-400';
    }
    return 'hover:bg-gray-50';
  };

  return (
    <div className={`bg-white border rounded-lg overflow-hidden flex flex-col ${className}`}>
      <div className="bg-gray-50 px-4 py-2 border-b">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">
            Распознанные данные ({extractedProducts.length} продуктов)
          </h4>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-100 border border-red-400 rounded"></div>
              <span>Критичные ошибки</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-400 rounded"></div>
              <span>Предупреждения</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Название продукта
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Цена
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Единица
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {extractedProducts.map((product, index) => {
              const status = getRowStatus(product);
              const isEditing = editingIndex === index;
              
              return (
                <tr 
                  key={index} 
                  className={`${getRowClass(status)} ${highlightIndex === index ? 'ring-2 ring-blue-500' : ''}`}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onMouseLeave={() => setHighlightIndex(null)}
                >
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedProduct?.name || ''}
                        onChange={(e) => setEditedProduct(prev => prev ? { ...prev, name: e.target.value } : null)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className={status.hasIssues ? 'text-red-700 font-medium' : 'text-gray-900'}>
                        {product.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editedProduct?.price || 0}
                        onChange={(e) => setEditedProduct(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedProduct?.unit || ''}
                        onChange={(e) => setEditedProduct(prev => prev ? { ...prev, unit: e.target.value } : null)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-500">
                        {product.unit}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {status.hasIssues ? (
                      <div className="space-y-1">
                        {status.issues.map((issue, i) => (
                          <div 
                            key={i} 
                            className={`text-xs px-2 py-1 rounded ${
                              status.severity === 'high' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {issue}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        ✓ OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleSave(index)}
                          className="text-green-600 hover:text-green-900 text-xs"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-900 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(index, product)}
                        className="text-blue-600 hover:text-blue-900 text-xs"
                      >
                        ✏️ Править
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Summary */}
      <div className="bg-gray-50 px-4 py-2 border-t text-sm">
        <div className="flex justify-between items-center">
          <span>
            Всего продуктов: <strong>{extractedProducts.length}</strong>
          </span>
          <div className="flex space-x-4">
            <span className="text-red-600">
              Проблемных: {extractedProducts.filter(p => getRowStatus(p).hasIssues).length}
            </span>
            <span className="text-green-600">
              Корректных: {extractedProducts.filter(p => !getRowStatus(p).hasIssues).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};