# 🏗️ Monito-Web Architecture Documentation

**Version:** 2.0  
**Last Updated:** 19 июня 2025  
**Status:** Production-Ready

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Layer](#database-layer)
3. [API Layer](#api-layer)
4. [Business Logic Layer](#business-logic-layer)
5. [AI Integration](#ai-integration)
6. [File Processing Pipeline](#file-processing-pipeline)
7. [Authentication & Security](#authentication--security)
8. [Performance & Optimization](#performance--optimization)
9. [Deployment Architecture](#deployment-architecture)

---

## 🎯 Architecture Overview

### System Architecture Pattern
Monito-Web follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  Next.js 15 + React 19 + TypeScript + Tailwind CSS        │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                             │
│     Next.js API Routes + Middleware + Authentication       │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                  BUSINESS LOGIC LAYER                      │
│   Services + Utilities + AI Processing + Validation        │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER                       │
│              Prisma ORM + PostgreSQL (Neon)                │
└─────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Single Responsibility** - Each module has one clear purpose
2. **Dependency Injection** - Use of singletons and shared services
3. **Data Integrity** - Strict validation at all layers
4. **Performance First** - Optimized queries and connection pooling
5. **AI-Enhanced** - Intelligent product matching and standardization

---

## 🗄️ Database Layer

### Connection Management

**❌ WRONG - Deprecated Pattern:**
```typescript
// DON'T DO THIS - Creates memory leaks
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

**✅ CORRECT - Singleton Pattern:**
```typescript
// ALWAYS USE THIS
import { prisma } from '@/lib/prisma';
```

### Database Schema Overview

```sql
-- Core Product Management
Product {
  id, rawName, name, standardizedName
  category, unit, standardizedUnit
  prices[], aliases[]
}

-- Pricing System with History
Price {
  id, amount, unit, unitPrice
  supplierId, productId, uploadId
  validFrom, validTo  -- Historical tracking
}

-- Multi-language Support
ProductAlias {
  id, productId, alias, language
  -- Enables Indonesian/Spanish/English names
}

-- File Processing Workflow
Upload {
  id, fileName, status, approvalStatus
  extractedData, processingDetails
  supplierId, prices[]
}

-- Data Quality Management
UnmatchedQueue {
  id, rawName, normalizedName
  context, assignedProductId
  -- Manual review for failed matches
}
```

### Performance Optimizations

1. **Connection Pooling**: Single Prisma instance across application
2. **Indexes**: Strategic indexes on frequently queried fields
3. **Query Optimization**: Selective includes and proper pagination
4. **Batch Operations**: Bulk creates and updates where possible

---

## 🔌 API Layer

### API Route Structure

```
app/api/
├── admin/                    # Admin-only endpoints
│   ├── products/            # Product management
│   ├── suppliers/           # Supplier management
│   ├── unmatched/           # Unmatched product queue
│   └── dictionaries/        # Language/unit dictionaries
├── bot/                     # Telegram bot integration
│   ├── prices/compare/      # Core price comparison engine
│   ├── products/search/     # Product search with similarity
│   └── suppliers/search/    # Supplier lookup
├── products/                # Public product endpoints
├── suppliers/               # Public supplier endpoints
├── uploads/                 # File upload and processing
└── standardization/         # AI-powered standardization
```

### Authentication Patterns

#### Bot Authentication
```typescript
// Bot API endpoints use API key authentication
import { authenticateBot } from '../../middleware';

export async function POST(request: NextRequest) {
  const authError = authenticateBot(request);
  if (authError) return authError;
  // ... rest of handler
}
```

#### Admin Authentication
```typescript
// Admin endpoints should implement role-based auth
// TODO: Implement proper admin authentication
```

### Error Handling Pattern

**✅ Standardized Error Response:**
```typescript
export async function GET(request: NextRequest) {
  try {
    // Business logic here
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 🧠 Business Logic Layer

### Service Architecture

```
app/services/
├── core/                    # Core business services
│   └── UnifiedGeminiService.ts
├── database/                # Data access services
│   ├── aliasService.ts     # Product alias management
│   └── priceService.ts     # Price operations
├── ai-optimized/           # AI processing services
├── background/             # Background job processing
└── enhanced*/              # File processing services
```

### Product Matching Pipeline

1. **Normalization** (`product-normalizer.ts`)
   - Multi-language translation (ID/EN/ES)
   - Text cleaning and standardization
   - Duplicate word removal

2. **Alias Lookup** (`aliasService.ts`)
   - Exact alias matching
   - Normalized search fallback

3. **Fuzzy Search** (API routes)
   - Word-based matching
   - OCR error correction
   - Similarity scoring

4. **AI Standardization** (`standardization.ts`)
   - OpenAI o3-mini integration
   - Complex product name translation
   - Confidence scoring

### Validation Layer

```typescript
// Product validation with Zod schemas
import { productSchema } from '@/app/utils/validation';

const validation = productSchema.safeParse(productData);
if (!validation.success) {
  return { error: validation.error.errors };
}
```

---

## 🤖 AI Integration

### AI Services Architecture

```
AI Processing Pipeline:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Document OCR   │ -> │ Product Extract │ -> │ Standardization │
│  (Gemini 2.0)   │    │   (GPT-4o)      │    │   (o3-mini)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Text Content   │    │ Raw Products    │    │ Standardized    │
│    Extracted    │    │   Identified    │    │   Names         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### AI Model Selection Strategy

| Task | Model | Reason |
|------|-------|--------|
| **Document OCR** | Gemini 2.0 Flash | Fast, cost-effective for batch processing |
| **Product Extraction** | GPT-4o | Best structured output and reasoning |
| **Name Standardization** | o3-mini | Specialized reasoning for complex translations |
| **Image Processing** | GPT-4o-mini + Vision | Balanced cost/performance for images |

### AI Fallback Strategy

```typescript
// Multi-tier AI fallback in price comparison
if (products.length === 0) {
  // Tier 1: AI when no matches
  const aiResult = await tryAIStandardization(item, "No match found");
}
else if (finalSimilarity === 0) {
  // Tier 2: AI when incompatible matches
  const aiResult = await tryAIStandardization(item, "Incompatible match");
}
else if (finalSimilarity < 30) {
  // Tier 3: AI when low similarity
  const aiResult = await tryAIStandardization(item, "Low similarity");
}
```

---

## 📄 File Processing Pipeline

### Unified Processing Architecture

```
File Upload -> Document Classification -> Format-Specific Extraction -> 
AI Standardization -> Validation -> Database Storage -> Quality Review
```

### Processing Strategies

1. **Excel/CSV Files**
   - Direct parsing with ExcelJS
   - Batch processing for large files
   - Smart column detection

2. **PDF Documents**
   - OCR with pdf-parse + Gemini 2.0
   - Table extraction optimization
   - Multi-page handling

3. **Image Files**
   - GPT-4o Vision API
   - Image optimization and compression
   - Automatic cropping and enhancement

### Quality Assurance

- **Completeness Ratio**: Percentage of successfully processed rows
- **Confidence Scoring**: AI confidence in extracted data
- **Manual Review Queue**: Unmatched products for admin review
- **Validation Rules**: Comprehensive data quality checks

---

## 🔐 Authentication & Security

### Current Security Measures

1. **Bot API Authentication**
   ```typescript
   // API key-based authentication for Telegram bot
   X-Bot-API-Key: <secure-api-key>
   ```

2. **Input Validation**
   - Zod schema validation on all inputs
   - SQL injection prevention via Prisma
   - File type and size restrictions

3. **Environment Security**
   - Sensitive keys in environment variables
   - No secrets committed to repository
   - Proper `.gitignore` configuration

### Security Recommendations

1. **Implement Rate Limiting**
2. **Add CORS Configuration**
3. **Enable Request Logging**
4. **Add Admin Role Authentication**
5. **Implement API Versioning**

---

## ⚡ Performance & Optimization

### Database Optimizations

1. **Connection Pooling**
   ```typescript
   // Single Prisma instance prevents connection exhaustion
   import { prisma } from '@/lib/prisma';
   ```

2. **Query Optimization**
   ```typescript
   // Strategic includes and selective fields
   const products = await prisma.product.findMany({
     select: { id: true, name: true, unit: true },
     include: { prices: { where: { validTo: null } } }
   });
   ```

3. **Indexing Strategy**
   - Product names and standardized names
   - Price relationships and validity dates
   - Upload status and creation dates

### AI Cost Management

1. **Token Cost Monitoring** (`tokenCostMonitor.ts`)
2. **Batch Processing** (Multiple products per AI call)
3. **Model Selection** (Appropriate model for each task)
4. **Caching Strategy** (Standardized names cache)

### Memory Management

**Before Optimization:**
- 81 Prisma instances × 15MB = ~1.2GB memory usage
- Multiple connection pools causing exhaustion

**After Optimization:**
- 1 Prisma singleton = ~15MB memory usage
- Single connection pool with proper pooling
- **~1.185GB memory savings**

---

## 🚀 Deployment Architecture

### Production Environment

```
Internet -> Cloudflare -> Vercel Edge -> Next.js App -> Neon PostgreSQL
                                     |
                                     v
                              External Services:
                              - OpenAI API
                              - Google Gemini
                              - Vercel Blob Storage
```

### Environment Configuration

```bash
# Database
DATABASE_URL=<neon-postgresql-url>

# AI Services
OPENAI_API_KEY=<openai-api-key>
GEMINI_API_KEY=<google-gemini-key>

# File Storage
BLOB_READ_WRITE_TOKEN=<vercel-blob-token>

# Processing Configuration
MAX_FILE_SIZE_MB=10
AI_STANDARDIZATION_ENABLED=true
AUTO_APPROVAL_ENABLED=false

# Security
BOT_API_KEY=<telegram-bot-api-key>
```

### Monitoring & Logging

1. **Processing Logs** (`processingLogger.ts`)
2. **Error Tracking** (Console logs + structured logging)
3. **Performance Metrics** (Token usage, processing times)
4. **Quality Metrics** (Completeness ratios, match rates)

---

## 📚 Key Architectural Decisions

### Why These Choices Were Made

1. **Next.js 15**: Full-stack React framework with excellent TypeScript support
2. **Prisma ORM**: Type-safe database access with great migration support
3. **PostgreSQL**: Robust relational database with JSON support for flexibility
4. **Multiple AI Models**: Each optimized for specific tasks
5. **Layered Architecture**: Clear separation of concerns for maintainability

### Trade-offs Considered

1. **AI Cost vs. Accuracy**: Balanced model selection for cost efficiency
2. **Processing Speed vs. Quality**: Background processing for complex operations
3. **Flexibility vs. Performance**: Cached standardization with fallbacks
4. **Automation vs. Control**: Manual review queue for quality assurance

---

## 🔄 Migration & Updates

### Database Migrations

```bash
# Development
npm run db:migrate:dev

# Production
npm run db:migrate:prod
```

### Code Updates

1. **Always use singleton Prisma import**
2. **Follow established error handling patterns**
3. **Maintain API compatibility**
4. **Update documentation with changes**

---

## 🧪 Testing Strategy

### Current Testing Approach

1. **Integration Tests** (`test-integration.js`)
2. **Unit Tests** (`test-unit-functions.js`)
3. **AI Stress Tests** (`test-ai-standardization.js`)
4. **API Tests** (`test-bot-api.js`)

### Testing Recommendations

1. **Add Jest/Vitest Framework**
2. **Implement E2E Testing**
3. **Add Performance Testing**
4. **Set up CI/CD Pipeline**

---

**📞 Contact**: For architecture questions or modifications, refer to this document and the established patterns.

**🔗 Related Documents**: 
- [RULES.md](./RULES.md) - Development rules and best practices
- [SYSTEM_ANALYSIS_REPORT.md](./SYSTEM_ANALYSIS_REPORT.md) - System analysis and recommendations