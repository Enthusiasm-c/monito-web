# AI Vision Processing System - Complete Guide

## Overview

The Monito Web application now uses an advanced AI Vision processing system that leverages OpenAI's GPT-4o Vision API to extract product data from uploaded files. This system prioritizes AI-based extraction over traditional parsing methods for optimal accuracy and reliability.

## System Architecture

### Processing Pipeline

```
Upload File → File Type Detection → AI Vision Processing → Data Validation → Database Storage
     ↓              ↓                      ↓                    ↓               ↓
   [PDF/Excel/    [Auto-detect         [Screenshot +        [Quality        [Products +
    Image]         format]              AI Analysis]         Control]        Suppliers]
```

## File Processing Methods

### 1. PDF Files (Primary Method: AI Vision)

**Flow**: PDF → Screenshots → OpenAI GPT-4o Vision API → Structured Data

- **Step 1**: PDF pages converted to high-quality images using PyMuPDF
- **Step 2**: Images sent to OpenAI GPT-4o Vision API in parallel batches
- **Step 3**: AI extracts product names, prices, units, and supplier information
- **Step 4**: Data validated and normalized before database insertion

**Configuration**:
```env
AI_VISION_ENABLED=true
PRIORITIZE_AI_VISION=true
USE_ASYNC_AI_EXTRACTION=true
AI_VISION_MAX_PAGES=8
```

**Performance**: 
- Processes multiple pages concurrently (2.7x faster than sequential)
- Typical cost: $0.02-0.05 per PDF
- Success rate: >95% for structured price lists

### 2. Excel Files

**Flow**: Excel → Direct Reading → Data Extraction → Validation

- Supports .xlsx, .xls, .csv formats
- Multiple sheet processing
- Header detection and column mapping
- Price formatting and unit standardization

### 3. Image Files

**Flow**: Image → AI Vision API → Product Extraction

- Supports JPG, PNG, WebP formats
- Direct AI Vision processing
- Handles handwritten and printed text
- Menu and price list recognition

## Environment Configuration

### Required Environment Variables

```env
# Core Configuration
DATABASE_URL='postgresql://...'
NEXTAUTH_SECRET='...'
NEXTAUTH_URL='http://209.38.85.196:3000'

# AI APIs
OPENAI_API_KEY='sk-proj-...'
GOOGLE_API_KEY='AIzaSy...'

# AI Vision Settings
AI_VISION_ENABLED=true
PRIORITIZE_AI_VISION=true
USE_ASYNC_AI_EXTRACTION=true
AI_VISION_MAX_PAGES=8

# Processing Configuration
LLM_FALLBACK_ENABLED=true
COMPLETENESS_THRESHOLD_PDF=0.85
MIN_PRODUCTS_FOR_SUCCESS=50
MAX_PRODUCTS_FOR_FALLBACK=150
MAX_FILE_SIZE_MB=10

# Approval Workflow
AUTO_APPROVAL_ENABLED=true
MAX_AI_STANDARDIZATION_PRODUCTS=100
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=200

# Model Configuration
LLM_MODEL=gpt-4o
AI_VALIDATION_MODEL=gpt-4o-mini
AI_STANDARDIZATION_ENABLED=true
```

### Python Dependencies

```bash
pip3 install --break-system-packages PyMuPDF Pillow aiohttp
```

## Core Components

### 1. EnhancedFileProcessor (`app/services/enhancedFileProcessor.ts`)

Main orchestrator that:
- Routes files to appropriate processors
- Manages processing workflows
- Handles error recovery
- Tracks processing metrics

### 2. EnhancedPdfExtractor (`app/services/enhancedPdfExtractor.ts`)

PDF-specific processor that:
- Prioritizes AI Vision when enabled
- Falls back to Python parsing if needed
- Manages parallel page processing
- Optimizes token usage

### 3. AsyncFileProcessor (`app/services/background/AsyncFileProcessor.ts`)

Background job processor that:
- Wraps EnhancedFileProcessor for async operations
- Handles job queue management
- Provides error recovery
- Logs processing results

### 4. AI Vision Scripts

#### `scripts/async_pdf_image_extractor.py`

Advanced Python script that:
- Converts PDF pages to optimized images
- Manages OpenAI API rate limits
- Processes pages in parallel batches
- Handles error recovery and retries

**Key Features**:
- Rate limiting (500 requests/minute)
- Concurrent processing (10 simultaneous requests)
- Smart image optimization
- Comprehensive error handling

## Admin Interface

### Upload Management (`/admin/uploads`)

**Features**:
- Real-time processing status
- Preview functionality with two-panel view:
  - Left panel: Original file viewer
  - Right panel: Extracted data with quality indicators
- Approve/Reject workflow
- Processing statistics and metrics

**Actions Available**:
- **Preview**: View original file alongside extracted data
- **Approve**: Accept extraction and create products
- **Reject**: Decline upload with confirmation
- **Reprocess**: Retry failed uploads

### File Viewer Component (`app/admin/components/FileViewer.tsx`)

Supports multiple file types:
- **PDF**: Embedded iframe viewer
- **Excel**: Download option with opening instructions
- **Images**: Direct image display
- **CSV/Text**: Embedded text viewer

### Data Comparison Component (`app/admin/components/DataComparison.tsx`)

**Features**:
- Inline editing capabilities
- Data quality validation with visual indicators
- Indonesian currency formatting (IDR)
- Row-level status indicators:
  - 🔴 Critical errors (short names, invalid prices)
  - 🟡 Warnings (suspicious data patterns)
  - 🟢 Valid data

**Quality Checks**:
- Product name length validation
- Price range validation
- Unit measurement verification
- Format consistency checks

## API Endpoints

### Upload Processing APIs

```typescript
// Submit new upload
POST /api/async-upload
// Body: { supplierId, file }

// Get upload status
GET /api/admin/uploads/status/{uploadId}

// List pending uploads
GET /api/admin/uploads/pending?page=1&limit=10

// Approve upload
POST /api/admin/uploads/approve
// Body: { uploadId, approvedBy, reviewNotes }

// Reject upload
POST /api/admin/uploads/reject
// Body: { uploadId, rejectedBy, rejectionReason }

// Reprocess stuck upload
POST /api/admin/uploads/reprocess
// Body: { uploadId }
```

### Admin Management APIs

```typescript
// Products management
GET /api/admin/products
POST /api/admin/products
PUT /api/admin/products/{id}
DELETE /api/admin/products/{id}

// Suppliers management
GET /api/admin/suppliers
POST /api/admin/suppliers
PUT /api/admin/suppliers/{id}
DELETE /api/admin/suppliers/{id}

// Price history
GET /api/admin/price-history
GET /api/admin/suppliers/{id}/price-changes
```

## Database Schema

### Core Models

```prisma
model Upload {
  id                    String   @id @default(cuid())
  originalName          String
  fileName              String
  fileSize              Int
  mimeType              String
  status                String   // 'pending', 'processing', 'completed', 'failed'
  approvalStatus        String   // 'pending_review', 'approved', 'rejected'
  progressPercentage    Int      @default(0)
  currentStage          String?  // 'waiting', 'extraction', 'validation'
  errorMessage          String?
  completenessRatio     Float?
  processingCostUsd     Float?
  totalRowsDetected     Int?
  totalRowsProcessed    Int?
  estimatedProductsCount Int?
  extractedProducts     Json?
  supplierId            String
  supplier              Supplier @relation(fields: [supplierId], references: [id])
  createdAt             DateTime @default(now())
  startedAt             DateTime?
  completedAt           DateTime?
}

model Product {
  id               String   @id @default(cuid())
  name             String
  standardizedName String?
  price            Float
  unit             String
  standardizedUnit String?
  category         String?
  supplierId       String
  supplier         Supplier @relation(fields: [supplierId], references: [id])
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model Supplier {
  id       String    @id @default(cuid())
  name     String    @unique
  email    String?
  phone    String?
  address  String?
  products Product[]
  uploads  Upload[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Monitoring and Troubleshooting

### Processing Logs

Monitor processing through:
- PM2 logs: `pm2 logs monito-web`
- Database upload status
- Admin interface progress indicators

### Common Issues and Solutions

#### 1. Uploads Stuck in Processing

**Symptoms**: Upload shows 30% progress for extended periods

**Solution**: Use reprocess endpoint
```bash
curl -X POST http://209.38.85.196:3000/api/admin/uploads/reprocess \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "upload_id_here"}'
```

#### 2. AI Vision Not Triggered

**Check Configuration**:
```bash
# Verify environment variables
echo $AI_VISION_ENABLED
echo $PRIORITIZE_AI_VISION
echo $OPENAI_API_KEY
```

#### 3. Python Dependencies Missing

**Install Required Packages**:
```bash
pip3 install --break-system-packages PyMuPDF Pillow aiohttp
```

### Performance Metrics

**Typical Processing Times**:
- PDF (AI Vision): 15-30 seconds
- Excel files: 5-15 seconds  
- Images: 10-20 seconds

**Token Usage**:
- PDF processing: 2,000-5,000 tokens
- Image processing: 1,000-2,000 tokens
- Cost per upload: $0.02-0.10

## Testing and Validation

### Playwright Test Suites

```typescript
// Test upload functionality
npm run test:uploads

// Test preview functionality  
npm run test:uploads-preview

// Test production deployment
npm run test:production
```

### Manual Testing Workflow

1. **Upload Test Files**:
   - PDF price lists
   - Excel spreadsheets
   - Menu images

2. **Monitor Processing**:
   - Check upload status API
   - Verify progress updates
   - Review extracted data

3. **Validate Results**:
   - Compare extracted vs. original data
   - Check data quality indicators
   - Test approve/reject workflow

## Deployment

### Production Deployment Steps

1. **Update Code**:
```bash
rsync -avz --delete --exclude='.git' --exclude='node_modules' \
  ./ root@209.38.85.196:/opt/monito-web/
```

2. **Install Dependencies**:
```bash
ssh root@209.38.85.196 "cd /opt/monito-web && npm install"
```

3. **Update Environment**:
```bash
scp .env root@209.38.85.196:/opt/monito-web/
```

4. **Restart Application**:
```bash
ssh root@209.38.85.196 "pm2 restart monito-web"
```

### Health Checks

After deployment, verify:
- Application status: `pm2 list`
- API endpoints: `curl http://209.38.85.196:3000/api/stats`
- Database connectivity: Check admin interface
- Upload processing: Test with sample file

## Security Considerations

### API Key Management

- Store API keys in environment variables only
- Rotate keys regularly
- Monitor usage and costs
- Use least-privilege access

### File Upload Security

- File size limits enforced (10MB default)
- MIME type validation
- Virus scanning (recommended)
- Secure file storage with expiration

### Authentication

- NextAuth.js for admin authentication
- Session-based security
- CSRF protection enabled
- Secure cookie settings

## Future Enhancements

### Planned Features

1. **Enhanced AI Models**:
   - GPT-4o-mini for cost optimization
   - Gemini integration for comparison
   - Custom fine-tuned models

2. **Advanced Processing**:
   - Batch upload support
   - Real-time processing updates
   - Advanced OCR for poor quality images

3. **Analytics and Reporting**:
   - Processing cost tracking
   - Accuracy metrics dashboard
   - Performance optimization insights

4. **Integration Capabilities**:
   - Webhook notifications
   - Third-party system integration
   - API rate limiting and quotas

## Support and Maintenance

### Regular Maintenance Tasks

- Monitor processing costs and token usage
- Review and clean up stuck uploads
- Update AI model configurations
- Backup database regularly
- Update dependencies and security patches

### Contact Information

For technical support or questions about the AI Vision processing system, refer to the development team or check the GitHub repository for updates and issue tracking.