# 🏗️ Monito Web - Architecture Overview

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [Security Considerations](#security-considerations)

## System Overview

Monito Web is a **B2B price monitoring and comparison platform** designed for the Indonesian HORECA (Hotel, Restaurant, Catering) market. The system helps businesses track supplier prices, standardize product data, and make informed purchasing decisions.

### Key Features
- 📊 Multi-supplier price comparison
- 📄 Automated price list processing (Excel, PDF, CSV, Images)
- 🤖 AI-powered product standardization
- 📱 Telegram bot integration for mobile access
- 📈 Analytics and reporting
- 🔍 OCR for invoice scanning

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
- **API**: Next.js API Routes
- **Database**: PostgreSQL (hosted on Neon)
- **ORM**: Prisma
- **File Storage**: Vercel Blob Storage
- **Authentication**: NextAuth.js (prepared but not fully implemented)

### AI/ML Services
- **Primary LLM**: Google Gemini 2.0 Flash (free tier, high performance)
- **Secondary LLM**: OpenAI GPT-4o and GPT-4o-mini
- **OCR**: Google Gemini Vision API
- **Architecture**: Unified processing system with BaseProcessor pattern
- **Embeddings**: (Prepared for future similarity matching)

### Telegram Bot
- **Framework**: aiogram 3.x (Python)
- **Language**: Python 3.11+
- **Communication**: REST API to main application

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User Interfaces                            │
├─────────────────────┬───────────────────┬──────────────────────────┤
│   Web Application   │   Telegram Bot    │    API (Future)          │
│   (Next.js React)   │   (Python/aiogram)│    (REST/GraphQL)        │
└──────────┬──────────┴────────┬──────────┴──────────┬───────────────┘
           │                   │                      │
           ▼                   ▼                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        API Layer (Next.js)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │   Products  │  │   Suppliers  │  │   Uploads   │  │    Bot    │ │
│  │     API     │  │      API     │  │     API     │  │    API    │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └───────────┘ │
└──────────────────────────┬───────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │   Product   │  │    Price     │  │    File     │  │    AI     │ │
│  │   Service   │  │   Service    │  │  Processor  │  │  Service  │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └───────────┘ │
└──────────────────────────┬───────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Data Access Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Prisma ORM                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                               │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ Suppliers  │  │  Products   │  │   Prices   │  │   Uploads   │  │
│  └────────────┘  └─────────────┘  └────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    External Services                                 │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐                   │
│  │  OpenAI    │  │Vercel Blob  │  │  Telegram  │                   │
│  │    API     │  │  Storage    │  │    API     │                   │
│  └────────────┘  └─────────────┘  └────────────┘                   │
└──────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Web Application (`/app`)
The main user interface built with Next.js App Router:

- **`/app/(auth)`** - Authentication pages (login, register)
- **`/app/(dashboard)`** - Main application pages
  - `products` - Product catalog and price comparison
  - `suppliers` - Supplier management
  - `upload` - Price list upload interface
  - `analytics` - Reports and insights
- **`/app/api`** - API endpoints
  - `products` - CRUD operations for products
  - `suppliers` - Supplier management
  - `upload` - File upload handling
  - `process` - Async file processing
  - `bot` - Telegram bot API endpoints

### 2. Unified Processing System (`/app/lib/core` & `/app/services/core`)
**🎯 New Refactored Architecture** - Centralized processing with unified patterns:

#### Core Components:
- **`BaseProcessor.ts`** - Abstract base class for all processors
- **`Interfaces.ts`** - Unified type definitions and schemas
- **`ErrorHandler.ts`** - Centralized error handling system
- **`PromptTemplates.ts`** - AI prompt management
- **`UnifiedGeminiService.ts`** - Main AI processing service

#### Unified API Endpoint:
- **`/api/upload-unified`** - Single endpoint for all file types
  - Supports: Excel, PDF, CSV, Images
  - Auto-detects file type and processing strategy
  - Handles batch processing for large files
  - Returns standardized response format

#### Processing Pipeline:
1. **Upload** → File validation using BaseProcessor
2. **Routing** → UnifiedGeminiService selects optimal strategy
3. **Extraction** → Gemini 2.0 Flash processes content
4. **Batch Handling** → Auto-splits large files (>200 products)
5. **Standardization** → PromptTemplates ensure consistent results
6. **Error Handling** → ErrorHandler provides unified error responses
7. **Response** → Standardized ProcessingResult format

### 3. AI Integration Strategy
**Primary**: Google Gemini 2.0 Flash (free tier, high performance)
**Secondary**: OpenAI GPT-4o (fallback)

#### Features:
- **Product Standardization**: Maps "Ayam Potong" → "Fresh Cut Chicken"
- **Intelligent Extraction**: Handles complex layouts and formats
- **Batch Processing**: Processes 200+ products per batch efficiently
- **Compact Mode**: Optimized for large files (1000+ products)
- **Quality Assessment**: Confidence scoring and extraction quality metrics

### 4. Telegram Bot (`/telegram-bot`)
Separate Python application for mobile access:

- **Architecture**: Event-driven using aiogram
- **Features**:
  - Product price search
  - Invoice OCR and comparison
  - Multi-language support
- **Communication**: REST API with authentication

### 5. Database Schema
```prisma
model Supplier {
  id          String   @id @default(cuid())
  name        String   @unique
  email       String?
  phone       String?
  address     String?
  prices      Price[]
  uploads     Upload[]
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
  
  @@unique([standardizedName, standardizedUnit])
}

model Price {
  id         String    @id @default(cuid())
  amount     Decimal
  unit       String
  supplier   Supplier  @relation(...)
  product    Product   @relation(...)
  upload     Upload?   @relation(...)
  validFrom  DateTime
  validTo    DateTime? // NULL = current price
}

model Upload {
  id           String   @id @default(cuid())
  fileName     String
  fileUrl      String
  mimeType     String
  fileSize     Int
  status       String   // pending, processing, completed, failed
  supplier     Supplier @relation(...)
  processedAt  DateTime?
  stats        Json?    // Processing statistics
  prices       Price[]
}
```

## Data Flow

### 1. Price List Upload Flow
```
User uploads file → Validation → Storage (Blob) → Queue processing
                                                           ↓
Database ← Import ← Standardization ← Extraction ← File analysis
```

### 2. Product Search Flow
```
User search → API → Database query → Aggregation → Response
                           ↓
                    Price comparison
                           ↓
                    Supplier ranking
```

### 3. Telegram Bot Flow
```
User message → Bot → API Gateway → Backend API → Database
                ↑                       ↓
                ←── Response formatting ←─
```

## Security Considerations

### 1. Authentication & Authorization
- API endpoints protected by authentication middleware
- Bot API uses separate API key authentication
- File uploads validated for type and size
- SQL injection prevention via Prisma ORM

### 2. Data Protection
- Environment variables for sensitive data
- HTTPS enforcement in production
- Input sanitization and validation
- Rate limiting on API endpoints

### 3. File Security
- Virus scanning (planned)
- File type validation
- Size limits (10MB default)
- Sandboxed processing environment

### 4. API Security
- CORS configuration
- Request validation
- Error message sanitization
- Audit logging (planned)

## Performance Optimizations

### 1. Database
- Indexed queries on frequently searched fields
- Efficient pagination
- Connection pooling
- Query optimization

### 2. File Processing
- Async processing with job queue
- Chunked reading for large files
- Memory-efficient streaming
- Parallel processing where possible

### 3. Caching Strategy
- Redis integration (prepared)
- API response caching
- Static asset optimization
- CDN usage for assets

### 4. Frontend
- Server-side rendering where beneficial
- Code splitting
- Image optimization
- Lazy loading

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Database connection pooling
- Distributed file storage
- Queue-based processing

### Vertical Scaling
- Efficient algorithms
- Memory management
- Resource monitoring
- Performance profiling

## Future Enhancements

### Planned Features
1. **Real-time updates** via WebSockets
2. **Advanced analytics** with ML insights
3. **Mobile app** (React Native)
4. **API marketplace** for third-party integrations
5. **Blockchain** for price history verification
6. **Multi-tenant** architecture for SaaS model

### Technical Improvements
1. **Microservices** architecture
2. **GraphQL** API option
3. **Kubernetes** deployment
4. **Event sourcing** for audit trail
5. **Machine learning** pipeline for price predictions