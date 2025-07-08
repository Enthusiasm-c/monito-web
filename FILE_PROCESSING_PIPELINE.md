# File Processing Pipeline Documentation

## 📋 Overview

This document describes the complete file processing pipeline for the Monito Web price comparison platform, from initial file upload through AI-powered standardization to database storage.

## 🔄 Pipeline Architecture

```
File Upload → Format Detection → AI Extraction → Data Normalization → AI Standardization → Database Storage
     ↓              ↓                ↓               ↓                  ↓                    ↓
 Multi-format    Type Analysis    Gemini/GPT     Price Validation    o3-mini/GPT-4o     PostgreSQL
  Support        & Routing        Processing      & Cleaning        Translation        with Prisma
```

## 📁 Supported File Formats

### 1. Excel Files (.xlsx, .xls)
**Handler**: `enhancedExcelExtractor.ts`
**AI Service**: Google Gemini 2.0 Flash + ExcelJS

#### Processing Steps:
1. **ExcelJS Parsing**: Native JavaScript parsing for structured data
2. **AI Vision Fallback**: For complex layouts or corrupted files
3. **Multi-sheet Support**: Processes all sheets automatically
4. **Header Detection**: Smart detection of product/price columns
5. **Data Validation**: Price format validation and unit extraction

#### Supported Layouts:
- Standard price lists (Product | Price | Unit)
- Multi-column formats with descriptions
- Headers in any row (auto-detected)
- Mixed data types (text, numbers, formulas)
- Merged cells and complex formatting

### 2. PDF Documents (.pdf)
**Handler**: `enhancedPdfExtractor.ts`
**AI Service**: Google Gemini 2.0 Flash (Vision)

#### Processing Steps:
1. **PDF to Image**: Convert PDF pages to high-resolution images
2. **AI Vision Analysis**: Gemini extracts tables and text
3. **OCR Enhancement**: Text recognition with error correction
4. **Table Structure**: Identifies product-price relationships
5. **Multi-page Support**: Processes all pages sequentially

#### Supported Layouts:
- Scanned price lists
- Digital PDFs with tables
- Mixed text and image content
- Multi-column layouts
- Handwritten notes (limited)

### 3. Image Files (.png, .jpg, .jpeg, .webp)
**Handler**: `optimizedImageProcessor.ts`
**AI Service**: Google Gemini 2.0 Flash (Vision)

#### Processing Steps:
1. **Image Preprocessing**: Rotation, contrast enhancement
2. **AI Vision Extraction**: Direct image-to-data processing
3. **Text Recognition**: OCR with context understanding
4. **Layout Analysis**: Table and list structure detection

#### Supported Content:
- Price list photos
- Menu screenshots
- Handwritten lists
- Digital displays
- Product catalogs

### 4. CSV Files (.csv)
**Handler**: `enhancedFileProcessor.ts` (built-in)
**Processing**: Direct parsing with delimiter detection

#### Features:
- Auto-delimiter detection (comma, semicolon, tab)
- Header row identification
- Encoding detection (UTF-8, Latin-1)
- Quote handling and escape characters

## 🤖 AI Processing Services

### 1. Google Gemini 2.0 Flash
**Primary Use**: Document extraction and vision processing
**File**: `app/services/core/UnifiedGeminiService.ts`

#### Capabilities:
- **Vision Processing**: Extract data from images/PDFs
- **Large Context**: Handle documents up to 2 million tokens
- **Multimodal**: Process text, images, and tables simultaneously
- **Free Tier**: No cost for standard usage

#### Prompt Templates:
```typescript
const EXTRACTION_PROMPT = `
You are an expert at extracting product pricing data from documents.
Extract all products with their prices and units.
Focus on: product names, prices (in IDR), units, quantities.
Return structured JSON format.
`;
```

### 2. OpenAI o3-mini
**Primary Use**: Product name standardization and translation
**File**: `app/services/enhancedFileProcessor.ts`

#### Capabilities:
- **Indonesian → English Translation**: "apel fuji" → "Apple Fuji"
- **Name Standardization**: Consistent formatting and capitalization
- **Batch Processing**: Handle 50 products per request
- **Context Awareness**: Understand product categories

#### Standardization Prompt:
```typescript
const STANDARDIZATION_PROMPT = `
You are an expert product name standardizer for Indonesian wholesale markets.

Your task is to standardize product names by:
1. Translating Indonesian names to English (apel → Apple, wortel → Carrot)
2. Proper capitalization (Apple Fuji, not apple fuji)
3. Removing unnecessary modifiers but keeping important descriptors
4. Standardizing units and sizes
5. Removing brand names unless essential for identification

Common Indonesian translations:
- apel = Apple, wortel = Carrot, tomat = Tomato
- bawang = Onion, kentang = Potato, ayam = Chicken
- sapi = Beef, ikan = Fish

Return ONLY the standardized names, one per line, in exact same order as input.
`;
```

## 🔄 Complete Processing Flow

### Step 1: File Upload
**Endpoint**: `/api/upload-unified`
**Handler**: `app/api/upload-unified/route.ts`

```typescript
POST /api/upload-unified
Content-Type: multipart/form-data
{
  file: File,
  supplierName: string
}
```

#### Process:
1. **File Validation**: Size, type, format checks
2. **Supplier Handling**: Create or find existing supplier
3. **Upload Record**: Create database entry with pending status
4. **Queue Processing**: Add to background processing queue

### Step 2: Format Detection & Routing
**File**: `app/services/enhancedFileProcessor.ts`

```typescript
// Format detection based on MIME type and extension
switch (upload.mimeType) {
  case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
  case 'application/vnd.ms-excel':
    extractor = enhancedExcelExtractor;
    break;
  case 'application/pdf':
    extractor = enhancedPdfExtractor;
    break;
  case 'image/jpeg':
  case 'image/png':
  case 'image/webp':
    extractor = optimizedImageProcessor;
    break;
  default:
    throw new Error(`Unsupported file type: ${upload.mimeType}`);
}
```

### Step 3: AI Extraction
**Service**: Format-specific extractor

#### Excel Processing:
```typescript
// enhancedExcelExtractor.ts
const result = await this.processWithExcelJS(fileBuffer);
if (!result.success && result.products.length < 5) {
  // Fallback to AI vision
  result = await this.processWithAIVision(fileBuffer);
}
```

#### PDF Processing:
```typescript
// enhancedPdfExtractor.ts
const images = await this.convertPdfToImages(fileBuffer);
const extractedData = await this.processImagesWithGemini(images);
```

#### Extraction Result Format:
```typescript
interface ExtractionResult {
  success: boolean;
  products: Array<{
    name: string;
    price: number;
    unit: string;
    quantity?: number;
    description?: string;
    category?: string;
  }>;
  totalRowsDetected: number;
  totalRowsProcessed: number;
  extractionMethod: 'exceljs' | 'gemini-vision' | 'ocr';
  confidence: number;
}
```

### Step 4: Data Normalization
**File**: `app/services/dataNormalizer.ts`

#### Price Normalization:
```typescript
// Clean and validate prices
normalizePrice(priceStr: string): number {
  // Remove currency symbols, commas, spaces
  // Handle different decimal separators
  // Validate realistic price ranges
  // Convert to consistent number format
}
```

#### Unit Standardization:
```typescript
// Standardize units
standardizeUnit(unit: string): string {
  const unitMap = {
    'kg': 'kg', 'kilo': 'kg', 'kilogram': 'kg',
    'pcs': 'pcs', 'piece': 'pcs', 'ea': 'pcs',
    'ltr': 'L', 'liter': 'L', 'litre': 'L'
  };
  return unitMap[unit.toLowerCase()] || unit;
}
```

### Step 5: AI Standardization
**Service**: OpenAI o3-mini via `standardizeProductNamesWithAI()`

#### Batch Processing:
```typescript
// Process ALL products through AI in batches of 50
const batchSize = 50;
const allStandardizedNames: string[] = [];

for (let i = 0; i < products.length; i += batchSize) {
  const batch = products.slice(i, i + batchSize);
  const batchResults = await this.processBatchWithAI(batch, metrics);
  allStandardizedNames.push(...batchResults);
}
```

#### Current Issue (Fixed):
- **Previous**: Only first 20 products got AI standardization
- **Current**: ALL products processed through o3-mini in batches
- **Result**: No more "apel fuji" → all become "Apple Fuji"

### Step 6: Database Storage
**ORM**: Prisma with PostgreSQL
**File**: `app/services/enhancedFileProcessor.ts`

#### Database Schema:
```sql
-- Products table
CREATE TABLE Product (
  id STRING PRIMARY KEY,
  rawName STRING,           -- Original extracted name
  name STRING,              -- Cleaned name
  standardizedName STRING,  -- AI-standardized name
  category STRING,
  unit STRING,
  standardizedUnit STRING,
  createdAt DATETIME,
  updatedAt DATETIME
);

-- Prices table
CREATE TABLE Price (
  id STRING PRIMARY KEY,
  amount DECIMAL,
  unit STRING,
  unitPrice DECIMAL,       -- Calculated per-unit price
  productId STRING,
  supplierId STRING,
  uploadId STRING,
  validFrom DATETIME,
  validTo DATETIME,        -- NULL for current prices
  createdAt DATETIME,
  updatedAt DATETIME
);

-- Price history for analytics
CREATE TABLE PriceHistory (
  id STRING PRIMARY KEY,
  productId STRING,
  supplierId STRING,
  price DECIMAL,
  changedAt DATETIME,
  changedFrom DECIMAL,
  changedTo DECIMAL
);
```

#### Storage Process:
```typescript
// Group products by standardized name to prevent duplicates
const productGroups = new Map<string, ProductGroup>();

for (const normalizedProduct of products) {
  const standardizedName = await standardizeWithAI(normalizedProduct.name);
  const groupKey = `${standardizedName}|${standardizedUnit}`;
  
  if (!productGroups.has(groupKey)) {
    // Create new product
    const product = await prisma.product.create({
      data: {
        rawName: normalizedProduct.name,
        name: cleanedName,
        standardizedName: standardizedName,
        category: categorizeProduct(standardizedName),
        unit: normalizedProduct.unit,
        standardizedUnit: standardizedUnit
      }
    });
    
    productGroups.set(groupKey, { product, prices: [] });
  }
  
  // Add price to product
  await prisma.price.create({
    data: {
      amount: normalizedProduct.price,
      unit: standardizedUnit,
      unitPrice: calculateUnitPrice(price, quantity, unit),
      productId: product.id,
      supplierId: supplier.id,
      uploadId: upload.id,
      validFrom: new Date(),
      validTo: null // Current price
    }
  });
}
```

## 📊 Processing Metrics & Monitoring

### Token Usage Tracking
```typescript
// Track AI service costs
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  totalCost: number;
}

// Monitor per upload
const metrics = {
  totalTokensUsed: 0,
  totalCostUsd: 0,
  processingTimeMs: 0,
  extractionMethod: 'gemini-vision',
  standardizationMethod: 'o3-mini'
};
```

### Success Metrics
```typescript
interface ProcessingResult {
  success: boolean;
  totalRowsDetected: number;    // Raw data found
  totalRowsProcessed: number;   // Successfully processed
  productsCreated: number;      // Unique products added
  completenessRatio: number;    // Processed/Detected ratio
  processingTimeMs: number;
  tokensUsed: number;
  costUsd: number;
  status: 'completed' | 'completed_with_errors' | 'failed';
}
```

## 🔧 Configuration & Environment

### Required Environment Variables
```env
# AI Services
GEMINI_API_KEY=your-google-gemini-key
OPENAI_API_KEY=your-openai-key

# Processing Controls
AI_STANDARDIZATION_ENABLED=true
LLM_MODEL=o3-mini
MAX_FILE_SIZE_MB=50
PROCESSING_TIMEOUT_MS=300000

# Database
DATABASE_URL=postgresql://...
```

### File Size Limits
- **Excel**: 50MB max (handled efficiently with streaming)
- **PDF**: 20MB max (memory limitations during image conversion)
- **Images**: 10MB max (vision API limits)
- **CSV**: 25MB max (memory parsing limits)

## 🚨 Error Handling & Recovery

### Extraction Failures
```typescript
// Multi-level fallback strategy
try {
  result = await primaryExtractor.process(file);
  if (result.confidence < 0.7) {
    result = await fallbackExtractor.process(file);
  }
} catch (error) {
  // Mark upload as failed, preserve error details
  await this.updateUploadStatus(uploadId, 'failed', {
    errorMessage: error.message,
    extractionMethod: 'failed'
  });
}
```

### Standardization Failures
```typescript
// Fallback to basic text cleaning if AI fails
const standardizedName = aiResult || this.simpleStandardizeProductName(rawName);
```

### Database Failures
```typescript
// Transaction rollback on any database error
await prisma.$transaction(async (tx) => {
  // All database operations
  // Auto-rollback on any failure
});
```

## 📈 Performance Optimizations

### Batch Processing
- **AI Calls**: Process 50 products per API call
- **Database**: Batch inserts for prices and products
- **Memory**: Stream large files instead of loading entirely

### Caching
- **Product Matching**: Cache standardized names for duplicates
- **Supplier Lookup**: Cache supplier IDs during processing
- **Unit Conversion**: Cache conversion ratios

### Async Processing
```typescript
// Background processing with queue
const jobQueue = new JobQueue();
await jobQueue.add('processUpload', { uploadId }, {
  attempts: 3,
  backoff: 'exponential',
  delay: 5000
});
```

## 🧪 Testing & Quality Assurance

### Test File Coverage
- **Excel**: Complex multi-sheet supplier price lists
- **PDF**: Scanned invoices and digital catalogs  
- **Images**: Phone photos of handwritten lists
- **CSV**: Various delimiter and encoding formats

### Validation Rules
```typescript
interface ProductValidation {
  nameRequired: boolean;      // Product name mandatory
  priceRange: [min, max];     // Realistic price bounds
  unitWhitelist: string[];    // Accepted units only
  duplicateHandling: 'merge' | 'skip' | 'error';
}
```

### Quality Metrics
- **Extraction Accuracy**: >95% for structured files
- **Standardization Quality**: >90% correct Indonesian→English
- **Processing Speed**: <30 seconds for 500 products
- **Cost Efficiency**: <$0.01 per 100 products

## 🔄 Recent Improvements (July 2025)

### Fixed Issues
1. **AI Standardization Limit**: Now processes ALL products, not just first 20
2. **Indonesian Translation**: o3-mini properly translates "apel fuji" → "Apple Fuji"  
3. **Batch Processing**: Handles large uploads efficiently
4. **Error Recovery**: Better fallback mechanisms

### Enhanced Features
1. **Improved Prompts**: More context-aware standardization
2. **Better Extraction**: Enhanced Gemini vision processing
3. **Performance**: Optimized batch sizes and memory usage
4. **Monitoring**: Comprehensive token usage tracking

## 📋 Future Roadmap

### Planned Improvements
1. **Real-time Processing**: WebSocket progress updates
2. **Advanced OCR**: Custom models for handwritten text
3. **Smart Categorization**: AI-powered product categorization
4. **Duplicate Detection**: Advanced fuzzy matching
5. **Multi-language**: Support for more Indonesian dialects

### Technical Enhancements
1. **Streaming**: Process files as they upload
2. **Caching**: Redis for frequently accessed data
3. **Scalability**: Horizontal scaling for high volume
4. **Analytics**: Detailed processing insights

---

**Document Version**: 1.0  
**Last Updated**: July 7, 2025  
**Status**: Production Ready ✅  
**Next Review**: July 14, 2025