import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { embeddingService } from './embeddingService';
import { advancedPdfProcessor } from './advancedPdfProcessor';
import { dataNormalizer } from './dataNormalizer';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Track quota state
let quotaExhausted = false;
let quotaExhaustedTime = 0;
const QUOTA_RESET_WAIT = 60 * 1000; // Wait 1 minute before retrying

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

    // Extract data based on file type - check both MIME type and file extension
    const fileName = upload.originalName?.toLowerCase() || '';
    const mimeType = upload.mimeType?.toLowerCase() || '';
    
    if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
      extractedData = await processPDF(upload.url || '');
    } else if (mimeType.includes('excel') || mimeType.includes('sheet') || 
               fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
               mimeType === 'application/octet-stream' && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'))) {
      extractedData = await processExcel(upload.url || '');
    } else if (mimeType.includes('csv') || fileName.endsWith('.csv') ||
               mimeType === 'application/octet-stream' && fileName.endsWith('.csv')) {
      extractedData = await processCSV(upload.url || '');
    } else if (mimeType.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) {
      extractedData = await processImage(upload.url || '');
    } else {
      throw new Error(`Unsupported file type: ${upload.mimeType} (${fileName})`);
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
    console.log('🚀 Starting advanced PDF processing:', fileUrl);
    
    // Use the advanced PDF processor for complex documents
    const result = await advancedPdfProcessor.processComplexPdf(fileUrl);
    
    if (result.products && result.products.length > 0) {
      console.log(`✅ Advanced PDF processing successful: ${result.products.length} products extracted`);
      return result;
    }
    
    console.warn('⚠️ Advanced PDF processing returned no products');
    return { products: [] };
    
  } catch (error) {
    console.error('❌ Advanced PDF processing failed:', error);
    
    // Fallback to basic processing if advanced fails
    console.log('🔄 Falling back to basic PDF processing...');
    
    try {
      return await processPDFBasic(fileUrl);
    } catch (fallbackError) {
      console.error('❌ Basic PDF processing also failed:', fallbackError);
      return { products: [] };
    }
  }
}

async function processPDFBasic(fileUrl: string): Promise<ExtractedData> {
  try {
    console.log('📄 Basic PDF processing:', fileUrl);
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Dynamic import of pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist');
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    }).promise;
    
    console.log(`📖 PDF contains ${pdf.numPages} pages`);
    
    let extractedText = '';
    
    // Extract text from all pages (limit to first 10 pages)
    const maxPages = Math.min(pdf.numPages, 10);
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      extractedText += `Page ${pageNum}:\n${pageText}\n\n`;
      
      console.log(`📄 Extracted text from page ${pageNum}: ${pageText.length} characters`);
    }
    
    console.log(`📝 Total extracted text: ${extractedText.length} characters`);
    
    // Extract supplier from filename
    const supplierName = extractSupplierFromFilename(fileUrl);
    let pdfText = extractedText;
    
    if (supplierName) {
      pdfText = `Supplier from filename: ${supplierName}\n\n${extractedText}`;
    }
    
    // Limit text length to avoid token limits
    if (pdfText.length > 8000) {
      pdfText = pdfText.substring(0, 8000) + '\n... (truncated)';
      console.log('📝 PDF text truncated to 8000 characters');
    }
    
    if (!pdfText.trim()) {
      throw new Error('No text content found in PDF');
    }
    
    console.log('🤖 Processing basic PDF content with AI...');
    return await extractWithAI(pdfText, 'pdf');
    
  } catch (error) {
    console.error('❌ Basic PDF processing failed:', error);
    throw error;
  }
}

function preprocessExcelRows(jsonData: any[]): any[] {
  if (!jsonData || jsonData.length === 0) return [];
  
  // Step 1: Find first and last rows with meaningful data
  let firstDataRow = -1;
  let lastDataRow = -1;
  
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (hasSignificantData(row)) {
      if (firstDataRow === -1) firstDataRow = i;
      lastDataRow = i;
    }
  }
  
  if (firstDataRow === -1) return []; // No data found
  
  console.log(`📊 Excel data range: rows ${firstDataRow + 1} to ${lastDataRow + 1} (${lastDataRow - firstDataRow + 1} total)`);
  
  // Step 2: Extract the data range, preserving empty rows as category separators
  const dataRange = jsonData.slice(firstDataRow, lastDataRow + 1);
  
  // Step 3: Smart filtering - keep data rows and meaningful separators
  const smartFiltered = [];
  let consecutiveEmptyRows = 0;
  
  for (let i = 0; i < dataRange.length; i++) {
    const row = dataRange[i];
    
    if (hasSignificantData(row)) {
      // This is a data row
      consecutiveEmptyRows = 0;
      smartFiltered.push(row);
    } else if (isEmpty(row)) {
      // This is an empty row - might be a category separator
      consecutiveEmptyRows++;
      
      // Keep up to 2 consecutive empty rows as potential separators
      // But only if there's more data coming after
      if (consecutiveEmptyRows <= 2 && hasMoreDataAfter(dataRange, i)) {
        smartFiltered.push(['[CATEGORY_SEPARATOR]']); // Mark as separator
      }
    } else if (isHeaderOrCategory(row)) {
      // This might be a category header
      consecutiveEmptyRows = 0;
      smartFiltered.push(row);
    }
  }
  
  console.log(`🧠 Smart filtering: ${jsonData.length} → ${smartFiltered.length} rows (preserved ${smartFiltered.filter(r => r[0] === '[CATEGORY_SEPARATOR]').length} separators)`);
  
  return smartFiltered;
}

function hasSignificantData(row: any): boolean {
  if (!row || !Array.isArray(row)) return false;
  
  // Check if row has at least 2 non-empty cells with meaningful content
  const nonEmptyValues = row.filter(cell => 
    cell !== null && 
    cell !== undefined && 
    cell !== '' && 
    typeof cell !== 'undefined'
  );
  
  if (nonEmptyValues.length < 2) return false;
  
  // Look for patterns that suggest product data (price, quantity, name)
  const hasNumbers = nonEmptyValues.some(cell => {
    const str = String(cell).trim();
    return /\d/.test(str); // Contains digits
  });
  
  const hasText = nonEmptyValues.some(cell => {
    const str = String(cell).trim();
    return str.length > 1 && /[a-zA-Z]/.test(str); // Contains letters and is longer than 1 char
  });
  
  return hasNumbers && hasText;
}

function isEmpty(row: any): boolean {
  if (!row || !Array.isArray(row)) return true;
  return !row.some(cell => 
    cell !== null && 
    cell !== undefined && 
    cell !== '' && 
    String(cell).trim() !== ''
  );
}

function isHeaderOrCategory(row: any): boolean {
  if (!row || !Array.isArray(row)) return false;
  
  // Look for category headers (single text field, often centered)
  const nonEmptyValues = row.filter(cell => 
    cell !== null && 
    cell !== undefined && 
    cell !== '' && 
    String(cell).trim() !== ''
  );
  
  if (nonEmptyValues.length === 1) {
    const text = String(nonEmptyValues[0]).trim().toLowerCase();
    
    // Common category words
    const categoryKeywords = [
      'vegetable', 'fruit', 'meat', 'seafood', 'dairy', 'grain', 'spice', 'herb',
      'fresh', 'frozen', 'organic', 'category', 'section', 'group',
      'sayur', 'buah', 'daging', 'ikan', 'susu', 'rempah', 'segar'
    ];
    
    return categoryKeywords.some(keyword => text.includes(keyword)) || text.length < 20;
  }
  
  return false;
}

function hasMoreDataAfter(dataRange: any[], currentIndex: number): boolean {
  for (let i = currentIndex + 1; i < dataRange.length; i++) {
    if (hasSignificantData(dataRange[i])) {
      return true;
    }
  }
  return false;
}

async function processSheetData(jsonData: any[], sheetName: string, supplierName?: string): Promise<ExtractedData> {
  try {
    // Improved logic: Don't just filter out empty rows, preserve structure for category separators
    console.log(`Sheet "${sheetName}": Original data has ${jsonData.length} total rows`);
    
    // Find the actual data range by looking for meaningful content
    const processedRows = preprocessExcelRows(jsonData);
    
    const rowCount = processedRows.length;
    console.log(`Sheet "${sheetName}": Processing ${rowCount} rows after smart filtering`);
    
    // For files with many data rows (50+ rows), process in chunks
    if (rowCount > 50) {
      console.log(`Large sheet detected (${rowCount} rows), processing in chunks...`);
      
      const chunks = [];
      const chunkSize = 30; // Smaller chunks for better AI processing
      
      for (let i = 0; i < processedRows.length; i += chunkSize) {
        const chunkData = processedRows.slice(i, i + chunkSize);
        let chunkText = `Excel chunk ${Math.floor(i/chunkSize) + 1}:\nSheet: ${sheetName}\n\n`;
        
        if (i === 0 && processedRows.length > 0) {
          chunkText += `Headers: ${processedRows[0]}\n\n`;
        }
        
        chunkData.forEach((row: any, index: number) => {
          // Handle category separators
          if (row[0] === '[CATEGORY_SEPARATOR]') {
            chunkText += `\n--- Category Separator ---\n`;
            return;
          }
          
          // Enhanced row formatting for better multi-column detection
          const rowData = row.map((cell: any) => cell || '').join(' | ');
          chunkText += `Row ${i + index + 1}: ${rowData}\n`;
          
          // Add column analysis hint if row has many fields
          if (row.length >= 4) {
            chunkText += `  [Note: This row has ${row.length} columns - check for multiple products]\n`;
          }
        });
        
        if (supplierName) {
          chunkText = `Supplier from filename: ${supplierName}\n\n${chunkText}`;
        }
        
        console.log(`Processing chunk ${Math.floor(i/chunkSize) + 1} with ${chunkData.length} rows...`);
        const chunkResult = await extractWithAI(chunkText, 'excel');
        chunks.push(chunkResult);
      }
      
      // Merge all chunks
      const mergedResult: ExtractedData = {
        supplier: chunks.find(c => c.supplier)?.supplier,
        products: chunks.flatMap(c => c.products || [])
      };
      
      console.log(`Sheet "${sheetName}": Merged ${chunks.length} chunks into ${mergedResult.products.length} products`);
      return mergedResult;
    }
    
    // For smaller sheets, process all at once
    let sheetText = `Excel sheet: ${sheetName} (${rowCount} rows with data)\n\n`;
    
    // Add header row if exists
    if (processedRows.length > 0) {
      sheetText += `Headers: ${processedRows[0]}\n\n`;
    }
    
    // Add all rows as text with enhanced multi-column detection
    processedRows.forEach((row: any, index: number) => {
      // Handle category separators
      if (row[0] === '[CATEGORY_SEPARATOR]') {
        sheetText += `\n--- Category Separator ---\n`;
        return;
      }
      
      const rowData = row.map((cell: any) => cell || '').join(' | ');
      sheetText += `Row ${index + 1}: ${rowData}\n`;
      
      // Add column analysis hint if row has many fields
      if (row.length >= 4) {
        sheetText += `  [Note: This row has ${row.length} columns - check for multiple products]\n`;
      }
    });
    
    if (supplierName) {
      sheetText = `Supplier from filename: ${supplierName}\n\n${sheetText}`;
    }
    
    console.log(`Sheet "${sheetName}": Processing ${rowCount} rows with AI...`);
    return await extractWithAI(sheetText, 'excel');
    
  } catch (error) {
    console.error(`Error processing sheet "${sheetName}":`, error);
    return { products: [] };
  }
}

async function processExcel(fileUrl: string): Promise<ExtractedData> {
  try {
    console.log('Processing Excel:', fileUrl);
    
    // Download Excel file from Vercel Blob
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const XLSX = await import('xlsx');
    
    // Parse Excel file
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    console.log(`Excel file has ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(', ')}`);
    
    // Find all sheets with significant data (5+ rows)
    const dataSheets = [];
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Count non-empty rows
      const nonEmptyRows = jsonData.filter((row: any) => 
        row && row.length > 0 && row.some((cell: any) => cell !== null && cell !== undefined && cell !== '')
      ).length;
      
      console.log(`Sheet "${sheetName}": ${nonEmptyRows} rows with data`);
      
      // Include sheets with at least 5 rows of data
      if (nonEmptyRows >= 5) {
        dataSheets.push({
          name: sheetName,
          data: jsonData,
          rowCount: nonEmptyRows
        });
      }
    }
    
    if (dataSheets.length === 0) {
      console.log('No sheets with significant data found');
      return { products: [] };
    }
    
    console.log(`Found ${dataSheets.length} sheets with data: ${dataSheets.map(s => `${s.name}(${s.rowCount})`).join(', ')}`);
    
    // Extract supplier from filename
    const supplierName = extractSupplierFromFilename(fileUrl);
    
    // Process all sheets with data
    const allResults = [];
    
    for (const sheet of dataSheets) {
      console.log(`Processing sheet "${sheet.name}" with ${sheet.rowCount} rows...`);
      const sheetResult = await processSheetData(sheet.data, sheet.name, supplierName);
      if (sheetResult.products && sheetResult.products.length > 0) {
        allResults.push(sheetResult);
      }
    }
    
    // Merge results from all sheets
    const mergedResult: ExtractedData = {
      supplier: allResults.find(r => r.supplier)?.supplier,
      products: allResults.flatMap(r => r.products || [])
    };
    
    console.log(`Processed ${dataSheets.length} sheets, extracted ${mergedResult.products.length} total products`);
    return mergedResult;
    
  } catch (error) {
    console.error('Error processing Excel:', error);
    return { products: [] };
  }
}

async function processCSV(fileUrl: string): Promise<ExtractedData> {
  try {
    console.log('Processing CSV:', fileUrl);
    
    // Download CSV file from Vercel Blob
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV file: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log(`CSV contains ${csvText.length} characters`);
    
    // Extract supplier from filename
    const supplierName = extractSupplierFromFilename(fileUrl);
    let processText = csvText;
    
    if (supplierName) {
      processText = `Supplier from filename: ${supplierName}\n\nCSV Content:\n${csvText}`;
    }
    
    // Limit text length to avoid token limits (first 8000 characters)
    if (processText.length > 8000) {
      processText = processText.substring(0, 8000) + '\n... (truncated)';
      console.log('CSV text truncated to 8000 characters');
    }
    
    console.log('Processing CSV content with AI...');
    return await extractWithAI(processText, 'csv');
    
  } catch (error) {
    console.error('Error processing CSV:', error);
    return { products: [] };
  }
}

async function processImage(fileUrl: string): Promise<ExtractedData> {
  // Check if quota is exhausted and if we should retry
  if (quotaExhausted) {
    const timeWaited = Date.now() - quotaExhaustedTime;
    const minutesLeft = Math.ceil((QUOTA_RESET_WAIT - timeWaited) / 60000);
    
    if (timeWaited < QUOTA_RESET_WAIT) {
      throw new Error(`OpenAI quota exceeded. AI processing is temporarily unavailable. Please wait ${minutesLeft} minute(s) before retrying.`);
    } else {
      // Reset quota status after wait period
      quotaExhausted = false;
      quotaExhaustedTime = 0;
      console.log('✅ Attempting to resume AI image processing after quota wait period');
    }
  }

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log('Processing Image with AI Vision:', fileUrl);
      
      // Add delay to respect rate limits (500ms between requests for better compliance)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use OpenAI Vision API to process image directly
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1500, // Ограничиваем токены для экономии
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image which contains a price list or catalog. Extract supplier and product information and return a JSON object with the following structure:
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
                
                Rules:
                - Extract supplier information from headers, letterheads, contact info
                - Only include products with clear prices
                - Standardize units (use kg instead of kilograms, etc.)
                - Clean up product names (remove extra spaces, standardize formatting)
                - Infer categories when obvious (vegetables, meat, dairy, etc.)
                - If no supplier info is found, omit the supplier field
                - Return valid JSON only, no other text`
              },
              {
                type: "image_url",
                image_url: {
                  url: fileUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      }, {
        timeout: 30000, // 30 seconds for vision processing
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI Vision');
      }

      try {
        // Clean up AI response - remove markdown code blocks
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        return JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Error parsing AI Vision response:', parseError);
        console.error('AI Response:', content);
        return { products: [] };
      }

    } catch (error: any) {
      retryCount++;
      
      // Check if it's a quota exhaustion error
      if (error?.status === 429 && error?.code === 'insufficient_quota') {
        quotaExhausted = true;
        quotaExhaustedTime = Date.now();
        console.log('❌ OpenAI quota exhausted during image processing');
        throw new Error('OpenAI quota exceeded. AI processing is temporarily unavailable. Please wait 1 minute before retrying.');
      }
      
      // Check if it's a rate limit error
      if (error?.status === 429 || error?.message?.includes('Rate limit')) {
        const waitTime = Math.min(2000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
        console.warn(`Rate limit hit in processImage, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      console.error(`Error processing image (attempt ${retryCount}):`, error);
      
      if (retryCount >= maxRetries) {
        console.warn(`Max retries reached in processImage, returning empty result`);
        return { products: [] };
      }
    }
  }

  return { products: [] };
}

async function extractWithAI(text: string, fileType: string): Promise<ExtractedData> {
  // Check if quota is exhausted and if we should retry
  if (quotaExhausted) {
    const timeWaited = Date.now() - quotaExhaustedTime;
    const minutesLeft = Math.ceil((QUOTA_RESET_WAIT - timeWaited) / 60000);
    
    if (timeWaited < QUOTA_RESET_WAIT) {
      throw new Error(`OpenAI quota exceeded. AI processing is temporarily unavailable. Please wait ${minutesLeft} minute(s) before retrying.`);
    } else {
      // Reset quota status after wait period
      quotaExhausted = false;
      quotaExhaustedTime = 0;
      console.log('✅ Attempting to resume AI processing after quota wait period');
    }
  }

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
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
        - IMPORTANT: Each row may contain MULTIPLE products arranged in columns (e.g., "Product A | Price A | Product B | Price B")
        - Carefully examine each row and extract ALL products present, even if they're in different columns
        - Look for patterns where product names and prices alternate within the same row
        - CRITICAL: "--- Category Separator ---" marks category divisions - continue processing after these separators
        - Empty rows or separators do NOT mean the file has ended - there may be more products after category breaks
        - Process ALL data through to the end, regardless of category separators or empty sections
        - Only include products with clear prices
        - Standardize units (use kg instead of kilograms, etc.)
        - Clean up product names (remove extra spaces, standardize formatting)
        - Infer categories when obvious (vegetables, meat, dairy, etc.)
        - If no supplier info is found, omit the supplier field
        - Return valid JSON only, no other text
      `;

      // Add delay to respect rate limits (500ms between requests for better compliance)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await openai.chat.completions.create({
        model: 'gpt-o3',
        max_tokens: 2000, // Ограничиваем токены для экономии
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }, {
        timeout: 60000, // 60 seconds timeout for large files
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      try {
        // Clean up AI response - remove markdown code blocks
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        return JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.error('AI Response:', content);
        return { products: [] };
      }

    } catch (error: any) {
      retryCount++;
      
      // Check if it's a quota exhaustion error
      if (error?.status === 429 && error?.code === 'insufficient_quota') {
        quotaExhausted = true;
        quotaExhaustedTime = Date.now();
        console.log('❌ OpenAI quota exhausted during extractWithAI');
        throw new Error('OpenAI quota exceeded. AI processing is temporarily unavailable. Please wait 1 minute before retrying.');
      }
      
      // Check if it's a rate limit error
      if (error?.status === 429 || error?.message?.includes('Rate limit')) {
        const waitTime = Math.min(2000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
        console.warn(`Rate limit hit in extractWithAI, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      console.error(`Error with AI extraction (attempt ${retryCount}):`, error);
      
      if (retryCount >= maxRetries) {
        console.warn(`Max retries reached in extractWithAI, returning empty result`);
        return { products: [] };
      }
    }
  }

  return { products: [] };
}

async function processExtractedData(
  extractedData: ExtractedProduct[],
  supplierId: string,
  uploadId: string
) {
  for (const item of extractedData) {
    try {
      // Normalize the product data using the new normalizer
      const normalizedProduct = dataNormalizer.normalizeProduct(item);
      
      // Skip products with no price (likely category headers or invalid data)
      if (!normalizedProduct.price || normalizedProduct.price <= 0) {
        console.log(`⚠️ Skipping product with no price: "${normalizedProduct.name}"`);
        continue;
      }
      
      // AI standardization for matching (передаем категорию для улучшения embedding поиска)
      const category = normalizedProduct.category || categorizeProduct(normalizedProduct.name);
      const standardizedName = await standardizeProductNameWithAI(normalizedProduct.name, category);
      const standardizedUnit = standardizeUnit(normalizedProduct.unit);

      console.log(`Processing: "${item.name}" → normalized: "${normalizedProduct.name}" → standardized: "${standardizedName}"`);

      // Find existing product by exact match first
      let product = await prisma.product.findFirst({
        where: {
          standardizedName: standardizedName,
          standardizedUnit: standardizedUnit
        }
      });

      // If no exact match, check for similar products (96% similarity)
      if (!product) {
        product = await findSimilarProduct(standardizedName, standardizedUnit);
        if (product) {
          console.log(`Found similar product: "${product.standardizedName}" for "${standardizedName}" (96% match)`);
        }
      }

      if (!product) {
        // Create new product with all variants
        product = await prisma.product.create({
          data: {
            rawName: item.name,                    // Original from supplier
            name: normalizedProduct.name,          // Normalized for display
            standardizedName: standardizedName,    // AI-standardized for matching
            category: category,
            unit: normalizedProduct.unit,
            standardizedUnit: standardizedUnit,
            description: normalizedProduct.description || item.description
          }
        });
        
        console.log(`Created new product: "${normalizedProduct.name}" (standardized: "${standardizedName}")`);
      } else {
        console.log(`Found existing product: "${product.name}" (standardized: "${standardizedName}")`);
      }

      // Verify supplier exists before creating price
      const supplierExists = await prisma.supplier.findUnique({
        where: { id: supplierId }
      });

      if (!supplierExists) {
        console.error(`Supplier with id ${supplierId} does not exist, skipping price creation for product ${item.name}`);
        return; // Skip this product
      }

      // Create or update price using normalized data
      // First, invalidate any existing prices for this supplier-product combination
      await prisma.price.updateMany({
        where: {
          supplierId: supplierId,
          productId: product.id,
          validTo: null // Only current prices
        },
        data: {
          validTo: new Date() // Mark as expired
        }
      });

      // Then create the new price record
      await prisma.price.create({
        data: {
          amount: normalizedProduct.price,
          unit: normalizedProduct.unit,
          supplierId: supplierId,
          productId: product.id,
          uploadId: uploadId,
          validFrom: new Date()
        }
      });

    } catch (error) {
      console.error(`Error processing product ${item.name}:`, error);
    }
  }
}

// Function to calculate string similarity using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
}

// Function to find similar products with 96% similarity
async function findSimilarProduct(standardizedName: string, standardizedUnit: string) {
  try {
    // Get all products with the same unit
    const products = await prisma.product.findMany({
      where: {
        standardizedUnit: standardizedUnit
      },
      select: {
        id: true,
        standardizedName: true,
        standardizedUnit: true
      }
    });

    // Find products with 96% or higher similarity
    for (const product of products) {
      const similarity = calculateSimilarity(standardizedName.toLowerCase(), product.standardizedName.toLowerCase());
      if (similarity >= 0.96) {
        return await prisma.product.findUnique({
          where: { id: product.id }
        });
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding similar product:', error);
    return null;
  }
}

async function standardizeProductNameWithAI(rawName: string, category?: string): Promise<string> {
  try {
    console.log(`🔍 Standardizing: "${rawName}" (category: ${category || 'unknown'})`);
    
    // Step 1: Попробуем найти в embedding базе
    const similarProduct = await embeddingService.findSimilarProduct(rawName, category);
    
    if (similarProduct) {
      console.log(`✅ Found via embedding: "${rawName}" → "${similarProduct.product.standardName}" (similarity: ${similarProduct.similarity.toFixed(3)})`);
      return similarProduct.product.standardName;
    }
    
    // Step 2: Если не найдено в embedding - используем GPT-4o
    console.log(`🤖 Using GPT-4o for: "${rawName}"`);
    
    // Check if quota is exhausted and if we should retry
    if (quotaExhausted) {
      const timeWaited = Date.now() - quotaExhaustedTime;
      const minutesLeft = Math.ceil((QUOTA_RESET_WAIT - timeWaited) / 60000);
      
      if (timeWaited < QUOTA_RESET_WAIT) {
        console.log(`⚠️ OpenAI quota exhausted, using fallback for "${rawName}" (${minutesLeft} minutes left)`);
        return fallbackStandardization(rawName);
      } else {
        // Reset quota status after wait period
        quotaExhausted = false;
        quotaExhaustedTime = 0;
        console.log('✅ Attempting to resume AI standardization after quota wait period');
      }
    }

    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Add delay to respect rate limits (500ms between requests for better compliance)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await openai.chat.completions.create({
          model: 'gpt-o3',
          max_tokens: 50, // Ограничиваем токены для экономии
          messages: [{
            role: 'user',
            content: `Standardize this product name to English for food/grocery product matching across suppliers. 

Product name: "${rawName}"
Category: ${category || 'unknown'}

Rules:
- Convert to English if in other language (telur→egg, beras→rice, ayam→chicken, etc.)
- Use singular form (tomatoes→tomato, potatoes→potato)
- Fix common spelling errors (zukini→zucchini, brocoli→broccoli, coliflower→cauliflower)
- Remove brand names and supplier-specific terms
- Use correct spelling and common food terminology
- IMPORTANT: Put the main noun FIRST, then characteristics (apple red, onion brown, tomato cherry, banana cavendish)
- Keep it simple and generic for matching
- Examples: 
  * "Cherry Tomatoes Premium" → "tomato cherry"
  * "Telur Ayam Grade A" → "egg chicken"
  * "Beras Jasmine" → "rice jasmine"
  * "Red Onion" → "onion red"
  * "Baby Cucumber" → "cucumber baby"

Return only the standardized name, nothing else.`
          }],
          temperature: 0.1,
        }, {
          timeout: 15000,
        });

        let standardized = response.choices[0]?.message?.content?.trim();
        
        if (!standardized) {
          console.warn(`AI standardization failed for "${rawName}", using fallback`);
          return fallbackStandardization(rawName);
        }

        // Remove quotes if AI returned the result in quotes
        if (standardized.startsWith('"') && standardized.endsWith('"')) {
          standardized = standardized.slice(1, -1);
        }
        if (standardized.startsWith("'") && standardized.endsWith("'")) {
          standardized = standardized.slice(1, -1);
        }
        
        standardized = standardized.toLowerCase().trim();

        console.log(`🎯 GPT-4o standardized: "${rawName}" → "${standardized}"`);
        
        // Step 3: Добавляем новый продукт в эталонную базу
        if (category) {
          await embeddingService.addToReferenceBase(rawName, standardized, category);
        }
        
        return standardized;

      } catch (error: any) {
        retryCount++;
        
        // Check if it's a quota exhaustion error
        if (error?.status === 429 && error?.code === 'insufficient_quota') {
          quotaExhausted = true;
          quotaExhaustedTime = Date.now();
          console.log(`❌ OpenAI quota exhausted during standardization for "${rawName}", using fallback`);
          return fallbackStandardization(rawName);
        }
        
        // Check if it's a rate limit error
        if (error?.status === 429 || error?.message?.includes('Rate limit')) {
          const waitTime = Math.min(2000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
          console.warn(`Rate limit hit for "${rawName}", retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`);
          
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        console.error(`Error in AI standardization for "${rawName}" (attempt ${retryCount}):`, error);
        
        if (retryCount >= maxRetries) {
          console.warn(`Max retries reached for "${rawName}", using fallback`);
          return fallbackStandardization(rawName);
        }
      }
    }
    
    return fallbackStandardization(rawName);
    
  } catch (error) {
    console.error(`Error in hybrid standardization for "${rawName}":`, error);
    return fallbackStandardization(rawName);
  }
}

function fallbackStandardization(name: string): string {
  let result = name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    // Fix common spelling errors
    .replace(/zukini/gi, 'zucchini')
    .replace(/brocoli/gi, 'broccoli')
    .replace(/coliflower/gi, 'cauliflower')
    .replace(/buttom/gi, 'button')
    .replace(/masroom/gi, 'mushroom')
    .replace(/simeji/gi, 'shimeji')
    .replace(/pokcoy/gi, 'pak choi')
    .replace(/coocking/gi, 'cooking')
    // Indonesian to English
    .replace(/telur/i, 'egg')
    .replace(/ayam/i, 'chicken')
    .replace(/beras/i, 'rice')
    .replace(/daging/i, 'meat')
    .replace(/ikan/i, 'fish')
    .replace(/daun/i, 'leaf')
    .replace(/bawang/i, 'onion');
    
  // Reorder to put noun first
  result = result
    .replace(/cherry\s+tomato/i, 'tomato cherry')
    .replace(/red\s+onion/i, 'onion red')
    .replace(/brown\s+onion/i, 'onion brown')
    .replace(/spring\s+onion/i, 'onion spring')
    .replace(/baby\s+(\w+)/i, '$1 baby')
    .replace(/jasmine\s+rice/i, 'rice jasmine')
    .replace(/breast\s+chicken/i, 'chicken breast');
    
  return result;
}

function standardizeUnit(unit: string): string {
  const unitMap: { [key: string]: string } = {
    // Weight units
    'kg': 'kg',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'kilo': 'kg',
    'g': 'g',
    'gram': 'g',
    'grams': 'g',
    'gr': 'g',
    'lb': 'lb',
    'pound': 'lb',
    'pounds': 'lb',
    'lbs': 'lb',
    'oz': 'oz',
    'ounce': 'oz',
    'ounces': 'oz',
    
    // Volume units
    'l': 'l',
    'liter': 'l',
    'litre': 'l',
    'liters': 'l',
    'litres': 'l',
    'ltr': 'l',
    'gln': 'l',
    'gallon': 'l',
    'ml': 'ml',
    'milliliter': 'ml',
    'milliliters': 'ml',
    
    // Count/Bunch (Indonesian terms)
    'sisir': 'bunch',
    'ssr': 'bunch',
    'ikat': 'bunch',
    'ijas': 'bunch',
    'bunch': 'bunch',
    
    // Pieces
    'piece': 'pcs',
    'pieces': 'pcs',
    'pcs': 'pcs',
    'each': 'pcs',
    'pc': 'pcs',
    'item': 'pcs',
    'unit': 'pcs',
    
    // Packs
    'pack': 'pack',
    'package': 'pack',
    'pck': 'pack',
    'pax': 'pack',
    'packet': 'pack',
    
    // Bottles
    'bottle': 'bottle',
    'bottles': 'bottle',
    'btl': 'bottle',
    
    // Cans
    'can': 'can',
    'cans': 'can',
    
    // Boxes
    'box': 'box',
    'boxes': 'box',
    
    // Others
    'lepit': 'pcs',
    'krat': 'crate',
    'tpls': 'pcs'
  };

  const normalized = unit.toLowerCase().trim();
  return unitMap[normalized] || normalized;
}

function categorizeProduct(name: string): string {
  const lowerName = name.toLowerCase();
  
  // Vegetables
  if (lowerName.includes('asparagus') || lowerName.includes('tomato') || lowerName.includes('onion') || 
      lowerName.includes('carrot') || lowerName.includes('potato') || lowerName.includes('cabbage') ||
      lowerName.includes('lettuce') || lowerName.includes('spinach') || lowerName.includes('broccoli') ||
      lowerName.includes('cauliflower') || lowerName.includes('pepper') || lowerName.includes('cucumber') ||
      lowerName.includes('celery') || lowerName.includes('zucchini') || lowerName.includes('eggplant') ||
      lowerName.includes('bean') || lowerName.includes('pea') || lowerName.includes('corn') ||
      lowerName.includes('mushroom') || lowerName.includes('vegetable')) {
    return 'Vegetables';
  }
  
  // Meat
  if (lowerName.includes('chicken') || lowerName.includes('beef') || 
      lowerName.includes('pork') || lowerName.includes('meat') || lowerName.includes('lamb') ||
      lowerName.includes('duck') || lowerName.includes('turkey') || lowerName.includes('sausage') ||
      lowerName.includes('bacon')) {
    return 'Meat';
  }
  
  // Seafood
  if (lowerName.includes('fish') || lowerName.includes('salmon') || 
      lowerName.includes('tuna') || lowerName.includes('seafood') || lowerName.includes('shrimp') ||
      lowerName.includes('crab') || lowerName.includes('lobster') || lowerName.includes('squid') ||
      lowerName.includes('prawn')) {
    return 'Seafood';
  }
  
  // Grains
  if (lowerName.includes('rice') || lowerName.includes('flour') || 
      lowerName.includes('bread') || lowerName.includes('grain') || lowerName.includes('pasta') ||
      lowerName.includes('noodle') || lowerName.includes('wheat') || lowerName.includes('oat') ||
      lowerName.includes('barley')) {
    return 'Grains';
  }
  
  // Dairy
  if (lowerName.includes('milk') || lowerName.includes('cheese') || 
      lowerName.includes('yogurt') || lowerName.includes('dairy') || lowerName.includes('butter') ||
      lowerName.includes('cream')) {
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
  // "Island Organics Bali.pdf" -> "Island Organics Bali"
  // "Oka veg supplier.xlsx" -> "Oka Veg Supplier"
  // "bali boga.pdf" -> "Bali Boga"
  
  const basename = filename.split('/').pop()?.split('.')[0] || '';
  
  // Common patterns to remove (but keep more of the name)
  const removePatterns = [
    /price\s*list/i,
    /price\s*quotation/i,
    /pricelist/i,
    /catalog/i,
    /\b\d{4}\b/g, // years like 2024
    /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g, // dates like 24/02/2025
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{2,4}/gi, // dates like 24 Feb 2025
    /\s+for\s+.+$/i, // remove "for EGGSTRA CAFE" etc
    /\s*\(.+\)\s*$/i, // remove content in parentheses at the end
  ];
  
  let cleanName = basename
    .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2'); // camelCase to spaces
  
  // Remove patterns
  removePatterns.forEach(pattern => {
    cleanName = cleanName.replace(pattern, '');
  });
  
  // Special handling for known patterns
  cleanName = cleanName
    .replace(/\bPT\.?\s*/i, 'PT. ') // Standardize PT.
    .replace(/\s+supplier\s*$/i, '') // Remove "supplier" at the end
    .replace(/\s+vegetables?\s*$/i, '') // Remove "vegetable(s)" at the end
    .trim();
  
  // Clean up and capitalize properly
  cleanName = cleanName
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .split(' ')
    .map(word => {
      // Keep acronyms uppercase
      if (word.toUpperCase() === word && word.length <= 3) {
        return word;
      }
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  
  // Return null if the result is too short or generic
  if (cleanName.length < 3 || ['File', 'Document', 'List', 'Pdf', 'Xlsx', 'Csv'].includes(cleanName)) {
    return null;
  }
  
  return cleanName;
}