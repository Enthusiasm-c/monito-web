import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { databaseService } from '../../../services/DatabaseService';
import { asyncHandler } from '../../../utils/errors';

export const GET = asyncHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';
    const category = searchParams.get('category');

    const where: { category?: string } = {};
    if (category && category !== 'All Categories') {
      where.category = category;
    }

    const products = await databaseService.getProducts({
      where,
      include: {
        prices: {
          include: {
            supplier: true
          },
          where: {
            validTo: null
          },
          orderBy: {
            amount: 'asc'
          }
        }
      },
      orderBy: {
        standardizedName: 'asc'
      }
    });

    // Prepare data for export
    const exportData = products.map(product => {
      const prices = product.prices;
      const bestPrice = prices.length > 0 ? prices[0] : null;
      const highestPrice = prices.length > 0 ? 
        prices.reduce((max, current) => Number(current.amount) > Number(max.amount) ? current : max) : null;
      
      const savings = bestPrice && highestPrice && prices.length > 1 ? 
        ((Number(highestPrice.amount) - Number(bestPrice.amount)) / Number(highestPrice.amount) * 100) : 0;

      return {
        'Product Name': product.standardizedName,
        'Category': product.category,
        'Unit': product.unit,
        'Best Price': bestPrice ? Number(bestPrice.amount) : 'N/A',
        'Best Price Supplier': bestPrice ? bestPrice.supplier.name : 'N/A',
        'Highest Price': highestPrice ? Number(highestPrice.amount) : 'N/A',
        'Highest Price Supplier': highestPrice ? highestPrice.supplier.name : 'N/A',
        'Supplier Count': prices.length,
        'Potential Savings (%)': Math.round(savings * 10) / 10,
        'Price Range Min': bestPrice ? Number(bestPrice.amount) : 'N/A',
        'Price Range Max': highestPrice ? Number(highestPrice.amount) : 'N/A',
        'Last Updated': new Date().toISOString().split('T')[0]
      };
    });

    if (format === 'excel') {
      // Create Excel file
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const cols = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
      ws['!cols'] = cols;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Price Comparison');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="price-comparison-${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      });
    } else if (format === 'csv') {
      // Create CSV
      const ws = XLSX.utils.json_to_sheet(exportData);
      const csvData = XLSX.utils.sheet_to_csv(ws);
      
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="price-comparison-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else {
      // Return JSON
      return NextResponse.json({
        data: exportData,
        meta: {
          totalProducts: products.length,
          exportDate: new Date().toISOString(),
          category: category || 'All Categories'
        }
      });
    }

  });