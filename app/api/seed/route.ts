import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST() {
  try {
    // Create sample suppliers
    const suppliers = await Promise.all([
      prisma.supplier.upsert({
        where: { name: 'Fresh Foods Co' },
        update: {},
        create: {
          name: 'Fresh Foods Co',
          email: 'orders@freshfoods.com',
          phone: '+1-555-0101',
          address: '123 Market Street, City, State 12345'
        }
      }),
      prisma.supplier.upsert({
        where: { name: 'Market Direct' },
        update: {},
        create: {
          name: 'Market Direct',
          email: 'sales@marketdirect.com',
          phone: '+1-555-0102',
          address: '456 Supply Road, City, State 12346'
        }
      }),
      prisma.supplier.upsert({
        where: { name: 'Green Valley' },
        update: {},
        create: {
          name: 'Green Valley',
          email: 'contact@greenvalley.com',
          phone: '+1-555-0103',
          address: '789 Farm Lane, City, State 12347'
        }
      })
    ]);

    // Create sample products
    const products = await Promise.all([
      prisma.product.upsert({
        where: { standardizedName_standardizedUnit: { standardizedName: 'cherry tomatoes', standardizedUnit: 'kg' } },
        update: {},
        create: {
          name: 'Cherry Tomatoes',
          standardizedName: 'cherry tomatoes',
          category: 'Vegetables',
          unit: 'kg',
          standardizedUnit: 'kg',
          description: 'Fresh cherry tomatoes'
        }
      }),
      prisma.product.upsert({
        where: { standardizedName_standardizedUnit: { standardizedName: 'chicken breast', standardizedUnit: 'kg' } },
        update: {},
        create: {
          name: 'Chicken Breast',
          standardizedName: 'chicken breast',
          category: 'Meat',
          unit: 'kg',
          standardizedUnit: 'kg',
          description: 'Fresh chicken breast fillets'
        }
      }),
      prisma.product.upsert({
        where: { standardizedName_standardizedUnit: { standardizedName: 'jasmine rice', standardizedUnit: 'kg' } },
        update: {},
        create: {
          name: 'Jasmine Rice',
          standardizedName: 'jasmine rice',
          category: 'Grains',
          unit: 'kg',
          standardizedUnit: 'kg',
          description: 'Premium jasmine rice'
        }
      }),
      prisma.product.upsert({
        where: { standardizedName_standardizedUnit: { standardizedName: 'red onions', standardizedUnit: 'kg' } },
        update: {},
        create: {
          name: 'Red Onions',
          standardizedName: 'red onions',
          category: 'Vegetables',
          unit: 'kg',
          standardizedUnit: 'kg',
          description: 'Fresh red onions'
        }
      }),
      prisma.product.upsert({
        where: { standardizedName_standardizedUnit: { standardizedName: 'salmon fillet', standardizedUnit: 'kg' } },
        update: {},
        create: {
          name: 'Salmon Fillet',
          standardizedName: 'salmon fillet',
          category: 'Seafood',
          unit: 'kg',
          standardizedUnit: 'kg',
          description: 'Fresh Atlantic salmon fillet'
        }
      })
    ]);

    // Create sample prices
    const priceData = [
      // Cherry Tomatoes
      { productId: products[0].id, supplierId: suppliers[0].id, amount: 4.50 },
      { productId: products[0].id, supplierId: suppliers[1].id, amount: 4.20 },
      { productId: products[0].id, supplierId: suppliers[2].id, amount: 4.80 },
      
      // Chicken Breast
      { productId: products[1].id, supplierId: suppliers[0].id, amount: 12.50 },
      { productId: products[1].id, supplierId: suppliers[1].id, amount: 11.80 },
      { productId: products[1].id, supplierId: suppliers[2].id, amount: 13.20 },
      
      // Jasmine Rice
      { productId: products[2].id, supplierId: suppliers[0].id, amount: 2.20 },
      { productId: products[2].id, supplierId: suppliers[1].id, amount: 2.10 },
      { productId: products[2].id, supplierId: suppliers[2].id, amount: 2.35 },
      
      // Red Onions
      { productId: products[3].id, supplierId: suppliers[0].id, amount: 2.30 },
      { productId: products[3].id, supplierId: suppliers[2].id, amount: 2.15 },
      
      // Salmon Fillet
      { productId: products[4].id, supplierId: suppliers[0].id, amount: 18.75 },
      { productId: products[4].id, supplierId: suppliers[1].id, amount: 17.90 },
    ];

    await Promise.all(
      priceData.map(price =>
        prisma.price.upsert({
          where: {
            supplierId_productId_validFrom: {
              supplierId: price.supplierId,
              productId: price.productId,
              validFrom: new Date()
            }
          },
          update: { amount: price.amount },
          create: {
            amount: price.amount,
            unit: 'kg',
            supplierId: price.supplierId,
            productId: price.productId
          }
        })
      )
    );

    return NextResponse.json({
      message: 'Seed data created successfully',
      suppliers: suppliers.length,
      products: products.length,
      prices: priceData.length
    });

  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to create seed data' },
      { status: 500 }
    );
  }
}