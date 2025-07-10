import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
    const { id: supplierId } = await params;

    // Get supplier details
    const supplier = await databaseService.getSupplierById(supplierId);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Get all products with prices from this supplier
    const products = await databaseService.getProductsBySupplier(supplierId);

    // Format the response with supplier-specific pricing
    const formattedProducts = products.map(product => {
      const supplierPrice = product.prices[0]; // Should only be one price per supplier per product
      
      return {
        id: product.id,
        name: product.name,
        standardizedName: product.standardizedName,
        category: product.category,
        unit: product.unit,
        price: {
          amount: supplierPrice.amount,
          unit: supplierPrice.unit,
          updatedAt: supplierPrice.updatedAt,
          createdAt: supplierPrice.createdAt
        },
        totalSuppliers: product._count.prices
      };
    });

    return NextResponse.json({
      supplier,
      products: formattedProducts
    });

  });