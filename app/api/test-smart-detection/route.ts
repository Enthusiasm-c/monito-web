import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    // Simulate smart supplier detection and creation
    console.log('🤖 Testing AI-powered supplier detection...');
    
    // Test filename-based detection
    const testFilename = "FreshFarms_PriceList_2024.xlsx";
    const supplierName = extractSupplierFromFilename(testFilename);
    console.log(`📄 Extracted supplier from filename "${testFilename}": ${supplierName}`);
    
    // Test AI text extraction
    const mockDocumentText = `
      FRESH FARMS WHOLESALE COMPANY
      Email: orders@freshfarms.com
      Phone: (555) 123-4567
      Address: 123 Farm Lane, Agricultural District
      
      PRICE LIST - EFFECTIVE JANUARY 2024
      
      Cherry Tomatoes - $4.50 per kg
      Red Onions - $2.30 per kg
      Organic Carrots - $3.20 per kg
    `;
    
    const extractedData = await simulateAIExtraction(mockDocumentText);
    console.log('🧠 AI extracted supplier info:', extractedData.supplier);
    
    // Create or find supplier
    let supplier;
    if (extractedData.supplier) {
      supplier = await findOrCreateSupplier(extractedData.supplier);
      console.log(`✅ Supplier handled: ${supplier.name} (ID: ${supplier.id})`);
    }
    
    // Create sample products
    const createdProducts = [];
    for (const product of extractedData.products) {
      try {
        const newProduct = await createOrUpdateProduct(product, supplier?.id);
        createdProducts.push(newProduct);
      } catch (error) {
        console.error(`Error creating product ${product.name}:`, error);
      }
    }
    
    return NextResponse.json({
      message: 'Smart detection test completed successfully!',
      results: {
        supplierDetected: supplierName,
        supplierCreated: supplier?.name,
        supplierId: supplier?.id,
        productsProcessed: createdProducts.length,
        aiExtraction: extractedData
      }
    });
    
  } catch (error) {
    console.error('Smart detection test error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function extractSupplierFromFilename(filename: string): string | null {
  const basename = filename.split('/').pop()?.split('.')[0] || '';
  
  const ignorePatterns = [
    /price.*list/i,
    /wholesale/i,
    /catalog/i,
    /\d{4}/g,
    /\d{1,2}[-\/]\d{1,2}/g,
  ];
  
  let cleanName = basename
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  
  ignorePatterns.forEach(pattern => {
    cleanName = cleanName.replace(pattern, '');
  });
  
  cleanName = cleanName
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  if (cleanName.length < 3 || ['File', 'Document', 'List'].includes(cleanName)) {
    return null;
  }
  
  return cleanName;
}

async function simulateAIExtraction(text: string) {
  // Simulate what our AI would extract from the provided text
  console.log('Processing text content:', text.substring(0, 100) + '...');
  return {
    supplier: {
      name: "Fresh Farms Wholesale Company",
      email: "orders@freshfarms.com",
      phone: "(555) 123-4567",
      address: "123 Farm Lane, Agricultural District"
    },
    products: [
      { name: "Cherry Tomatoes", price: 4.50, unit: "kg", category: "Vegetables" },
      { name: "Red Onions", price: 2.30, unit: "kg", category: "Vegetables" },
      { name: "Organic Carrots", price: 3.20, unit: "kg", category: "Vegetables" }
    ]
  };
}

async function findOrCreateSupplier(supplierData: { name: string; email?: string; phone?: string; address?: string }) {
  let supplier = await prisma.supplier.findFirst({
    where: {
      name: {
        contains: supplierData.name,
        mode: 'insensitive'
      }
    }
  });

  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: supplierData.name,
        email: supplierData.email,
        phone: supplierData.phone,
        address: supplierData.address
      }
    });
    console.log(`Created new supplier: ${supplierData.name}`);
  } else {
    console.log(`Found existing supplier: ${supplier.name}`);
  }

  return supplier;
}

async function createOrUpdateProduct(productData: { name: string; price: number; unit: string; category?: string }, supplierId?: string) {
  const standardizedName = productData.name.toLowerCase().trim();
  const standardizedUnit = productData.unit.toLowerCase();

  let product = await prisma.product.findFirst({
    where: {
      standardizedName: standardizedName,
      standardizedUnit: standardizedUnit
    }
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: productData.name,
        standardizedName: standardizedName,
        category: productData.category || 'Other',
        unit: productData.unit,
        standardizedUnit: standardizedUnit,
      }
    });
  }

  // Create price if supplier is provided
  if (supplierId) {
    await prisma.price.upsert({
      where: {
        supplierId_productId_validFrom: {
          supplierId: supplierId,
          productId: product.id,
          validFrom: new Date()
        }
      },
      update: {
        amount: productData.price,
        unit: productData.unit
      },
      create: {
        amount: productData.price,
        unit: productData.unit,
        supplierId: supplierId,
        productId: product.id
      }
    });
  }

  return product;
}