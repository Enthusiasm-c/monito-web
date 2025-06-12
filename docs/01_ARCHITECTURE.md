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
- **LLM**: OpenAI GPT-4o and GPT-4o-mini
- **OCR**: OpenAI Vision API
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

### 2. File Processing System (`/lib/processors`)
Handles various file formats with intelligent extraction:

- **`ExcelProcessor`** - Handles .xlsx, .xls files
- **`PDFProcessor`** - Extracts tables from PDFs
- **`CSVProcessor`** - Processes CSV files
- **`ImageProcessor`** - OCR for images
- **`AIProcessor`** - Fallback using GPT-4 Vision

#### Processing Pipeline:
1. **Upload** → File validation and storage
2. **Analysis** → Format detection and structure analysis
3. **Extraction** → Data extraction using appropriate processor
4. **Standardization** → AI-powered product name normalization
5. **Validation** → Data quality checks
6. **Import** → Database updates with conflict resolution

### 3. AI Integration (`/lib/ai`)
Leverages OpenAI for intelligent processing:

- **Product Standardization**: Maps supplier names to canonical forms
- **Category Detection**: Auto-categorizes products
- **Unit Normalization**: Standardizes measurements
- **Data Extraction**: Fallback for complex documents
- **OCR Enhancement**: Improves text recognition accuracy

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