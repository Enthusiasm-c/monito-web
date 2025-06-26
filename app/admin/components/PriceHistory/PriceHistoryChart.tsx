'use client';

import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine 
} from 'recharts';
import { format } from 'date-fns';

interface PriceHistoryData {
  date: Date;
  price: number;
  unitPrice?: number;
  changePercentage?: number;
  supplier?: {
    id: string;
    name: string;
  };
  changeReason?: string;
}

interface PriceHistoryChartProps {
  data: PriceHistoryData[];
  title?: string;
  showUnitPrice?: boolean;
  showChangePercentage?: boolean;
  height?: number;
  period?: '7d' | '30d' | '90d' | '1y';
}

export function PriceHistoryChart({ 
  data, 
  title = "Price History", 
  showUnitPrice = false,
  showChangePercentage = false,
  height = 400,
  period = '30d'
}: PriceHistoryChartProps) {
  // Format data for chart
  const chartData = data.map(item => ({
    date: format(new Date(item.date), 'MMM dd'),
    fullDate: item.date,
    price: item.price,
    unitPrice: item.unitPrice,
    changePercentage: item.changePercentage,
    supplier: item.supplier?.name || 'Unknown',
    changeReason: item.changeReason
  })).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

  // Calculate trend line
  const prices = chartData.map(d => d.price);
  const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm text-gray-600">
            Supplier: {data.supplier}
          </p>
          <p className="text-lg font-semibold text-blue-600">
            IDR {payload[0].value.toLocaleString()}
          </p>
          {showUnitPrice && data.unitPrice && (
            <p className="text-sm text-gray-600">
              Unit Price: IDR {data.unitPrice.toLocaleString()}
            </p>
          )}
          {data.changePercentage && (
            <p className={`text-sm font-medium ${
              data.changePercentage > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {data.changePercentage > 0 ? '+' : ''}{data.changePercentage.toFixed(1)}%
            </p>
          )}
          {data.changeReason && (
            <p className="text-xs text-gray-500 capitalize">
              {data.changeReason.replace('_', ' ')}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Get line color based on trend
  const getLineColor = () => {
    if (chartData.length < 2) return '#3B82F6';
    
    const firstPrice = chartData[0].price;
    const lastPrice = chartData[chartData.length - 1].price;
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    if (change > 5) return '#EF4444'; // Red for significant increase
    if (change < -5) return '#10B981'; // Green for significant decrease
    return '#3B82F6'; // Blue for stable
  };

  const lineColor = getLineColor();

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="mt-2 text-sm">No price history data available</p>
            <p className="text-xs text-gray-400">Upload some price lists to see trends</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span>Period: {period}</span>
          <span>{chartData.length} data points</span>
        </div>
      </div>
      
      {/* Price Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">Current Price</p>
          <p className="text-xl font-semibold text-gray-900">
            IDR {chartData[chartData.length - 1]?.price.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Average Price</p>
          <p className="text-xl font-semibold text-gray-900">
            IDR {Math.round(avgPrice).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Price Range</p>
          <p className="text-xl font-semibold text-gray-900">
            {Math.min(...prices).toLocaleString()} - {Math.max(...prices).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis 
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Average price reference line */}
          <ReferenceLine 
            y={avgPrice} 
            stroke="#9CA3AF" 
            strokeDasharray="5 5" 
            label={{ value: "Average", position: "insideTopRight" }}
          />
          
          {/* Main price line */}
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke={lineColor}
            strokeWidth={3}
            dot={{ fill: lineColor, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2 }}
            name="Price (IDR)"
          />
          
          {/* Unit price line (if enabled) */}
          {showUnitPrice && (
            <Line 
              type="monotone" 
              dataKey="unitPrice" 
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#F59E0B', strokeWidth: 1, r: 3 }}
              name="Unit Price (IDR)"
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Trend Analysis */}
      {chartData.length >= 2 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Trend Analysis</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Overall Change: </span>
              <span className={`font-medium ${
                ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price) * 100 > 0 
                  ? 'text-red-600' 
                  : 'text-green-600'
              }`}>
                {(((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price) * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-600">Volatility: </span>
              <span className="font-medium text-gray-900">
                {((Math.max(...prices) - Math.min(...prices)) / avgPrice * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}