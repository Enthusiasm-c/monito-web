# 🏗️ ARCHITECTURE.md - Monito Web Complete System Architecture

> **CRITICAL**: This is 1 of only 3 core documentation files. Do not create duplicate architecture files.

## Complete System Documentation

**This file contains ALL architecture information for Monito Web:**

1. [System Overview](#system-overview) - Business purpose and features
2. [Technology Stack](#technology-stack) - All technologies used  
3. [Refactored Architecture](#refactored-architecture) - 2024 unified patterns
4. [Core Components](#core-components) - System building blocks
5. [Database Schema](#database-schema) - Complete data model
6. [API Architecture](#api-architecture) - All endpoints and patterns
7. [Security](#security) - Authentication and authorization
8. [Data Flow](#data-flow) - Process workflows

---

## System Overview

Monito Web is a **B2B price monitoring and comparison platform** designed for the Indonesian HORECA (Hotel, Restaurant, Catering) market. The system helps businesses track supplier prices, standardize product data, and make informed purchasing decisions.

### Key Features
- 📊 Multi-supplier price comparison  
- 📄 Automated price list processing (Excel, PDF, CSV, Images)
- 🤖 AI-powered product standardization
- 📱 Telegram bot integration for mobile access
- 📈 Analytics and reporting
- 🔍 OCR for invoice scanning
- 🔄 **Refactored Architecture** - Clean, maintainable codebase (2024)

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15.1.6 (App Router)
- **Language**: TypeScript  
- **Styling**: Tailwind CSS
- **State Management**: React hooks + Context
- **UI Components**: Custom components with shadcn/ui patterns
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes with **AsyncHandler pattern**
- **Database**: PostgreSQL (hosted on Neon) 
- **ORM**: Prisma with **DatabaseService layer**
- **File Storage**: Vercel Blob Storage
- **Authentication**: NextAuth.js (prepared)

### AI/ML Services
- **Primary LLM**: Google Gemini 2.0 Flash (free tier, high performance)
- **Secondary LLM**: OpenAI GPT-4o and GPT-4o-mini
- **OCR**: Google Gemini Vision API
- **Architecture**: **BaseProcessor inheritance pattern**
- **Error Handling**: **Standardized AsyncHandler with custom error classes**
- **Database Access**: **Service layer pattern with DatabaseService**
- **Unit Conversion**: **Unified converter supporting Indonesian units**

### Infrastructure
- **Hosting**: Vercel
- **File Storage**: Vercel Blob Storage  
- **Database**: Neon PostgreSQL
- **Monitoring**: Built-in logging and error tracking

---

## Refactored Architecture (2024)

### 🚨 CRITICAL: Anti-Duplication Patterns

The system was refactored to eliminate 60% of duplicate code. **All new development MUST follow these patterns:**

#### 1. BaseProcessor Pattern (MANDATORY)
```typescript
// ✅ CORRECT: All processors extend BaseProcessor
class NewProcessor extends BaseProcessor {
  public static getInstance(): NewProcessor {
    return super.getInstance.call(this) as NewProcessor;
  }
  
  constructor() {
    super('NewProcessor');
  }
  
  async processDocument(content: Buffer, fileName: string): Promise<ProcessingResult> {
    // Implementation with inherited error handling, validation, logging
  }
}

// ❌ WRONG: Custom singleton patterns
class BadProcessor {
  private static instance: BadProcessor;
  public static getInstance() { /* duplicate code */ }
}
```

#### 2. AsyncHandler Pattern (MANDATORY)
```typescript
// ✅ CORRECT: All API routes use asyncHandler
export const GET = asyncHandler(async (request: NextRequest) => {
  const data = await databaseService.getData();
  return NextResponse.json(data);
});

// ❌ WRONG: Manual try-catch blocks
export async function GET() {
  try {
    // ...code
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

#### 3. DatabaseService Pattern (MANDATORY)
```typescript
// ✅ CORRECT: Use DatabaseService
const { suppliers } = await databaseService.getSuppliers();

// ❌ WRONG: Direct Prisma access in API routes
const suppliers = await prisma.supplier.findMany();
```

#### 4. Unified Unit Conversion (MANDATORY)
```typescript
// ✅ CORRECT: Use unified converter
import { calculateUnitPrice } from '../../lib/utils/unified-unit-converter';
const unitPrice = calculateUnitPrice(price, quantity, unit);

// ❌ WRONG: Custom conversion logic
const unitPrice = price / (quantity / 1000); // duplicate logic
```

### Core Architecture Components

#### Processing System
- **BaseProcessor**: Base class for all file processors with singleton pattern
- **UnifiedGeminiService**: Centralized Gemini API integration  
- **DatabaseService**: Unified database operations with error handling
- **AsyncHandler**: Standardized error handling for all API routes
- **Unified Unit Converter**: Single source for all unit conversions

#### Legacy Components (DEPRECATED - DO NOT USE)
- ❌ `enhancedFileProcessor.ts` - Replaced by BaseProcessor pattern
- ❌ Individual singleton implementations - Use BaseProcessor
- ❌ Direct Prisma access in API routes - Use DatabaseService
- ❌ Custom try-catch blocks - Use AsyncHandler
- ❌ Multiple unit conversion functions - Use unified converter

---

## Core Components

### 1. File Processing Pipeline
**Primary Components**:
- **EnhancedPdfExtractor** (extends BaseProcessor): PDF → Images → Gemini Vision
- **EnhancedExcelExtractor** (extends BaseProcessor): Excel/CSV parsing + AI standardization
- **UnifiedGeminiService**: Centralized AI processing with intelligent routing

**Process Flow**:
1. File upload to Vercel Blob Storage
2. File type detection and routing
3. Content extraction using appropriate processor  
4. AI-powered product standardization
5. Database storage via DatabaseService
6. Real-time progress updates via SSE

### 2. AI Processing System
**Primary Model**: Google Gemini 2.0 Flash (free tier, excellent performance)
**Secondary**: OpenAI GPT-4o (fallback)

**Features**:
- **Product Standardization**: Maps "Ayam Potong" → "Fresh Cut Chicken"
- **Intelligent Extraction**: Handles complex layouts and formats
- **Batch Processing**: Processes 200+ products per batch efficiently
- **Quality Assessment**: Confidence scoring and extraction quality metrics

### 3. Telegram Bot Integration
**Separate Python application** (`/telegram-bot`) for mobile access:
- **Framework**: aiogram 3.x
- **Features**: Product search, invoice OCR, price comparison
- **Communication**: REST API with Next.js backend

---

## Database Schema

### Core Models
```prisma
model Supplier {
  id          String   @id @default(cuid())
  name        String   @unique
  email       String?
  phone       String?
  address     String?
  prices      Price[]
  uploads     Upload[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Product {
  id               String   @id @default(cuid())
  rawName          String   // Original supplier name
  name             String   // Display name
  standardizedName String   // Canonical name for matching
  category         String?
  unit             String
  standardizedUnit String
  prices           Price[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@unique([standardizedName, standardizedUnit])
}

model Price {
  id         String    @id @default(cuid())
  amount     Decimal
  unit       String
  unitPrice  Decimal?  // Pre-calculated for performance
  validFrom  DateTime  @default(now())
  validTo    DateTime? // NULL for current prices
  supplierId String
  productId  String
  uploadId   String?
  
  supplier   Supplier  @relation(fields: [supplierId], references: [id])
  product    Product   @relation(fields: [productId], references: [id])
  upload     Upload?   @relation(fields: [uploadId], references: [id])
  
  @@index([supplierId, validTo])
  @@index([productId, validTo])
}

model Upload {
  id          String    @id @default(cuid())
  fileName    String
  fileUrl     String
  fileSize    Int
  status      String    // 'pending', 'processing', 'completed', 'failed'
  supplierId  String?
  metadata    Json?
  prices      Price[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  supplier    Supplier? @relation(fields: [supplierId], references: [id])
}
```

### Key Relationships
- **Supplier** has many **Prices** and **Uploads**
- **Product** has many **Prices** (historical tracking)
- **Price** belongs to **Supplier**, **Product**, and **Upload**
- **Upload** tracks file processing status and metadata

---

## API Architecture

### Standardized Patterns (MANDATORY)

All API routes MUST follow these patterns:

#### Error Handling
```typescript
import { asyncHandler, ValidationError } from '../../utils/errors';

export const POST = asyncHandler(async (request: NextRequest) => {
  // Automatic error handling - no manual try-catch needed
});
```

#### Database Access
```typescript
import { databaseService } from '../../services/DatabaseService';

// Use service layer - never direct Prisma in routes
const data = await databaseService.getProducts(search, pagination);
```

#### Request Parsing
```typescript
import { parseSearchParams, parsePaginationParams } from '../../utils/api-helpers';

const searchParams = parseSearchParams(request);
const pagination = parsePaginationParams(request);
```

### Core Endpoints

#### Public API
- `POST /api/upload-unified` - File upload for all formats
- `GET /api/products` - Product search with price comparison
- `GET /api/suppliers` - Supplier directory
- `GET /api/stats` - System statistics

#### Bot API
- `GET /api/bot/products/search` - Product search for Telegram
- `POST /api/bot/prices/compare` - Price comparison with alternatives

#### Admin API
- `GET/PUT/DELETE /api/admin/products/[id]` - Product management
- `GET/PUT/DELETE /api/admin/prices/[id]` - Price management  
- `GET /api/admin/analytics/prices` - Analytics and trends
- `POST /api/admin/bulk-operations` - Bulk data operations

#### Upload Processing
- `GET /api/admin/uploads/status/[id]` - Processing status
- `GET /api/admin/uploads/status/[id]/stream` - Real-time updates via SSE
- `POST /api/admin/uploads/approve` - Approve processed data
- `POST /api/admin/uploads/reject` - Reject and reprocess

---

## Security

### Authentication
- **NextAuth.js** integration (prepared but not fully implemented)
- **Environment-based** API key protection
- **Request validation** on all endpoints

### Data Protection
- **Input sanitization** via Prisma and validation middleware
- **SQL injection protection** through Prisma ORM
- **Rate limiting** on API endpoints (planned)
- **File upload restrictions** (10MB limit, type validation)

### API Security
- **CORS configuration** for frontend-only access
- **Environment variable** protection for API keys
- **Error message sanitization** (no sensitive data exposure)

---

## Data Flow

### 1. File Upload Process
```
User uploads file → Vercel Blob Storage → File type detection → 
Appropriate processor (PDF/Excel) → AI extraction → 
Product standardization → Database storage → Admin review
```

### 2. AI Processing Pipeline
```
Raw file → Content extraction → Gemini Vision/Text processing → 
Product identification → OpenAI standardization → 
Unit conversion → Price calculation → Database storage
```

### 3. Price Comparison Flow
```
User search → Product matching → Related price lookup → 
Unit price calculation → Supplier deduplication → 
Best/worst price identification → Savings calculation → Response
```

### 4. Telegram Bot Integration
```
Bot command → Next.js API → Database query → 
Response formatting → Telegram message → 
Optional follow-up actions
```

---

## Performance Considerations

### Database Optimization
- **Indexed queries** on supplier, product, and price lookups
- **Connection pooling** via Prisma
- **Batch operations** for bulk data processing
- **Pagination** on all list endpoints

### AI Processing Optimization
- **Batch processing** (200+ products per request)
- **Intelligent routing** between Gemini models
- **Response caching** for repeated requests
- **Cost monitoring** and usage tracking

### Frontend Performance
- **Server-side rendering** with Next.js 15
- **Component optimization** with React patterns
- **Image optimization** via Next.js built-ins
- **Bundle optimization** with tree shaking

---

## Monitoring and Observability

### Logging
- **Centralized logging** via BaseProcessor pattern
- **Request tracking** with AsyncHandler
- **Error aggregation** with custom error classes
- **Performance metrics** collection

### Health Checks
- **Database connectivity** monitoring
- **AI service availability** checks
- **File storage status** verification
- **Processing queue** health monitoring

---

## Development Guidelines

### Code Quality Rules
1. **NEVER** create custom singleton patterns - use BaseProcessor
2. **NEVER** use direct Prisma in API routes - use DatabaseService  
3. **NEVER** write manual try-catch in API routes - use AsyncHandler
4. **NEVER** duplicate unit conversion logic - use unified converter
5. **ALWAYS** follow TypeScript strict mode
6. **ALWAYS** validate inputs with proper error classes
7. **ALWAYS** use existing utilities before creating new ones

### Testing Requirements
- **Unit tests** for all business logic
- **Integration tests** for API endpoints
- **End-to-end tests** for critical user flows
- **Performance tests** for AI processing pipeline

---

This document contains ALL architectural information for Monito Web. Do not create additional architecture files.