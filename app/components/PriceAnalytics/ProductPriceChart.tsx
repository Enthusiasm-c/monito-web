'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ProductPriceAnalytics {
  productId: string;
  productName: string;
  currentPrices: {
    supplierId: string;
    supplierName: string;
    price: number;
    lastUpdated: Date;
  }[];
  averagePriceHistory: {
    date: Date;
    averagePrice: number;
    supplierCount: number;
    minPrice: number;
    maxPrice: number;
    priceSpread: number;
  }[];
  statistics: {
    currentAveragePrice: number;
    currentMinPrice: number;
    currentMaxPrice: number;
    priceSpread: number;
    supplierCount: number;
    totalPriceChanges: number;
    lastPriceChange: Date | null;
  };
}

interface ProductPriceChartProps {
  productId: string;
  className?: string;
}

export function ProductPriceChart({ productId, className = '' }: ProductPriceChartProps) {
  const [analytics, setAnalytics] = useState<ProductPriceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'timeline' | 'comparison'>('timeline');

  useEffect(() => {
    loadAnalytics();
  }, [productId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/analytics/prices?type=product&productId=${productId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load price analytics');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load analytics');
      }

      setAnalytics(data.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatTimelineData = () => {
    if (!analytics) return [];
    
    return analytics.averagePriceHistory.map(point => ({
      date: new Date(point.date).toLocaleDateString('ru-RU'),
      'Средняя цена': Math.round(point.averagePrice),
      'Мин. цена': Math.round(point.minPrice),
      'Макс. цена': Math.round(point.maxPrice),
      'Поставщиков': point.supplierCount
    }));
  };

  const formatComparisonData = () => {
    if (!analytics) return [];
    
    return analytics.currentPrices
      .sort((a, b) => a.price - b.price)
      .map(price => ({
        supplier: price.supplierName.length > 15 
          ? price.supplierName.substring(0, 15) + '...' 
          : price.supplierName,
        fullName: price.supplierName,
        price: Math.round(price.price),
        difference: Math.round(price.price - analytics.statistics.currentAveragePrice),
        percentDiff: Math.round(((price.price - analytics.statistics.currentAveragePrice) / analytics.statistics.currentAveragePrice) * 100)
      }));
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      if (chartType === 'timeline') {
        return (
          <div className="bg-white p-3 border rounded shadow-lg">
            <p className="font-medium">{`Дата: ${label}`}</p>
            {payload.map((entry: any, index: number) => (
              <p key={index} style={{ color: entry.color }}>
                {`${entry.dataKey}: ${entry.value.toLocaleString()} IDR`}
              </p>
            ))}
          </div>
        );
      } else {
        const data = payload[0]?.payload;
        return (
          <div className="bg-white p-3 border rounded shadow-lg">
            <p className="font-medium">{data?.fullName}</p>
            <p style={{ color: payload[0]?.color }}>
              {`Цена: ${payload[0]?.value?.toLocaleString()} IDR`}
            </p>
            <p className={`text-sm ${data?.percentDiff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data?.percentDiff >= 0 ? '+' : ''}{data?.percentDiff}% от средней
            </p>
          </div>
        );
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️ Ошибка загрузки</div>
          <div className="text-sm text-gray-600 mb-4">{error}</div>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">📊 Нет данных</div>
          <div className="text-sm">Недостаточно данных для анализа цен</div>
        </div>
      </div>
    );
  }

  const timelineData = formatTimelineData();
  const comparisonData = formatComparisonData();

  return (
    <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Анализ цен: {analytics.productName}
          </h3>
          <div className="text-sm text-gray-500">
            {analytics.statistics.supplierCount} поставщиков • {analytics.statistics.totalPriceChanges} изменений цен
          </div>
        </div>
        
        {/* Chart Type Toggle */}
        <div className="flex rounded-lg border">
          <button
            onClick={() => setChartType('timeline')}
            className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
              chartType === 'timeline'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Динамика
          </button>
          <button
            onClick={() => setChartType('comparison')}
            className={`px-4 py-2 text-sm font-medium rounded-r-lg border-l ${
              chartType === 'comparison'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Сравнение
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Средняя цена</div>
          <div className="text-xl font-bold text-blue-900">
            {analytics.statistics.currentAveragePrice.toLocaleString()} IDR
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Мин. цена</div>
          <div className="text-xl font-bold text-green-900">
            {analytics.statistics.currentMinPrice.toLocaleString()} IDR
          </div>
        </div>
        
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Макс. цена</div>
          <div className="text-xl font-bold text-red-900">
            {analytics.statistics.currentMaxPrice.toLocaleString()} IDR
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 font-medium">Разброс цен</div>
          <div className="text-xl font-bold text-gray-900">
            {analytics.statistics.priceSpread.toLocaleString()} IDR
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'timeline' ? (
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${value.toLocaleString()}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="Средняя цена" 
                stroke="#3B82F6" 
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="Мин. цена" 
                stroke="#10B981" 
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Line 
                type="monotone" 
                dataKey="Макс. цена" 
                stroke="#EF4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          ) : (
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="supplier" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tickFormatter={(value) => `${value.toLocaleString()}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="price" 
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Current Prices Table */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-3">Текущие цены по поставщикам</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Поставщик
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Цена
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Отклонение от средней
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Обновлено
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.currentPrices
                .sort((a, b) => a.price - b.price)
                .map((price, index) => {
                  const difference = price.price - analytics.statistics.currentAveragePrice;
                  const percentDiff = (difference / analytics.statistics.currentAveragePrice) * 100;
                  const isLowest = price.price === analytics.statistics.currentMinPrice;
                  const isHighest = price.price === analytics.statistics.currentMaxPrice;
                  
                  return (
                    <tr key={price.supplierId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {price.supplierName}
                          </div>
                          {isLowest && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Самая низкая
                            </span>
                          )}
                          {isHighest && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Самая высокая
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {price.price.toLocaleString()} IDR
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${
                          difference > 0 ? 'text-red-600' : difference < 0 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {difference > 0 ? '+' : ''}{difference.toLocaleString()} IDR
                          <div className="text-xs text-gray-500">
                            ({percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(1)}%)
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(price.lastUpdated).toLocaleDateString('ru-RU')}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}