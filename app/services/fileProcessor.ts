import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedProduct {
  name: string;
  price: number;
  unit: string;
  category?: string;
  description?: string;
}

interface ExtractedData {
  supplier?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  products: ExtractedProduct[];
}

export async function processFile(uploadId: string) {
  try {
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: { supplier: true }
    });

    if (!upload) {
      throw new Error('Upload not found');
    }

    console.log(`Processing file: ${upload.originalName}`);

    let extractedData: ExtractedData = { products: [] };

    // Extract data based on file type
    if (upload.mimeType.includes('pdf')) {
      extractedData = await processPDF(upload.filename);
    } else if (upload.mimeType.includes('excel') || upload.mimeType.includes('sheet')) {
      extractedData = await processExcel(upload.filename);
    } else if (upload.mimeType.includes('csv')) {
      extractedData = await processCSV(upload.filename);
    } else if (upload.mimeType.includes('image')) {
      extractedData = await processImage(upload.filename);
    } else {
      throw new Error(`Unsupported file type: ${upload.mimeType}`);
    }

    // Check if we detected a different supplier than expected
    let finalSupplierId = upload.supplierId;
    if (extractedData.supplier && extractedData.supplier.name) {
      const detectedSupplier = await findOrCreateSupplier(extractedData.supplier);
      if (detectedSupplier.id !== upload.supplierId) {
        console.log(`Document indicates supplier "${extractedData.supplier.name}" but upload was assigned to different supplier. Using detected supplier.`);
        finalSupplierId = detectedSupplier.id;
        
        // Update the upload record with the correct supplier
        await prisma.upload.update({
          where: { id: uploadId },
          data: { supplierId: finalSupplierId }
        });
      }
    }

    // Store extracted data
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        extractedData: extractedData as unknown as object,
        status: 'completed'
      }
    });

    // Process products and prices
    await processExtractedData(extractedData.products, finalSupplierId, uploadId);

    console.log(`Successfully processed ${extractedData.products.length} products from ${upload.originalName}`);

  } catch (error) {
    console.error('Error processing file:', error);
    
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    throw error;
  }
}

async function processPDF(fileUrl: string): Promise<ExtractedData> {
  try {
    // In a real implementation, you'd download the file from the URL
    // For now, we'll simulate PDF processing
    console.log('Processing PDF:', fileUrl);
    const mockText = `
      FRESH FARMS WHOLESALE
      Contact: orders@freshfarms.com | (555) 123-4567
      123 Farm Lane, Agricultural District
      
      PRICE LIST - EFFECTIVE JANUARY 2024
      
      Tomatoes (Cherry) - $4.50 per kg
      Onions (Red) - $2.30 per kg
      Carrots (Organic) - $3.20 per kg
      Potatoes (Russet) - $1.80 per kg
    `;

    return await extractWithAI(mockText, 'pdf');
  } catch (error) {
    console.error('Error processing PDF:', error);
    return { products: [] };
  }
}

async function processExcel(fileUrl: string): Promise<ExtractedData> {
  try {
    // Mock Excel data processing
    console.log('Processing Excel:', fileUrl);
    const mockData = [
      { Product: 'Cherry Tomatoes', Price: 4.50, Unit: 'kg', Category: 'Vegetables' },
      { Product: 'Red Onions', Price: 2.30, Unit: 'kg', Category: 'Vegetables' },
      { Product: 'Organic Carrots', Price: 3.20, Unit: 'kg', Category: 'Vegetables' },
    ];

    // For Excel files, try to extract supplier from filename or sheet name
    const supplierName = extractSupplierFromFilename(fileUrl);

    return {
      supplier: supplierName ? { name: supplierName } : undefined,
      products: mockData.map(item => ({
        name: item.Product,
        price: item.Price,
        unit: item.Unit,
        category: item.Category
      }))
    };
  } catch (error) {
    console.error('Error processing Excel:', error);
    return { products: [] };
  }
}

async function processCSV(fileUrl: string): Promise<ExtractedData> {
  try {
    // Mock CSV processing
    console.log('Processing CSV:', fileUrl);
    const mockData = [
      { name: 'Chicken Breast', price: 12.50, unit: 'kg', category: 'Meat' },
      { name: 'Ground Beef', price: 8.90, unit: 'kg', category: 'Meat' },
      { name: 'Salmon Fillet', price: 18.75, unit: 'kg', category: 'Seafood' },
    ];

    const supplierName = extractSupplierFromFilename(fileUrl);

    return {
      supplier: supplierName ? { name: supplierName } : undefined,
      products: mockData
    };
  } catch (error) {
    console.error('Error processing CSV:', error);
    return { products: [] };
  }
}

async function processImage(fileUrl: string): Promise<ExtractedData> {
  try {
    // Mock image OCR processing
    console.log('Processing Image:', fileUrl);
    const mockText = `
      GOLDEN GRAINS WHOLESALE
      Tel: (555) 987-6543
      Email: sales@goldengrains.com
      
      WHOLESALE PRICES
      Rice (Jasmine) $2.20/kg
      Flour (All Purpose) $1.45/kg  
      Sugar (White) $1.89/kg
      Salt (Table) $0.95/kg
    `;

    return await extractWithAI(mockText, 'image');
  } catch (error) {
    console.error('Error processing image:', error);
    return { products: [] };
  }
}

async function extractWithAI(text: string, fileType: string): Promise<ExtractedData> {
  try {
    const prompt = `
      Extract supplier and product information from this ${fileType} text. Return a JSON object with the following structure:
      {
        "supplier": {
          "name": "supplier company name",
          "email": "email address (if found)",
          "phone": "phone number (if found)",
          "address": "address (if found)"
        },
        "products": [
          {
            "name": "product name",
            "price": numeric_price,
            "unit": "unit of measurement (kg, lb, each, etc.)",
            "category": "product category (optional)",
            "description": "additional details (optional)"
          }
        ]
      }

      Text to analyze:
      ${text}

      Rules:
      - Extract supplier information from headers, letterheads, contact info
      - Only include products with clear prices
      - Standardize units (use kg instead of kilograms, etc.)
      - Clean up product names (remove extra spaces, standardize formatting)
      - Infer categories when obvious (vegetables, meat, dairy, etc.)
      - If no supplier info is found, omit the supplier field
      - Return valid JSON only, no other text
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }, {
      timeout: 8000, // 8 seconds timeout
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('AI Response:', content);
      return { products: [] };
    }

  } catch (error) {
    console.error('Error with AI extraction:', error);
    return { products: [] };
  }
}

async function processExtractedData(
  extractedData: ExtractedProduct[],
  supplierId: string,
  uploadId: string
) {
  for (const item of extractedData) {
    try {
      // Standardize product name
      const standardizedName = standardizeProductName(item.name);
      const standardizedUnit = standardizeUnit(item.unit);

      // Find or create product
      let product = await prisma.product.findFirst({
        where: {
          standardizedName: standardizedName,
          standardizedUnit: standardizedUnit
        }
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            name: item.name,
            standardizedName: standardizedName,
            category: item.category || categorizeProduct(item.name),
            unit: item.unit,
            standardizedUnit: standardizedUnit,
            description: item.description
          }
        });
      }

      // Create or update price
      await prisma.price.upsert({
        where: {
          supplierId_productId_validFrom: {
            supplierId: supplierId,
            productId: product.id,
            validFrom: new Date()
          }
        },
        update: {
          amount: item.price,
          unit: item.unit
        },
        create: {
          amount: item.price,
          unit: item.unit,
          supplierId: supplierId,
          productId: product.id,
          uploadId: uploadId
        }
      });

    } catch (error) {
      console.error(`Error processing product ${item.name}:`, error);
    }
  }
}

function standardizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/tomato.*cherry|cherry.*tomato/i, 'cherry tomatoes')
    .replace(/chicken.*breast|breast.*chicken/i, 'chicken breast')
    .replace(/rice.*jasmine|jasmine.*rice/i, 'jasmine rice');
}

function standardizeUnit(unit: string): string {
  const unitMap: { [key: string]: string } = {
    'kilogram': 'kg',
    'kilograms': 'kg',
    'pound': 'lb',
    'pounds': 'lb',
    'lbs': 'lb',
    'gram': 'g',
    'grams': 'g',
    'ounce': 'oz',
    'ounces': 'oz',
    'litre': 'l',
    'litres': 'l',
    'liter': 'l',
    'liters': 'l'
  };

  const normalized = unit.toLowerCase().trim();
  return unitMap[normalized] || normalized;
}

function categorizeProduct(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('tomato') || lowerName.includes('onion') || 
      lowerName.includes('carrot') || lowerName.includes('potato') ||
      lowerName.includes('vegetable')) {
    return 'Vegetables';
  }
  
  if (lowerName.includes('chicken') || lowerName.includes('beef') || 
      lowerName.includes('pork') || lowerName.includes('meat')) {
    return 'Meat';
  }
  
  if (lowerName.includes('fish') || lowerName.includes('salmon') || 
      lowerName.includes('tuna') || lowerName.includes('seafood')) {
    return 'Seafood';
  }
  
  if (lowerName.includes('rice') || lowerName.includes('flour') || 
      lowerName.includes('bread') || lowerName.includes('grain')) {
    return 'Grains';
  }
  
  if (lowerName.includes('milk') || lowerName.includes('cheese') || 
      lowerName.includes('yogurt') || lowerName.includes('dairy')) {
    return 'Dairy';
  }
  
  return 'Other';
}

async function findOrCreateSupplier(supplierData: { name: string; email?: string; phone?: string; address?: string }) {
  try {
    // First, try to find existing supplier by name
    let supplier = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: supplierData.name,
          mode: 'insensitive'
        }
      }
    });

    if (!supplier) {
      // Create new supplier
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
  } catch (error) {
    console.error('Error finding/creating supplier:', error);
    throw error;
  }
}

function extractSupplierFromFilename(filename: string): string | null {
  // Extract supplier name from filename patterns like:
  // "Fresh_Foods_PriceList.xlsx" -> "Fresh Foods"
  // "market-direct-2024.csv" -> "Market Direct"
  // "green_valley_wholesale.pdf" -> "Green Valley Wholesale"
  
  const basename = filename.split('/').pop()?.split('.')[0] || '';
  
  // Common patterns to ignore
  const ignorePatterns = [
    /price.*list/i,
    /wholesale/i,
    /catalog/i,
    /\d{4}/g, // years
    /\d{1,2}[-\/]\d{1,2}/g, // dates
  ];
  
  let cleanName = basename
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to spaces
    .toLowerCase();
  
  // Remove common patterns
  ignorePatterns.forEach(pattern => {
    cleanName = cleanName.replace(pattern, '');
  });
  
  // Clean up and capitalize
  cleanName = cleanName
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Return null if the result is too short or generic
  if (cleanName.length < 3 || ['File', 'Document', 'List'].includes(cleanName)) {
    return null;
  }
  
  return cleanName;
}