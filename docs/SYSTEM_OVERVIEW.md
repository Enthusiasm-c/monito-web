# Monito Web - System Overview and Architecture

## 🎯 Executive Summary

Monito Web is an advanced AI-powered price monitoring and product management system designed to automate the extraction and management of product data from supplier price lists. The system leverages cutting-edge AI technology, specifically OpenAI's GPT-4o Vision API, to process various file formats and provide intelligent data extraction with high accuracy.

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│                      Next.js Frontend                          │
│  • React Components  • Admin Interface  • Upload UI            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                    Application Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                    API Routes (Next.js)                        │
│  • Upload APIs     • Admin APIs      • Processing APIs         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                   Business Logic Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                   Processing Services                          │
│  • EnhancedFileProcessor  • AI Vision  • Data Validation       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                    External Services                           │
├─────────────────────────────────────────────────────────────────┤
│  • OpenAI API    • Python Scripts   • File Storage             │
│  • AI Vision     • PDF Processing   • Image Conversion         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                     Data Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│              PostgreSQL Database (Neon)                        │
│  • Products     • Suppliers      • Upload Tracking             │
│  • Price History • Quality Metrics • Processing Logs           │
└─────────────────────────────────────────────────────────────────┘
```

### Core Processing Pipeline

```
📄 File Upload
    ↓
🔍 Format Detection
    ↓
📊 AI Processing Flow
    ├── PDF → Screenshots → AI Vision API
    ├── Excel → Direct Parsing → Validation
    └── Images → AI Vision API → Extraction
    ↓
✅ Quality Validation
    ├── Data Completeness Check
    ├── Price Range Validation
    └── Format Consistency
    ↓
📋 Admin Review
    ├── Two-Panel Preview
    ├── Quality Indicators
    └── Approve/Reject Workflow
    ↓
💾 Database Storage
    ├── Product Creation
    ├── Price History Update
    └── Supplier Management
```

## 🎮 How the System Works

### 1. File Upload Process

**User Flow:**
1. Supplier selects their company from dropdown
2. Uploads price list file (PDF, Excel, or image)
3. System automatically detects file type
4. Background processing begins immediately

**Technical Flow:**
```typescript
// Upload API endpoint
POST /api/async-upload
{
  supplierId: "supplier-id",
  file: File
}

// Processing stages
1. File validation (size, type, format)
2. Upload record creation in database
3. Job queue submission for background processing
4. Real-time status updates via API
```

### 2. AI Vision Processing (Primary Method)

**For PDF Files:**
```python
# Python script: async_pdf_image_extractor.py
1. Convert PDF pages to high-quality images
2. Optimize images for AI processing
3. Send batches to OpenAI GPT-4o Vision API
4. Extract structured product data
5. Return JSON with products, prices, units
```

**AI Prompt Strategy:**
```
You are an expert at analyzing price lists and invoices. Extract all products with their prices and units from this image. For each product, provide:
- name: Complete product name
- price: Numeric price value
- unit: Unit of measurement (kg, liter, piece, etc.)

Return as JSON array of products.
```

### 3. Excel Processing

**Direct Data Extraction:**
```typescript
// Enhanced Excel Extractor
1. Read multiple sheets simultaneously
2. Detect headers automatically
3. Map columns to product fields
4. Handle various price formats
5. Standardize units and measurements
```

### 4. Quality Control System

**Automated Validation:**
```typescript
interface QualityCheck {
  nameLength: boolean;      // Name > 3 characters
  priceValid: boolean;      // Price > 0 and < 10M
  unitPresent: boolean;     // Unit field not empty
  formatConsistent: boolean; // Consistent data patterns
}
```

**Visual Indicators:**
- 🔴 **Critical Issues**: Invalid prices, missing data
- 🟡 **Warnings**: Suspicious patterns, formatting issues  
- 🟢 **Valid Data**: Passes all quality checks

### 5. Admin Review Interface

**Two-Panel Preview:**
- **Left Panel**: Original file viewer (PDF iframe, Excel download, image display)
- **Right Panel**: Extracted data with inline editing capabilities

**Actions Available:**
- **Preview**: Detailed view with quality indicators
- **Approve**: Accept data and create products
- **Reject**: Decline with simple confirmation
- **Reprocess**: Retry failed extractions

## 🗃️ Database Schema Deep Dive

### Core Tables

#### Upload Table
```sql
CREATE TABLE Upload (
    id                    TEXT PRIMARY KEY,
    originalName          TEXT NOT NULL,
    fileName              TEXT NOT NULL,
    fileSize              INTEGER NOT NULL,
    mimeType              TEXT NOT NULL,
    status                TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    approvalStatus        TEXT NOT NULL, -- 'pending_review', 'approved', 'rejected'
    progressPercentage    INTEGER DEFAULT 0,
    currentStage          TEXT,          -- 'waiting', 'extraction', 'validation'
    errorMessage          TEXT,
    completenessRatio     REAL,
    processingCostUsd     REAL,
    totalRowsDetected     INTEGER,
    totalRowsProcessed    INTEGER,
    estimatedProductsCount INTEGER,
    extractedProducts     JSON,          -- Raw AI extraction results
    supplierId            TEXT NOT NULL,
    createdAt             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    startedAt             TIMESTAMP,
    completedAt           TIMESTAMP
);
```

#### Product Table
```sql
CREATE TABLE Product (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    standardizedName  TEXT,           -- AI-standardized name
    price             REAL NOT NULL,
    unit              TEXT NOT NULL,
    standardizedUnit  TEXT,           -- Normalized unit (kg, liter, etc.)
    category          TEXT,
    supplierId        TEXT NOT NULL,
    uploadId          TEXT,           -- Source upload tracking
    createdAt         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Supplier Table
```sql
CREATE TABLE Supplier (
    id        TEXT PRIMARY KEY,
    name      TEXT UNIQUE NOT NULL,
    email     TEXT,
    phone     TEXT,
    address   TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Relationships

```
Supplier (1) ──── (N) Upload
    │
    └─── (N) Product
              │
              └─── (N) PriceHistory
```

## ⚙️ Configuration Management

### Environment Variables

**Production Configuration:**
```env
# Core Database
DATABASE_URL='postgresql://neondb_owner:***@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

# Authentication
NEXTAUTH_SECRET='4c8a4d4d37769e365bc80725438979bcb9b34a7134b8a3e2d55a6e0edbecd803'
NEXTAUTH_URL='http://209.38.85.196:3000'

# AI Configuration
OPENAI_API_KEY='your-openai-api-key-here'
GOOGLE_API_KEY='your-google-api-key-here'

# AI Vision Settings
AI_VISION_ENABLED=true
PRIORITIZE_AI_VISION=true
USE_ASYNC_AI_EXTRACTION=true
AI_VISION_MAX_PAGES=8

# Processing Tuning
COMPLETENESS_THRESHOLD_PDF=0.85
MIN_PRODUCTS_FOR_SUCCESS=50
MAX_PRODUCTS_FOR_FALLBACK=150
MAX_FILE_SIZE_MB=10

# Cost Management
OPENAI_GPT4O_INPUT_COST_PER_1K=0.0025
OPENAI_GPT4O_OUTPUT_COST_PER_1K=0.01
```

### Feature Flags

```env
# Processing Behavior
LLM_FALLBACK_ENABLED=true          # Enable Python fallback
AUTO_APPROVAL_ENABLED=true         # Auto-approve high-quality uploads
AI_STANDARDIZATION_ENABLED=true    # AI-powered data standardization

# Quality Control
AI_VALIDATION_ENABLED=false        # Additional AI validation step
AI_VALIDATION_BATCH_SIZE=200       # Batch size for validation

# Performance Tuning
MAX_AI_STANDARDIZATION_PRODUCTS=100
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=200
```

## 🔄 Data Flow Diagrams

### Upload Processing Flow

```
📤 User Upload
    ↓
🔍 File Validation
    ├── Size Check (< 10MB)
    ├── Type Check (PDF/Excel/Image)
    └── Security Scan
    ↓
📊 Processing Route Decision
    ├── PDF → AI Vision Priority
    ├── Excel → Direct Parsing
    └── Image → AI Vision
    ↓
🤖 AI Processing
    ├── Image Conversion (PDF)
    ├── Batch API Calls
    └── Rate Limit Management
    ↓
✅ Quality Assessment
    ├── Completeness Check
    ├── Data Validation
    └── Error Detection
    ↓
📋 Admin Queue
    ├── Preview Generation
    ├── Quality Scoring
    └── Approval Workflow
    ↓
💾 Data Storage
    ├── Product Creation
    ├── Price Update
    └── History Tracking
```

### Admin Workflow

```
🔐 Admin Login
    ↓
📊 Dashboard Overview
    ├── Pending Uploads Count
    ├── Processing Statistics
    └── Recent Activity
    ↓
📋 Upload Management
    ├── List View with Status
    ├── Bulk Actions
    └── Search/Filter
    ↓
👁️ Preview Mode
    ├── Original File Display
    ├── Extracted Data Table
    ├── Quality Indicators
    └── Inline Editing
    ↓
✅ Decision Making
    ├── Approve → Create Products
    ├── Reject → Archive Upload
    └── Reprocess → Retry Extraction
    ↓
📈 Analytics & Reporting
    ├── Processing Metrics
    ├── Cost Tracking
    └── Quality Trends
```

## 🚀 Performance Characteristics

### Processing Performance

**Typical Processing Times:**
- **PDF (AI Vision)**: 15-30 seconds for 5-10 pages
- **Excel Files**: 5-15 seconds for 100-500 rows
- **Images**: 10-20 seconds per image

**Parallel Processing:**
- **PDF Pages**: Up to 10 pages processed simultaneously
- **Excel Sheets**: Multiple sheets processed in parallel
- **Batch API Calls**: Optimized for OpenAI rate limits

**Token Usage & Costs:**
- **PDF Page**: ~300-800 tokens per page
- **Product Extraction**: ~2-5 tokens per product
- **Average Cost**: $0.02-0.10 per upload

### System Scalability

**Current Limits:**
- **File Size**: 10MB maximum
- **Concurrent Uploads**: 10 simultaneous processes
- **API Rate Limits**: 500 requests/minute (OpenAI)

**Optimization Strategies:**
- **Caching**: Processed results cached for 24 hours
- **Queue Management**: Background job processing
- **Database Indexing**: Optimized queries for large datasets

## 🔒 Security Architecture

### Authentication & Authorization

```typescript
// NextAuth.js Configuration
{
  providers: [
    CredentialsProvider({
      credentials: {
        username: { type: "text" },
        password: { type: "password" }
      },
      authorize: async (credentials) => {
        // Secure credential validation
        const user = await validateAdminCredentials(credentials);
        return user ? { id: user.id, name: user.name } : null;
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt: ({ token, user }) => ({ ...token, ...user }),
    session: ({ session, token }) => ({
      ...session,
      user: { ...session.user, id: token.id }
    })
  }
}
```

### Data Protection

**Input Validation:**
```typescript
// File upload validation
const uploadSchema = z.object({
  file: z.instanceof(File)
    .refine(file => file.size <= 10 * 1024 * 1024, "File too large")
    .refine(file => allowedTypes.includes(file.type), "Invalid file type"),
  supplierId: z.string().cuid()
});
```

**API Security:**
- **Rate Limiting**: 100 requests per minute per IP
- **Input Sanitization**: All inputs validated and sanitized
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **XSS Protection**: React's built-in protection + CSP headers

## 📊 Monitoring & Analytics

### System Metrics

**Processing Metrics:**
```typescript
interface ProcessingMetrics {
  uploadsToday: number;
  successRate: number;
  averageProcessingTime: number;
  totalCostToday: number;
  topErrors: string[];
}
```

**Quality Metrics:**
```typescript
interface QualityMetrics {
  averageCompleteness: number;
  dataAccuracyScore: number;
  manualCorrectionsRequired: number;
  autoApprovalRate: number;
}
```

### Business Intelligence

**Supplier Analytics:**
- Upload frequency and volume
- Data quality trends
- Price change patterns
- Processing cost per supplier

**Product Analytics:**
- New product discovery rate
- Price volatility tracking
- Category distribution
- Unit standardization success

## 🔧 Maintenance & Operations

### Deployment Process

**Production Deployment:**
```bash
# 1. Code deployment
rsync -avz --delete ./ root@209.38.85.196:/opt/monito-web/

# 2. Dependencies update
ssh root@209.38.85.196 "cd /opt/monito-web && npm install"

# 3. Database migration
ssh root@209.38.85.196 "cd /opt/monito-web && npx prisma migrate deploy"

# 4. Application restart
ssh root@209.38.85.196 "pm2 restart monito-web"
```

**Health Checks:**
```bash
# Application status
pm2 status

# Database connectivity
curl http://209.38.85.196:3000/api/stats

# AI API connectivity
curl http://209.38.85.196:3000/api/admin/uploads/pending
```

### Monitoring Alerts

**Critical Alerts:**
- Upload processing failures > 10%
- AI API errors > 5%
- Database connection issues
- High processing costs (> $10/day)

**Warning Alerts:**
- Processing time > 60 seconds
- Queue length > 50 items
- Disk space < 2GB
- Memory usage > 80%

## 🔮 Future Roadmap

### Planned Enhancements

**AI Improvements:**
- **Multi-model Support**: Gemini, Claude integration
- **Custom Models**: Fine-tuned models for specific suppliers
- **Advanced OCR**: Better handling of poor-quality images
- **Confidence Scoring**: AI confidence levels for extracted data

**Performance Optimizations:**
- **Distributed Processing**: Multi-server processing
- **Advanced Caching**: Redis integration
- **Real-time Updates**: WebSocket notifications
- **Batch Processing**: Bulk upload handling

**Feature Expansions:**
- **Mobile App**: React Native mobile application
- **API Integration**: Third-party system integration
- **Advanced Analytics**: Machine learning insights
- **Automated Workflows**: Smart approval rules

### Technical Debt Management

**Code Quality:**
- Comprehensive test coverage (target: 90%)
- TypeScript strict mode enablement
- Performance profiling and optimization
- Security audit and penetration testing

**Infrastructure:**
- Docker containerization
- Kubernetes orchestration
- CI/CD pipeline enhancement
- Automated backup and recovery

This comprehensive system overview provides a complete understanding of how Monito Web operates, from high-level architecture to detailed implementation specifics. The system is designed for scalability, maintainability, and optimal user experience while leveraging cutting-edge AI technology for accurate data extraction.