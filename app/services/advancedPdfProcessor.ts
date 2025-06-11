import OpenAI from 'openai';

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

export class AdvancedPdfProcessor {
  
  /**
   * Обрабатывает сложный PDF файл с гибридным подходом
   */
  async processComplexPdf(fileUrl: string): Promise<ExtractedData> {
    console.log('🔄 Starting advanced PDF processing for:', fileUrl);
    
    try {
      // Step 1: Попробуем Camelot для извлечения таблиц (приоритетный метод)
      const camelotData = await this.extractTablesWithCamelot(fileUrl);
      console.log(`📊 Camelot extraction: ${camelotData.products.length} products found`);
      
      // Step 2: Если Camelot нашел достаточно данных, используем его
      if (camelotData.products.length > 10) {
        console.log('✅ Camelot extraction successful, using table-based results');
        return camelotData;
      }
      
      // Step 3: Иначе пытаемся извлечь текстовую информацию (fallback)
      const textData = await this.extractTextFromPdf(fileUrl);
      console.log(`📝 Text extraction: ${textData.products.length} products found`);
      
      // Step 4: Обрабатываем PDF как последовательность изображений для Vision API
      const visionData = await this.processPdfAsImages(fileUrl);
      console.log(`👁️ Vision processing: ${visionData.products.length} products found`);
      
      // Step 5: Интеллектуально объединяем результаты
      const mergedData = await this.mergeExtractedData(textData, visionData);
      
      // Step 6: Если Camelot тоже что-то нашел, добавляем и эти данные
      if (camelotData.products.length > 0) {
        const finalMerged = await this.mergeExtractedData(mergedData, camelotData);
        console.log(`🔗 Final merged result: ${finalMerged.products.length} total products`);
        return finalMerged;
      }
      
      console.log(`🔗 Merged result: ${mergedData.products.length} total products`);
      return mergedData;
      
    } catch (error) {
      console.error('❌ Advanced PDF processing failed:', error);
      throw error;
    }
  }
  
  /**
   * Извлекает таблицы из PDF используя Camelot через Python скрипт
   */
  private async extractTablesWithCamelot(fileUrl: string): Promise<ExtractedData> {
    try {
      console.log('📊 Starting Camelot table extraction for:', fileUrl);
      
      // Run Python script to process PDF with Camelot
      const { spawn } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.join(process.cwd(), 'scripts', 'pdf_table_processor.py');
      console.log('🐍 Python script path:', scriptPath);
      console.log('🔗 Processing URL:', fileUrl);
      
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', [scriptPath, fileUrl, '--json-only'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let outputData = '';
        let errorData = '';
        
        pythonProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          outputData += chunk;
          console.log('📤 Python stdout chunk:', chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        });
        
        pythonProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          errorData += chunk;
          console.log('📤 Python stderr:', chunk);
        });
        
        pythonProcess.on('close', (code) => {
          console.log(`🔚 Python process finished with code: ${code}`);
          console.log(`📊 Total stdout length: ${outputData.length} characters`);
          console.log(`📊 Total stderr length: ${errorData.length} characters`);
          
          if (code === 0) {
            try {
              console.log('🔍 Processing JSON output from --json-only mode...');
              
              // With --json-only flag, the last line should be pure JSON
              const lines = outputData.trim().split('\n');
              let jsonResult = null;
              
              // Look for JSON in the last line (--json-only mode)
              const lastLine = lines[lines.length - 1]?.trim();
              if (lastLine && lastLine.startsWith('{')) {
                console.log('✅ Found JSON in last line (--json-only mode)');
                jsonResult = lastLine;
              } else {
                // Fallback: look for any line that starts with {
                for (let i = lines.length - 1; i >= 0; i--) {
                  const line = lines[i].trim();
                  if (line.startsWith('{')) {
                    console.log(`✅ Found JSON at line ${i} (fallback)`);
                    jsonResult = line;
                    break;
                  }
                }
              }
              
              if (jsonResult) {
                console.log('🔍 Attempting to parse JSON...');
                console.log('📝 JSON preview:', jsonResult.substring(0, 500) + '...');
                
                const result = JSON.parse(jsonResult);
                const productCount = result.products?.length || 0;
                console.log(`✅ Camelot successfully extracted ${productCount} products`);
                
                if (productCount > 0) {
                  console.log(`📋 Sample products:`, result.products.slice(0, 3).map(p => p.name));
                }
                
                resolve(result);
              } else {
                console.warn('⚠️ No JSON output found from Camelot script');
                console.log('📝 Raw output preview:', outputData.substring(0, 1000));
                resolve({ products: [] });
              }
            } catch (parseError) {
              console.error('❌ Error parsing Camelot JSON output:', parseError);
              console.log('📝 Raw output that failed to parse:', outputData);
              resolve({ products: [] });
            }
          } else {
            console.error(`❌ Camelot script failed with exit code ${code}`);
            console.error('📝 Error output:', errorData);
            console.error('📝 Stdout output:', outputData);
            resolve({ products: [] });
          }
        });
        
        // Set timeout for long-running processes
        const timeoutHandle = setTimeout(() => {
          pythonProcess.kill('SIGTERM');
          console.warn('⚠️ Camelot processing timeout after 120 seconds, falling back to other methods');
          resolve({ products: [] });
        }, 120000); // 120 seconds timeout
        
        pythonProcess.on('close', () => {
          clearTimeout(timeoutHandle); // Clear timeout when process completes
        });
      });
      
    } catch (error) {
      console.error('❌ Camelot extraction failed:', error);
      return { products: [] };
    }
  }
  
  /**
   * Извлекает текстовые данные из PDF
   */
  private async extractTextFromPdf(fileUrl: string): Promise<ExtractedData> {
    try {
      console.log('📄 Attempting text extraction from PDF...');
      
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Try multiple PDF parsing approaches
      let extractedText = '';
      
      // Approach 1: pdfjs-dist
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const pdf = await pdfjsLib.getDocument({
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true
        }).promise;
        
        console.log(`📖 PDF has ${pdf.numPages} pages`);
        
        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          if (pageText.trim()) {
            extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
            console.log(`📄 Page ${pageNum}: ${pageText.length} characters extracted`);
          }
        }
        
      } catch (pdfjsError) {
        console.warn('⚠️ pdfjs-dist failed, trying alternative approaches:', pdfjsError);
        
        // Approach 2: Try to extract any readable content using raw analysis
        const rawText = await this.analyzeRawPdfContent(arrayBuffer);
        extractedText = rawText;
        
        // Approach 3: If still no text, try extracting metadata and structure info
        if (!extractedText.trim()) {
          extractedText = await this.extractPdfMetadata(arrayBuffer);
        }
      }
      
      if (!extractedText.trim()) {
        console.warn('⚠️ No text content extracted from PDF');
        return { products: [] };
      }
      
      console.log(`📝 Total text extracted: ${extractedText.length} characters`);
      
      // Process extracted text with AI
      return await this.processTextWithAI(extractedText, 'pdf-text');
      
    } catch (error) {
      console.error('❌ Text extraction failed:', error);
      return { products: [] };
    }
  }
  
  /**
   * Обрабатывает PDF как последовательность изображений
   */
  private async processPdfAsImages(fileUrl: string): Promise<ExtractedData> {
    try {
      console.log('🖼️ Processing PDF as images with Vision API...');
      
      // Step 1: Try direct Vision API call first (some PDFs work)
      try {
        const directVisionResult = await this.processWithVisionAPI(fileUrl);
        if (directVisionResult.products.length > 0) {
          console.log(`✅ Direct PDF Vision API successful: ${directVisionResult.products.length} products`);
          return directVisionResult;
        }
      } catch (directError) {
        console.log('📄 Direct PDF Vision processing failed, proceeding with page-by-page conversion');
      }
      
      // Step 2: Convert PDF pages to images and process each page
      try {
        const pageResults = await this.convertPdfPagesToImages(fileUrl);
        if (pageResults.products.length > 0) {
          console.log(`✅ Page-by-page Vision processing: ${pageResults.products.length} products`);
          return pageResults;
        }
      } catch (conversionError) {
        console.error('❌ PDF page conversion failed:', conversionError);
      }
      
      console.log('⚠️ All image processing methods failed, returning empty result');
      return { products: [] };
      
    } catch (error) {
      console.error('❌ Image processing failed:', error);
      return { products: [] };
    }
  }
  
  /**
   * Конвертирует PDF страницы в изображения и обрабатывает каждую через Vision API
   */
  private async convertPdfPagesToImages(fileUrl: string): Promise<ExtractedData> {
    try {
      console.log('🔄 Converting PDF pages to images for Vision processing...');
      
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Import PDF.js for page conversion
      const pdfjsLib = await import('pdfjs-dist');
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      }).promise;
      
      console.log(`📖 Converting ${pdf.numPages} pages to images...`);
      
      const allResults: ExtractedData[] = [];
      const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages for cost control
      
      // Process each page as an image
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          console.log(`🖼️ Processing page ${pageNum}/${maxPages}...`);
          
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // High resolution for better OCR
          
          // Create canvas to render page
          const canvas = this.createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');
          
          if (!context) {
            console.warn(`⚠️ Failed to get canvas context for page ${pageNum}`);
            continue;
          }
          
          // Render page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Convert canvas to base64 image
          const imageDataUrl = canvas.toDataURL('image/png');
          
          // Process the page image with Vision API
          const pageResult = await this.processPageImage(imageDataUrl, pageNum);
          
          if (pageResult.products.length > 0) {
            console.log(`✅ Page ${pageNum}: Found ${pageResult.products.length} products`);
            allResults.push(pageResult);
          } else {
            console.log(`📄 Page ${pageNum}: No products found`);
          }
          
          // Rate limiting - wait between pages
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageNum}:`, pageError);
          continue;
        }
      }
      
      // Merge results from all pages
      const mergedResult: ExtractedData = {
        supplier: allResults.find(r => r.supplier)?.supplier,
        products: allResults.flatMap(r => r.products || [])
      };
      
      console.log(`📊 PDF page conversion summary: Processed ${maxPages} pages, found ${mergedResult.products.length} total products`);
      
      return mergedResult;
      
    } catch (error) {
      console.error('❌ PDF to image conversion failed:', error);
      return { products: [] };
    }
  }
  
  /**
   * Создает canvas элемент для рендеринга PDF страниц
   */
  private createCanvas(width: number, height: number): any {
    try {
      // Try to use Node.js canvas if available
      const { createCanvas } = require('canvas');
      return createCanvas(width, height);
    } catch (canvasError) {
      // Fallback to basic canvas simulation for serverless
      console.warn('⚠️ Node canvas not available, using fallback canvas simulation');
      
      return {
        width,
        height,
        getContext: () => ({
          drawImage: () => {},
          fillRect: () => {},
          clearRect: () => {},
        }),
        toDataURL: () => {
          // Return a placeholder - this would need proper implementation
          console.warn('⚠️ Canvas toDataURL not implemented in fallback mode');
          return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        }
      };
    }
  }
  
  /**
   * Обрабатывает изображение страницы через Vision API
   */
  private async processPageImage(imageDataUrl: string, pageNumber: number): Promise<ExtractedData> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-o3",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this PDF page (page ${pageNumber}) which may contain product listings, price information, or product photos. 
                
                This document has a complex structure:
                - Text-based product lists may appear at the beginning
                - Product photos with names/prices may appear at the end
                - Each page may contain different types of content
                
                Extract ALL products visible on this page with their pricing information.
                
                Return a JSON object with this structure:
                {
                  "supplier": {
                    "name": "supplier name if found",
                    "email": "email if found",
                    "phone": "phone if found", 
                    "address": "address if found"
                  },
                  "products": [
                    {
                      "name": "product name",
                      "price": numeric_price,
                      "unit": "unit (kg, pcs, etc.)",
                      "category": "category if obvious",
                      "description": "additional details if any"
                    }
                  ]
                }
                
                Important:
                - Extract ALL products from this page, both from text AND from product photos
                - For product photos, read any visible text on the image for names and prices
                - If prices are not clearly visible, focus on extracting product names
                - Clean up product names (remove extra spaces, standardize formatting)
                - Infer categories when obvious (vegetables, fruits, organic, etc.)
                - Return valid JSON only, no other text`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { products: [] };
      }

      // Parse JSON response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanContent);
      return result;
      
    } catch (error) {
      console.error(`❌ Error processing page ${pageNumber} image:`, error);
      return { products: [] };
    }
  }
  
  /**
   * Анализирует сырое содержимое PDF для извлечения читаемого текста
   */
  private async analyzeRawPdfContent(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      // Convert to text and look for readable patterns
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('');
      
      // Extract readable text using regex patterns
      const textMatches = binaryString.match(/[A-Za-z0-9\s\.,;:\-\(\)\[\]]{10,}/g) || [];
      const extractedText = textMatches
        .filter(text => text.trim().length > 5)
        .join('\n');
      
      console.log(`🔍 Raw analysis extracted ${extractedText.length} characters`);
      return extractedText;
      
    } catch (error) {
      console.error('❌ Raw PDF analysis failed:', error);
      return '';
    }
  }
  
  /**
   * Извлекает метаданные из PDF для альтернативного анализа
   */
  private async extractPdfMetadata(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      console.log('📋 Extracting PDF metadata and structure info...');
      
      // Convert to string for metadata search
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('');
      
      let metadataText = '';
      
      // Look for PDF metadata
      const titleMatch = binaryString.match(/\/Title\s*\(([^)]+)\)/);
      if (titleMatch) {
        metadataText += `Title: ${titleMatch[1]}\n`;
      }
      
      const authorMatch = binaryString.match(/\/Author\s*\(([^)]+)\)/);
      if (authorMatch) {
        metadataText += `Author: ${authorMatch[1]}\n`;
      }
      
      const subjectMatch = binaryString.match(/\/Subject\s*\(([^)]+)\)/);
      if (subjectMatch) {
        metadataText += `Subject: ${subjectMatch[1]}\n`;
      }
      
      // Look for embedded text objects
      const textObjects = binaryString.match(/BT\s+([^ET]+)\s+ET/g) || [];
      for (const textObj of textObjects.slice(0, 10)) { // Limit to avoid too much data
        // Extract text from PDF text objects
        const textMatch = textObj.match(/\(([^)]+)\)/g);
        if (textMatch) {
          const extractedFromObj = textMatch.map(m => m.slice(1, -1)).join(' ');
          if (extractedFromObj.length > 3) {
            metadataText += `Text Object: ${extractedFromObj}\n`;
          }
        }
      }
      
      // Look for streams that might contain readable text
      const streamMatches = binaryString.match(/stream\s+([\s\S]*?)\s+endstream/g) || [];
      for (const stream of streamMatches.slice(0, 5)) { // Limit streams processed
        const readable = stream.match(/[A-Za-z][A-Za-z0-9\s\.,]{5,}/g) || [];
        for (const text of readable.slice(0, 10)) {
          if (text.trim().length > 5) {
            metadataText += `Stream Text: ${text.trim()}\n`;
          }
        }
      }
      
      console.log(`📋 Metadata extraction found ${metadataText.length} characters`);
      return metadataText || 'No readable metadata found';
      
    } catch (error) {
      console.error('❌ PDF metadata extraction failed:', error);
      return 'Metadata extraction failed';
    }
  }
  
  /**
   * Использует Vision API для обработки PDF/изображения
   */
  private async processWithVisionAPI(fileUrl: string): Promise<ExtractedData> {
    try {
      console.log('👁️ Using Vision API for document analysis...');
      
      const response = await openai.chat.completions.create({
        model: "gpt-o3",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this document (PDF/image) which contains a price list or product catalog. 
                
                Extract ALL products with their pricing information. This document may have:
                - A text-based product list at the beginning
                - Product photos/images at the end
                - Mixed content with both text and images
                
                Return a JSON object with this structure:
                {
                  "supplier": {
                    "name": "supplier name",
                    "email": "email if found",
                    "phone": "phone if found",
                    "address": "address if found"
                  },
                  "products": [
                    {
                      "name": "product name",
                      "price": numeric_price,
                      "unit": "unit (kg, pcs, etc.)",
                      "category": "category if obvious",
                      "description": "additional details if any"
                    }
                  ]
                }
                
                Important:
                - Extract ALL products, both from text lists AND from product photos
                - For product photos, identify the product name from the image and any visible pricing
                - If no clear price is visible, focus on extracting the product names
                - Clean up product names (remove extra spaces, standardize formatting)
                - Infer categories when obvious (vegetables, fruits, organic, etc.)
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
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Vision API');
      }

      // Parse JSON response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanContent);
      console.log(`✅ Vision API extracted ${result.products?.length || 0} products`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Vision API processing failed:', error);
      throw error;
    }
  }
  
  /**
   * Обрабатывает текст с помощью AI
   */
  private async processTextWithAI(text: string, source: string): Promise<ExtractedData> {
    try {
      // Limit text size
      let processText = text;
      if (processText.length > 12000) {
        processText = processText.substring(0, 12000) + '\n... (truncated)';
      }
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [{ 
          role: 'user', 
          content: `Extract supplier and product information from this ${source} content:

${processText}

Return a JSON object with this structure:
{
  "supplier": {
    "name": "supplier name",
    "email": "email if found", 
    "phone": "phone if found",
    "address": "address if found"
  },
  "products": [
    {
      "name": "product name",
      "price": numeric_price,
      "unit": "unit (kg, pcs, etc.)",
      "category": "category if obvious",
      "description": "additional details if any"
    }
  ]
}

Rules:
- Extract ALL products with clear prices
- Clean up product names (remove extra spaces, standardize formatting)
- Standardize units (kg, pcs, etc.)
- Infer categories when obvious (vegetables, fruits, meat, etc.)
- If supplier info not found, omit supplier field
- Return valid JSON only, no other text` 
        }],
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(cleanContent);
      
    } catch (error) {
      console.error('❌ AI text processing failed:', error);
      return { products: [] };
    }
  }
  
  /**
   * Интеллектуально объединяет данные из разных источников
   */
  private async mergeExtractedData(textData: ExtractedData, visionData: ExtractedData): Promise<ExtractedData> {
    try {
      console.log('🔗 Merging data from text and vision sources...');
      
      // Combine supplier info (prefer more complete one)
      const supplier = this.getBestSupplierInfo(textData.supplier, visionData.supplier);
      
      // Combine and deduplicate products
      const allProducts = [...(textData.products || []), ...(visionData.products || [])];
      const deduplicatedProducts = await this.deduplicateProducts(allProducts);
      
      console.log(`📊 Merge summary: ${textData.products.length} text + ${visionData.products.length} vision = ${deduplicatedProducts.length} unique products`);
      
      return {
        supplier,
        products: deduplicatedProducts
      };
      
    } catch (error) {
      console.error('❌ Data merging failed:', error);
      // Return best available data
      const textProductCount = textData.products?.length || 0;
      const visionProductCount = visionData.products?.length || 0;
      
      return textProductCount >= visionProductCount ? textData : visionData;
    }
  }
  
  /**
   * Выбирает лучшую информацию о поставщике
   */
  private getBestSupplierInfo(supplier1?: any, supplier2?: any): any {
    if (!supplier1) return supplier2;
    if (!supplier2) return supplier1;
    
    // Prefer supplier with more complete information
    const score1 = this.getSupplierScore(supplier1);
    const score2 = this.getSupplierScore(supplier2);
    
    return score1 >= score2 ? supplier1 : supplier2;
  }
  
  private getSupplierScore(supplier: any): number {
    if (!supplier) return 0;
    return (supplier.name ? 1 : 0) + 
           (supplier.email ? 1 : 0) + 
           (supplier.phone ? 1 : 0) + 
           (supplier.address ? 1 : 0);
  }
  
  /**
   * Удаляет дубликаты продуктов
   */
  private async deduplicateProducts(products: ExtractedProduct[]): Promise<ExtractedProduct[]> {
    if (products.length <= 1) return products;
    
    const uniqueProducts: ExtractedProduct[] = [];
    const seenNames = new Set<string>();
    
    for (const product of products) {
      const normalizedName = product.name.toLowerCase().trim().replace(/\s+/g, ' ');
      
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        uniqueProducts.push(product);
      } else {
        console.log(`🔄 Deduplicated: "${product.name}"`);
      }
    }
    
    return uniqueProducts;
  }
}

// Export singleton instance
export const advancedPdfProcessor = new AdvancedPdfProcessor();