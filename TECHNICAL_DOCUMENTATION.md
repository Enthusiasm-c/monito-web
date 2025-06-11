# Monito-Web Technical Documentation

## Overview

Monito-Web is a comprehensive supplier price comparison platform that extracts product data from various file formats (PDF, Excel, CSV) and provides intelligent price comparison capabilities. The system uses advanced extraction techniques with multiple fallback mechanisms to ensure high data quality and completeness.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Monito-Web Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 15 + TypeScript + Turbopack)               │
│  ├── File Upload Interface                                      │
│  ├── Price Comparison Dashboard                                 │
│  ├── Supplier Management                                        │
│  └── Token Cost Monitoring                                      │
├─────────────────────────────────────────────────────────────────┤
│  Backend Services (Node.js + TypeScript)                       │
│  ├── Enhanced File Processor                                   │
│  ├── PDF Extractor (Python Integration)                        │
│  ├── Excel/CSV Extractor                                       │
│  ├── AI Validation & Standardization                           │
│  └── Token Cost Monitor                                         │
├─────────────────────────────────────────────────────────────────┤
│  Database Layer (PostgreSQL + Prisma ORM)                      │
│  ├── Suppliers                                                  │
│  ├── Products                                                   │
│  ├── Prices (with versioning)                                  │
│  └── Uploads (with processing metrics)                          │
├─────────────────────────────────────────────────────────────────┤
│  External Services                                              │
│  ├── OpenAI API (GPT-o3, GPT-o3-mini)                         │
│  ├── Vercel Blob Storage                                        │
│  └── Neon Database (PostgreSQL)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Core Processing Pipeline

### 1. File Upload & Validation

**Location**: `/app/api/upload-smart/route.ts`

```typescript
// File validation and storage
const validationResult = await validateFile(file);
const blobUrl = await uploadToVercelBlob(file);
const uploadRecord = await createUploadRecord(blobUrl, metadata);
```

**Process Flow**:
1. File type validation (PDF, Excel, CSV)
2. File size check (max 10MB by default)
3. Upload to Vercel Blob Storage
4. Create database record with `processing` status
5. Trigger background processing

### 2. Enhanced File Processing

**Location**: `/app/services/enhancedFileProcessor.ts`

The main orchestrator that coordinates all extraction and processing activities.

#### Key Features:
- **Automatic file type detection**
- **Multiple extraction method coordination**
- **AI standardization with cost controls**
- **Comprehensive error handling**
- **Processing metrics collection**

```typescript
async processFile(uploadId: string): Promise<ProcessingResult> {
  // 1. Validate and prepare
  const upload = await prisma.upload.findUnique({ where: { id: uploadId }});
  
  // 2. Route to appropriate extractor
  if (upload.mimeType?.includes('pdf')) {
    extractedData = await enhancedPdfExtractor.extractFromPdf(url, name);
  } else {
    extractedData = await enhancedExcelExtractor.extractFromFile(url, name);
  }
  
  // 3. Process and store products
  const productsCreated = await this.storeExtractedProducts(
    extractedData.products, supplierId, uploadId, metrics
  );
  
  // 4. Update status and metrics
  await this.updateUploadStatus(uploadId, status, finalMetrics);
}
```

## PDF Extraction System

### Architecture

**Primary Extractor**: `/app/services/enhancedPdfExtractor.ts`  
**Python Processor**: `/scripts/enhanced_pdf_processor.py`

### Multi-Method Extraction Strategy

The PDF extraction system employs a sophisticated cascade of extraction methods:

```python
# Method Priority Order
1. Camelot Lattice (for structured tables with borders)
2. Camelot Stream (for tables without clear borders) 
3. PDFPlumber (for complex layouts and mixed content)
4. AI Vision Fallback (when traditional methods fail)
```

### Detailed Extraction Process

#### 1. Camelot Lattice Extraction
- **Use Case**: PDFs with clear table borders and grid structures
- **Strengths**: High precision for well-formatted tables
- **Limitations**: Fails on borderless tables

#### 2. Camelot Stream Extraction  
- **Use Case**: Tables without visible borders
- **Strengths**: Better for catalog-style layouts
- **Limitations**: May struggle with complex multi-column layouts

#### 3. PDFPlumber Extraction
- **Use Case**: Complex layouts, mixed content, multi-page catalogs
- **Strengths**: Most flexible, handles varied layouts
- **Process**: Page-by-page analysis with table detection

#### 4. AI Vision Fallback
- **Trigger Conditions**:
  - No products found by traditional methods
  - Completeness ratio < 85%
  - Product count < minimum threshold (50 by default)
- **Process**: PDF → Images → GPT-o3 Vision analysis
- **Cost Control**: Limited to 8 pages maximum

### Column Detection Algorithm

**Location**: `/scripts/enhanced_pdf_processor.py:find_name_column()` and `find_price_column()`

```python
def find_name_column(self, df: pd.DataFrame) -> int:
    """Intelligent product name column detection"""
    scores = []
    for i, col in enumerate(df.columns):
        score = 0
        valid_names = 0
        
        for val in df[col].dropna():
            # Score based on multiple criteria
            if self.is_valid_product_name(str(val)):
                score += 3  # Valid product name
                valid_names += 1
            elif str(val).isdigit():
                score -= 2  # Penalize pure numbers
            elif len(str(val)) < 3:
                score -= 1  # Penalize very short strings
                
        # Bonus for high percentage of valid names
        if len(df) > 0:
            valid_ratio = valid_names / len(df)
            score += valid_ratio * 10
            
        scores.append(score)
    
    return scores.index(max(scores)) if scores else 0
```

### Smart Fallback Logic

**Location**: `/app/services/enhancedPdfExtractor.ts:shouldUseAiFallback()`

```typescript
private shouldUseAiFallback(
  productCount: number,
  completenessRatio: number,
  totalRows: number,
  aiVisionEnabled: boolean
): { needed: boolean; reason: string; shouldReplace: boolean } {
  
  if (!this.config.llmFallbackEnabled || !aiVisionEnabled) {
    return { needed: false, reason: 'AI fallback disabled', shouldReplace: false };
  }
  
  // Case 1: No products found at all
  if (productCount === 0) {
    return {
      needed: true,
      reason: 'no products found',
      shouldReplace: false
    };
  }
  
  // Case 2: Very few products (likely extraction failed)
  if (productCount < this.config.minProductsForSuccess) {
    return {
      needed: true,
      reason: `too few products (${productCount} < ${this.config.minProductsForSuccess})`,
      shouldReplace: true
    };
  }
  
  // Case 3: Low completeness ratio
  if (completenessRatio < this.config.completenessThreshold) {
    return {
      needed: true,
      reason: `low completeness (${(completenessRatio * 100).toFixed(1)}% < ${(this.config.completenessThreshold * 100)}%)`,
      shouldReplace: true
    };
  }
  
  // Case 4: Already have many products - don't risk breaking with AI
  if (productCount >= this.config.maxProductsForFallback) {
    return {
      needed: false,
      reason: `sufficient products found (${productCount} >= ${this.config.maxProductsForFallback})`,
      shouldReplace: false
    };
  }
  
  return { needed: false, reason: 'criteria not met', shouldReplace: false };
}
```

## Excel/CSV Extraction System

**Location**: `/app/services/enhancedExcelExtractor.ts`

### Features:
- **Multi-sheet support** with automatic sheet detection
- **Intelligent header detection** across multiple rows
- **Data type inference** and validation
- **Flexible column mapping** with fuzzy matching

### Processing Flow:
```typescript
1. File Download & Parsing
   ├── Excel: xlsx library
   └── CSV: csv-parse library

2. Sheet Analysis (Excel only)
   ├── Detect sheets with tabular data
   ├── Skip empty or metadata sheets
   └── Process each valid sheet

3. Header Detection
   ├── Scan first 10 rows for headers
   ├── Look for product/price indicators
   └── Map columns to data types

4. Data Extraction
   ├── Extract rows with valid data
   ├── Apply data normalization
   └── Validate product completeness
```

## AI Systems Integration

### 1. AI Vision Fallback

**Model**: GPT-o3  
**Purpose**: Extract product data from complex PDF layouts  
**Input**: PDF pages converted to images (JPEG, optimized)  
**Output**: Structured JSON with products and prices

```python
# Image optimization for AI processing
def optimize_image_for_ai(self, image_path: str) -> str:
    with Image.open(image_path) as img:
        # Resize if too large (max 2048px)
        if max(img.size) > 2048:
            img.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Optimize JPEG quality
        img.save(optimized_path, 'JPEG', quality=85, optimize=True)
```

### 2. AI Product Validation

**Model**: GPT-o3-mini (cost-effective)  
**Purpose**: Validate and clean extracted product data  
**Batch Size**: Up to 200 products per API call

```typescript
// Validation rules implemented
1. Reject invalid names (pure numbers, units only, empty strings)
2. Clean product names (remove row numbers, fix typos)
3. Validate prices (must be positive, reasonable ranges)
4. Standardize units (kg, g, l, pcs, etc.)
5. Improve categories (dairy, meat, seafood, etc.)
```

### 3. AI Product Standardization

**Model**: GPT-o3  
**Purpose**: Standardize product names for better matching  
**Batch Size**: Limited to 20 products (cost control)  
**Fallback**: Simple text normalization for remaining products

## Configuration System

**Location**: `.env` file

### Core Settings:
```env
# Processing Controls
LLM_FALLBACK_ENABLED=false              # Enable/disable AI fallback
AI_VISION_ENABLED=false                 # Enable/disable AI vision
AI_STANDARDIZATION_ENABLED=false        # Enable/disable AI standardization
AI_VALIDATION_ENABLED=false             # Enable/disable AI validation

# Quality Thresholds
COMPLETENESS_THRESHOLD_PDF=0.85         # Minimum completeness for PDF
MIN_PRODUCTS_FOR_SUCCESS=50             # Minimum products to avoid fallback
MAX_PRODUCTS_FOR_FALLBACK=150           # Maximum products to trigger fallback

# Cost Controls
MAX_AI_STANDARDIZATION_PRODUCTS=100     # Max products for AI standardization
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=200 # Skip AI if more than this
AI_VALIDATION_BATCH_SIZE=200            # Batch size for validation
AI_VISION_MAX_PAGES=8                   # Max pages for AI vision

# File Limits
MAX_FILE_SIZE_MB=10                     # Maximum file size
```

## Metrics and Monitoring

### 1. Processing Metrics

**Tracked Metrics**:
- **Completeness Ratio**: `processed_rows / detected_rows`
- **Product Count**: Number of valid products extracted
- **Processing Time**: Total time in milliseconds
- **Token Usage**: OpenAI API tokens consumed
- **Cost**: USD cost of AI processing

### 2. Token Cost Monitoring

**Location**: `/app/services/tokenCostMonitor.ts`

```typescript
// Real-time cost tracking
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  totalCost: number;
  timestamp: Date;
}

// Model pricing (as of 2024)
const MODEL_COSTS = {
  'gpt-o3': {
    input: 0.005,   // $0.005 per 1K tokens
    output: 0.015   // $0.015 per 1K tokens
  },
  'gpt-o3-mini': {
    input: 0.00015, // $0.00015 per 1K tokens  
    output: 0.0006  // $0.0006 per 1K tokens
  }
};
```

### 3. Processing Logs

**Location**: `/logs/processing.log`

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uploadId": "cmbq2lcie0002ouzh0ijbxpw3",
  "fileName": "PRICE QUOTATATION FOR EGGSTRA CAFE.pdf",
  "fileType": "application/pdf",
  "completenessRatio": 0.512,
  "totalRows": 346,
  "processedRows": 177,
  "productsCreated": 177,
  "processingTimeMs": 7345,
  "tokensUsed": 0,
  "costUsd": 0.0000,
  "status": "completed",
  "errors": []
}
```

## Database Schema

### Core Tables

#### 1. Suppliers
```sql
Table: suppliers
- id: String (Primary Key)
- name: String (Unique)
- email: String?
- phone: String?  
- address: String?
- createdAt: DateTime
- updatedAt: DateTime
```

#### 2. Products
```sql
Table: products  
- id: String (Primary Key)
- rawName: String           # Original extracted name
- name: String             # Cleaned name
- standardizedName: String # AI-standardized name
- category: String?
- unit: String
- standardizedUnit: String
- description: String?
- createdAt: DateTime
- updatedAt: DateTime
```

#### 3. Prices (Versioned)
```sql
Table: prices
- id: String (Primary Key)
- amount: Float
- unit: String
- productId: String (Foreign Key)
- supplierId: String (Foreign Key)  
- uploadId: String (Foreign Key)
- validFrom: DateTime      # Price validity start
- validTo: DateTime?       # Price validity end (null = current)
- createdAt: DateTime
```

#### 4. Uploads (Processing Tracking)
```sql
Table: uploads
- id: String (Primary Key)
- originalName: String
- fileName: String
- mimeType: String
- fileSize: Int?
- url: String
- supplierId: String (Foreign Key)
- status: String           # processing, completed, failed, too_large
- totalRowsDetected: Int?
- totalRowsProcessed: Int?
- completenessRatio: Float?
- processingTimeMs: Int?
- tokensUsed: Int?
- processingCostUsd: Float?
- errorMessage: String?
- extractedData: Json?     # Raw extraction results
- createdAt: DateTime
- updatedAt: DateTime
```

## Error Handling & Recovery

### 1. Processing Failures

**Failure Types**:
- **Python Process Errors**: Script crashes, dependency issues
- **AI API Failures**: Rate limits, timeouts, invalid responses
- **Database Errors**: Connection issues, constraint violations
- **File Access Errors**: Download failures, corrupted files

**Recovery Mechanisms**:
```typescript
// Graceful degradation
if (pythonProcessFailed) {
  // Fall back to basic text extraction
  return await fallbackTextExtraction(fileUrl);
}

if (aiApiFailed) {
  // Use simple rule-based processing
  return await ruleBasedProcessing(rawData);
}

// Always update status to prevent stuck uploads
await prisma.upload.update({
  where: { id: uploadId },
  data: { 
    status: 'failed',
    errorMessage: error.message,
    updatedAt: new Date()
  }
});
```

### 2. Data Validation

**Multi-Level Validation**:
1. **File Level**: Size, type, accessibility
2. **Extraction Level**: Row count, column detection
3. **Product Level**: Name validity, price reasonableness
4. **Database Level**: Constraint validation, duplicate prevention

## Performance Optimizations

### 1. Processing Optimizations

- **Parallel Processing**: Multiple extraction methods run concurrently where possible
- **Batch Operations**: Database operations batched for efficiency
- **Memory Management**: Large files processed in chunks
- **Caching**: Extraction results cached during processing

### 2. Cost Optimizations

- **Smart AI Usage**: AI only triggered when necessary
- **Batch Processing**: Multiple products processed in single API calls
- **Model Selection**: GPT-o3-mini for validation, GPT-o3 for complex tasks
- **Image Optimization**: PDF images optimized before AI processing

### 3. Database Optimizations

- **Connection Pooling**: Prisma connection pooling enabled
- **Selective Queries**: Only necessary fields retrieved
- **Batch Inserts**: Products inserted in batches
- **Price Versioning**: Old prices deactivated, not deleted

## API Endpoints

### Core Endpoints

#### 1. File Upload
```
POST /api/upload-smart
Content-Type: multipart/form-data

Body: 
- file: File (PDF/Excel/CSV)
- supplierId: String

Response:
{
  "success": true,
  "uploadId": "cmbq2lcie0002ouzh0ijbxpw3",
  "message": "File uploaded and processing started"
}
```

#### 2. Upload Status
```
GET /api/uploads/status?limit=5

Response:
{
  "uploads": [
    {
      "id": "cmbq2lcie0002ouzh0ijbxpw3",
      "originalName": "PRICE QUOTATATION FOR EGGSTRA CAFE.pdf",
      "status": "completed",
      "completenessRatio": 0.512,
      "productsCreated": 177,
      "processingTimeMs": 7345,
      "costUsd": 0.0000,
      "supplier": { "name": "CHEESE" }
    }
  ]
}
```

#### 3. Token Usage
```
GET /api/token-usage

Response:
{
  "totalTokensUsed": 150000,
  "totalCostUsd": 2.45,
  "last24Hours": {
    "tokens": 5000,
    "cost": 0.08
  }
}
```

#### 4. Products Search
```
GET /api/products?search=milk&category=dairy&page=1&limit=50

Response:
{
  "products": [...],
  "pagination": {
    "page": 1,
    "totalPages": 5,
    "totalProducts": 250
  }
}
```

## Development Workflow

### 1. Local Development Setup

```bash
# Clone repository
git clone <repository-url>
cd monito-web

# Install dependencies
npm install
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Configure database and API keys

# Run database migrations
npx prisma migrate dev
npx prisma generate

# Start development server
npm run dev
```

### 2. Testing Extraction

```bash
# Test PDF extraction directly
python scripts/enhanced_pdf_processor.py <pdf-url> <output-file>

# Test AI validation
python scripts/ai_product_validator.py <products-json> <api-key> <supplier-name>

# Test complete pipeline
# Upload file through web interface and monitor logs
```

### 3. Debugging

```bash
# Enable detailed logging
export DEBUG=true

# Monitor processing logs
tail -f logs/processing.log

# Check database state
npx prisma studio
```

## Deployment Considerations

### 1. Environment Variables

**Required**:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API access
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage access

**Optional**:
- All processing configuration variables
- Cost control and threshold variables

### 2. Dependencies

**Node.js Dependencies**:
- Next.js 15+ (with Turbopack)
- Prisma ORM
- OpenAI SDK
- Various file processing libraries

**Python Dependencies**:
- camelot-py[cv] (table extraction)
- pdfplumber (PDF processing)
- pandas (data manipulation)
- Pillow (image processing)
- requests (HTTP client)

### 3. System Requirements

- **Node.js**: 18+ required
- **Python**: 3.9+ required
- **Memory**: Minimum 2GB for file processing
- **Storage**: Adequate space for temporary files
- **Network**: Stable internet for AI API calls

## Troubleshooting Guide

### Common Issues

#### 1. Python Process Failures
```
Error: Python process exited with code 1
Solution: Check Python dependencies, ensure camelot-py is properly installed
```

#### 2. AI API Failures
```
Error: OpenAI API rate limit exceeded
Solution: Implement retry logic, reduce batch sizes, use exponential backoff
```

#### 3. Database Connection Issues
```
Error: Can't reach database server
Solution: Check DATABASE_URL, verify network connectivity, check connection pool
```

#### 4. File Processing Stuck
```
Issue: Upload status remains "processing"
Solution: Check Python process logs, restart processing, clean up stuck records
```

### Monitoring Commands

```bash
# Check upload status
npx prisma studio

# Monitor processing logs
tail -f logs/processing.log

# Check Python process
ps aux | grep python

# Monitor system resources
top -p $(pgrep -f "node\|python")
```

## Security Considerations

### 1. API Key Protection

- API keys stored in environment variables only
- No API keys logged to console or files
- Separate keys for different environments

### 2. File Upload Security

- File type validation
- File size limits
- Virus scanning (recommended for production)
- Temporary file cleanup

### 3. Database Security

- Connection string encryption
- Prepared statements (Prisma ORM)
- Input validation and sanitization
- Regular backup procedures

## Future Enhancements

### Planned Features

1. **Advanced AI Features**
   - Multi-language support
   - Custom extraction rules
   - Learning from user corrections

2. **Performance Improvements**
   - Async processing queue
   - Distributed processing
   - Advanced caching strategies

3. **Business Features**
   - Price alerts and notifications
   - Supplier performance analytics
   - Custom reporting dashboards

4. **Integration Features**
   - REST API for external systems
   - Webhook notifications
   - Export capabilities

---

*This documentation is maintained and updated with each system enhancement. Last updated: January 2025*