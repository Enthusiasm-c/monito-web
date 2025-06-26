# Technical Documentation

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Design](#database-design)
3. [AI Integration](#ai-integration)
4. [Product Matching Mechanism](#product-matching-mechanism)
5. [File Processing Pipeline](#file-processing-pipeline)
6. [API Design](#api-design)
7. [Performance Optimization](#performance-optimization)
8. [Security Implementation](#security-implementation)

---

## System Architecture

### Architectural Pattern

Monito Web follows a **layered architecture** with clear separation of concerns:

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
2. **Unified Processing** - Centralized AI processing with BaseProcessor pattern
3. **Data Integrity** - Strict validation at all layers
4. **Performance First** - Optimized queries and connection pooling
5. **AI-Enhanced** - Intelligent product matching and standardization

### Technology Stack

**Frontend:**
- Next.js 15.1.6 (App Router)
- TypeScript for type safety
- Tailwind CSS for styling
- Recharts for data visualization

**Backend:**
- Node.js runtime
- Prisma ORM with PostgreSQL
- Google Gemini 2.0 Flash (primary AI)
- OpenAI GPT-4o (secondary AI)
- NextAuth.js for authentication

**Infrastructure:**
- Vercel for hosting
- Neon for PostgreSQL hosting
- Vercel Blob for file storage

---

## Database Design

### Core Schema

```sql
-- Suppliers: Business entities providing products
model Supplier {
  id          String   @id @default(cuid())
  name        String   @unique
  email       String?
  phone       String?
  address     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  prices      Price[]
  uploads     Upload[]
}

-- Products: Standardized product catalog
model Product {
  id               String   @id @default(cuid())
  rawName          String?  // Original supplier name
  name             String   // Display name
  standardizedName String   // Canonical name for matching
  category         String?
  unit             String
  standardizedUnit String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  prices           Price[]
  aliases          ProductAlias[]
  
  @@unique([standardizedName, standardizedUnit])
}

-- Product Aliases: Multi-language support
model ProductAlias {
  id        String  @id @default(cuid())
  productId String
  alias     String
  language  String  @default("en")
  createdAt DateTime @default(now())
  
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  @@unique([alias, language])
}

-- Prices: Historical price tracking
model Price {
  id         String    @id @default(cuid())
  amount     Decimal
  currency   String    @default("IDR")
  unit       String
  unitPrice  Decimal?  // Calculated price per standard unit
  validFrom  DateTime  @default(now())
  validTo    DateTime? // NULL = current price
  createdAt  DateTime  @default(now())
  
  supplierId String
  productId  String
  uploadId   String?
  
  supplier   Supplier @relation(fields: [supplierId], references: [id])
  product    Product  @relation(fields: [productId], references: [id])
  upload     Upload?  @relation(fields: [uploadId], references: [id])
  
  @@index([productId, validTo])
  @@index([supplierId, validTo])
}

-- Price History: Change tracking
model PriceHistory {
  id          String   @id @default(cuid())
  priceId     String
  oldAmount   Decimal?
  newAmount   Decimal
  changeType  String   // "created", "updated", "deleted"
  reason      String?
  changedBy   String?  // User ID
  changedAt   DateTime @default(now())
  
  @@index([priceId, changedAt])
}

-- Uploads: File processing tracking
model Upload {
  id              String    @id @default(cuid())
  fileName        String
  fileUrl         String
  mimeType        String
  fileSize        Int
  status          String    // pending, processing, completed, failed
  approvalStatus  String    @default("pending") // pending, approved, rejected
  extractedData   Json?     // Raw extracted data
  processingStats Json?     // Processing statistics
  errorMessage    String?
  createdAt       DateTime  @default(now())
  processedAt     DateTime?
  
  supplierId      String
  supplier        Supplier  @relation(fields: [supplierId], references: [id])
  prices          Price[]
  
  @@index([status, createdAt])
}

-- Users: Authentication and roles
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  role      String   @default("viewer") // admin, manager, viewer
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Database Optimizations

1. **Connection Pooling**: Single Prisma instance across application
2. **Strategic Indexes**: On frequently queried fields
3. **Query Optimization**: Selective includes and proper pagination
4. **Batch Operations**: Bulk creates and updates

**❌ WRONG - Memory Leak Pattern:**
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient(); // Creates new instance each import
```

**✅ CORRECT - Singleton Pattern:**
```typescript
import { prisma } from '@/lib/prisma'; // Uses shared singleton
```

---

## AI Integration

### AI Service Architecture

```
AI Processing Pipeline:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Document OCR   │ -> │ Product Extract │ -> │ Standardization │
│  (Gemini 2.0)   │    │   (GPT-4o)      │    │   (GPT-4o)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Text Content   │    │ Raw Products    │    │ Standardized    │
│    Extracted    │    │   Identified    │    │   Names         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Model Selection Strategy

| Task | Model | Reason |
|------|-------|--------|
| **PDF Processing** | Gemini 2.0 Flash | Fast, cost-effective, native PDF support |
| **Excel/CSV/Image** | GPT-4o | Best structured output and reasoning |
| **Name Standardization** | GPT-4o | Superior language understanding |
| **Invoice OCR** | GPT-4o-mini + Vision | Balanced cost/performance for images |

### Unified Processing System

#### BaseProcessor Pattern

```typescript
// app/lib/core/BaseProcessor.ts
export abstract class BaseProcessor {
  abstract validateInput(input: any): Promise<ValidationResult>;
  abstract extractData(input: any): Promise<ExtractionResult>;
  abstract standardizeData(data: any): Promise<StandardizationResult>;
  
  async process(input: any): Promise<ProcessingResult> {
    const validation = await this.validateInput(input);
    if (!validation.success) return validation;
    
    const extraction = await this.extractData(input);
    if (!extraction.success) return extraction;
    
    const standardization = await this.standardizeData(extraction.data);
    return standardization;
  }
}
```

#### UnifiedGeminiService

```typescript
// app/services/core/UnifiedGeminiService.ts
export class UnifiedGeminiService extends BaseProcessor {
  async extractFromPDF(file: Buffer): Promise<ExtractionResult> {
    const model = this.gemini.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" 
    });
    
    // Direct PDF processing without preprocessing
    const result = await model.generateContent([
      { text: PromptTemplates.PDF_EXTRACTION },
      { 
        inlineData: {
          mimeType: "application/pdf",
          data: file.toString("base64")
        }
      }
    ]);
    
    return this.parseStructuredResponse(result);
  }
}
```

### AI Prompt Management

Centralized prompt templates ensure consistent results:

```typescript
// app/lib/core/PromptTemplates.ts
export const PromptTemplates = {
  PDF_EXTRACTION: `
    Extract product information from this PDF price list.
    Return JSON with this exact structure:
    {
      "products": [
        {
          "name": "Product Name",
          "price": 25000,
          "unit": "kg",
          "category": "vegetables"
        }
      ]
    }
    Handle Indonesian formatting (dots as thousand separators).
  `,
  
  PRODUCT_STANDARDIZATION: `
    Standardize these product names to English canonical forms:
    - Consistent naming (Fresh Cut Chicken, not Chicken Fresh Cut)
    - Standard units (kg, ltr, pcs)
    - Remove supplier-specific codes
    
    Input: {products}
    Output: Standardized product list in same format
  `
};
```

---

## Product Matching Mechanism

### Multi-Tier Matching Strategy

The system uses a sophisticated matching pipeline to handle various challenges:

1. **Alias Lookup** (Fastest)
2. **Direct Search** (Database queries)
3. **Fuzzy Matching** (Similarity scoring)
4. **AI Fallback** (When all else fails)

### Matching Pipeline Implementation

#### Tier 1: Alias System

Direct mapping for common translations:

```typescript
// M-1: Product Alias System
async function aliasLookup(query: string): Promise<string | null> {
  const normalizedQuery = normalize(query);
  
  const alias = await prisma.productAlias.findUnique({
    where: { 
      alias_language: { 
        alias: normalizedQuery, 
        language: "id" 
      } 
    },
    include: { product: true }
  });
  
  return alias?.productId || null;
}

// Examples:
// "wortel" → CARROT product ID
// "zanahoria" → CARROT product ID
```

#### Tier 2: Multi-language Normalization

```typescript
// M-2: Language normalization with 100+ translations
const LANGUAGE_MAP = {
  // Indonesian → English
  'wortel': 'carrot',
  'kentang': 'potato',
  'tomat': 'tomato',
  'bawang': 'onion',
  'cabai': 'chili',
  
  // Spanish → English  
  'zanahoria': 'carrot',
  'patata': 'potato',
  'cebolla': 'onion',
  'chile': 'chili'
};

function normalize(input: string): string {
  const words = input.toLowerCase().split(/\s+/);
  return words.map(word => LANGUAGE_MAP[word] || word).join(' ');
}
```

#### Tier 3: Smart Similarity Scoring

```typescript
// Core similarity calculation with modifier awareness
function calculateProductSimilarity(query: string, productName: string): number {
  // M-3: Core noun validation prevents false matches
  if (hasDifferentCoreNoun(query, productName)) {
    return 0; // "sweet potato" ≠ "potato"
  }
  
  // Exclusive modifier check (0 score if incompatible)
  if (hasExclusiveModifierMismatch(query, productName)) {
    return 0; // "red onion" ≠ "white onion"
  }
  
  // Exact match gets highest score
  if (normalizeProductName(query) === normalizeProductName(productName)) {
    return 100;
  }
  
  // Word overlap scoring with bonuses/penalties
  const score = calculateWordOverlapScore(query, productName);
  return Math.min(100, score);
}
```

#### Modifier Classification System

```typescript
const MODIFIERS = {
  exclusive: [
    // Colors that change product nature
    'black', 'white', 'red', 'green', 'yellow', 'purple',
    
    // Processing states
    'dried', 'frozen', 'canned', 'pickled', 'smoked',
    
    // Origins that matter
    'japanese', 'chinese', 'organic', 'wild', 'sea'
  ],
  
  descriptive: [
    // Size (don't change core product)
    'big', 'large', 'small', 'mini', 'medium',
    
    // Quality descriptors
    'fresh', 'premium', 'grade', 'quality',
    
    // Form descriptors
    'whole', 'half', 'piece', 'slice'
  ]
};

function hasExclusiveModifierMismatch(query: string, productName: string): boolean {
  const queryExclusives = getExclusiveModifiers(query);
  const productExclusives = getExclusiveModifiers(productName);
  
  // Allow partial queries (no modifiers) to match any product
  if (queryExclusives.length === 0) return false;
  
  // Check for conflicts when query has exclusive modifiers
  return queryExclusives.some(mod => !productExclusives.includes(mod)) ||
         productExclusives.some(mod => !queryExclusives.includes(mod));
}
```

### Unit Price Calculations

```typescript
// M-4: Accurate unit price calculations with conversions
function calcUnitPrice(amount: number, quantity: number, unit: string): number {
  const canonicalUnit = getCanonicalUnit(unit);
  
  switch (canonicalUnit) {
    case 'kg':
      if (unit === 'g' || unit === 'gr') {
        return (amount / quantity) * 1000; // Convert g to kg
      }
      break;
    case 'ltr':
      if (unit === 'ml') {
        return (amount / quantity) * 1000; // Convert ml to ltr
      }
      break;
    case 'pcs':
      if (unit === 'dozen') {
        return (amount / quantity) * 12; // Convert dozen to pcs
      }
      break;
  }
  
  return amount / quantity;
}

// Examples:
// calcUnitPrice(25000, 0.2, 'kg') → 125000 (0.2kg @ 25k = 125k/kg)
// calcUnitPrice(25000, 200, 'g') → 125000 (200g @ 25k = 125k/kg)
```

### Better Deals Detection

```typescript
// M-5: Supplier & freshness filtering
const FRESH_DAYS = 7;
const MIN_SAVING_PCT = 5;

function findBetterDeals(scannedItem: any, allPrices: Price[]): BetterDeal[] {
  return allPrices
    .filter(price => {
      // Exclude same supplier
      if (scannedItem.supplier_id && price.supplierId === scannedItem.supplier_id) {
        return false;
      }
      
      // Only fresh prices (within 7 days)
      const daysDiff = Math.floor((Date.now() - price.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      if (daysDiff > FRESH_DAYS) return false;
      
      // Minimum 5% savings
      const savingsPct = ((scannedItem.unit_price - price.unitPrice) / scannedItem.unit_price) * 100;
      return savingsPct >= MIN_SAVING_PCT;
    })
    .sort((a, b) => a.unitPrice - b.unitPrice)
    .slice(0, 3); // Maximum 3 alternatives
}
```

---

## File Processing Pipeline

### Unified Processing Architecture

```
File Upload → Document Classification → Format-Specific Extraction → 
AI Standardization → Validation → Database Storage → Quality Review
```

### Processing Strategies by File Type

#### 1. PDF Documents

**Gemini 2.0 Flash Native Processing:**
```typescript
async function processPDF(file: Buffer): Promise<ExtractionResult> {
  // Direct PDF processing without preprocessing
  const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  
  const result = await model.generateContent([
    { text: PromptTemplates.PDF_EXTRACTION },
    { 
      inlineData: {
        mimeType: "application/pdf",
        data: file.toString("base64")
      }
    }
  ]);
  
  return parseStructuredResponse(result);
}
```

**Benefits:**
- No preprocessing required (no Camelot, pdfjs)
- Handles complex layouts and tables
- OCR built-in for scanned documents
- Cost-effective with free tier

#### 2. Excel/CSV Files

**Direct parsing with validation:**
```typescript
async function processExcel(file: Buffer): Promise<ExtractionResult> {
  const workbook = XLSX.read(file);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(worksheet);
  
  // Smart column detection
  const columns = detectColumns(rawData[0]);
  
  // Extract products with GPT-4o for standardization
  return await standardizeWithAI(rawData, columns);
}
```

#### 3. Image Files

**GPT-4o Vision processing:**
```typescript
async function processImage(file: Buffer): Promise<ExtractionResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: PromptTemplates.IMAGE_EXTRACTION },
        { 
          type: "image_url", 
          image_url: { url: `data:image/jpeg;base64,${file.toString('base64')}` }
        }
      ]
    }]
  });
  
  return parseStructuredResponse(response);
}
```

### Quality Assurance

**Processing Metrics:**
- **Completeness Ratio**: Percentage of successfully processed rows
- **Confidence Scoring**: AI confidence in extracted data  
- **Error Detection**: Invalid prices, units, names
- **Manual Review Queue**: Flagged items for admin review

**Validation Pipeline:**
```typescript
interface ProcessingResult {
  success: boolean;
  data: Product[];
  stats: {
    total_rows: number;
    successful_extractions: number;
    completeness_ratio: number;
    avg_confidence: number;
    errors: string[];
  };
}
```

---

## API Design

### RESTful API Structure

```
app/api/
├── upload-unified/          # Unified file processing
├── products/               # Product management
├── suppliers/              # Supplier management
├── bot/                    # Telegram bot integration
│   ├── products/search/    # Product search
│   └── prices/compare/     # Price comparison
└── admin/                  # Admin operations
    ├── products/[id]/      # Product CRUD
    ├── prices/[id]/        # Price CRUD
    ├── aliases/            # Alias management
    └── analytics/          # Analytics endpoints
```

### Unified Upload API

**Endpoint:** `POST /api/upload-unified`

**Features:**
- Handles all file types (PDF, Excel, CSV, Images)
- Auto-detects processing strategy
- Batch processing for large files
- Standardized response format

```typescript
// API Response Format
interface UploadResponse {
  success: boolean;
  upload_id: string;
  processing_stats: {
    total_products: number;
    successful_extractions: number;
    completeness_ratio: number;
    processing_time_ms: number;
  };
  data?: {
    products: Product[];
    supplier_info?: SupplierInfo;
  };
  errors?: string[];
}
```

### Bot API Authentication

```typescript
// Middleware for bot authentication
export function authenticateBot(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('X-Bot-API-Key');
  
  if (!apiKey || apiKey !== process.env.BOT_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null; // Authentication successful
}
```

### Price Comparison API

**Endpoint:** `POST /api/bot/prices/compare`

**Request Format:**
```json
{
  "items": [
    {
      "product_name": "tomato",
      "scanned_price": 20000,
      "unit": "kg",
      "quantity": 1,
      "supplier_id": "optional_supplier_id"
    }
  ]
}
```

**Response Format:**
```json
{
  "comparisons": [
    {
      "product_name": "tomato",
      "scanned_price": 20000,
      "status": "normal", // overpriced, normal, best_price, not_found
      "matched_product": {
        "id": "product_id",
        "name": "Tomato",
        "unit": "kg"
      },
      "price_analysis": {
        "min_price": 15000,
        "max_price": 30000,
        "avg_price": 22500,
        "supplier_count": 4,
        "better_deals": [
          {
            "supplier": "Island Organics",
            "price": 15000,
            "product_name": "Tomato Local",
            "savings": 5000,
            "savings_percent": 25
          }
        ]
      }
    }
  ]
}
```

---

## Performance Optimization

### Database Optimizations

#### 1. Connection Management
**Before (Memory Leak):**
- 81 Prisma instances × 15MB = ~1.2GB memory usage
- Multiple connection pools causing exhaustion

**After (Singleton Pattern):**
- 1 Prisma singleton = ~15MB memory usage  
- Single connection pool with proper pooling
- **~1.185GB memory savings**

```typescript
// lib/prisma.ts - Singleton implementation
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### 2. Query Optimization

**Strategic Includes:**
```typescript
// Optimized product search
const products = await prisma.product.findMany({
  select: { 
    id: true, 
    name: true, 
    standardizedName: true, 
    unit: true 
  },
  include: { 
    prices: { 
      where: { validTo: null }, // Only current prices
      take: 10 // Limit price entries
    } 
  },
  take: 20 // Limit search results
});
```

**Indexed Queries:**
```sql
-- Strategic indexes for performance
CREATE INDEX idx_product_standardized_name ON "Product"("standardizedName");
CREATE INDEX idx_price_product_valid ON "Price"("productId", "validTo");
CREATE INDEX idx_alias_language ON "ProductAlias"("alias", "language");
CREATE INDEX idx_upload_status_created ON "Upload"("status", "createdAt");
```

### AI Cost Management

#### 1. Token Cost Monitoring
```typescript
// services/tokenCostMonitor.ts
export class TokenCostMonitor {
  private costs = new Map<string, number>();
  
  trackUsage(model: string, inputTokens: number, outputTokens: number) {
    const cost = this.calculateCost(model, inputTokens, outputTokens);
    this.costs.set(model, (this.costs.get(model) || 0) + cost);
  }
  
  private calculateCost(model: string, input: number, output: number): number {
    const rates = {
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gemini-2.0-flash': { input: 0, output: 0 }, // Free tier
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
    };
    
    const rate = rates[model];
    return (input * rate.input + output * rate.output) / 1000;
  }
}
```

#### 2. Batch Processing
```typescript
// Process multiple products in single AI call
async function batchStandardization(products: RawProduct[]): Promise<StandardizedProduct[]> {
  const batchSize = 50; // Optimal batch size
  const results = [];
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const standardized = await standardizeBatch(batch);
    results.push(...standardized);
  }
  
  return results;
}
```

### Caching Strategy

```typescript
// Redis-based caching for standardized names
export class StandardizationCache {
  private redis: Redis;
  
  async getCached(productName: string): Promise<string | null> {
    const key = `std:${productName.toLowerCase()}`;
    return await this.redis.get(key);
  }
  
  async setCached(productName: string, standardized: string): Promise<void> {
    const key = `std:${productName.toLowerCase()}`;
    await this.redis.setex(key, 3600, standardized); // 1 hour TTL
  }
}
```

---

## Security Implementation

### Authentication System

#### NextAuth.js Configuration
```typescript
// app/api/auth/[...nextauth]/route.ts
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        
        if (!user) return null;
        
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;
        
        return {
          id: user.id,
          email: user.email,
          role: user.role
        };
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    }
  }
};
```

#### Role-based Access Control
```typescript
// middleware/auth.ts
export function requireRole(allowedRoles: string[]) {
  return async (req: NextRequest) => {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.role || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return null; // Access granted
  };
}

// Usage in API routes
export async function DELETE(req: NextRequest) {
  const authError = requireRole(['admin'])(req);
  if (authError) return authError;
  
  // Admin-only operations here
}
```

### Input Validation

#### Zod Schema Validation
```typescript
// app/lib/validations/admin.ts
export const productUpdateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().optional(),
  unit: z.string().min(1).max(50),
  standardizedName: z.string().min(1).max(200),
  standardizedUnit: z.string().min(1).max(50)
});

export const priceUpdateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("IDR"),
  unit: z.string().min(1),
  validFrom: z.date().optional(),
  validTo: z.date().optional().nullable()
});
```

#### API Validation Middleware
```typescript
export function validateInput<T>(schema: z.ZodSchema<T>) {
  return async (req: NextRequest): Promise<{ data: T; error?: never } | { error: string; data?: never }> => {
    try {
      const body = await req.json();
      const data = schema.parse(body);
      return { data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { error: error.errors.map(e => e.message).join(', ') };
      }
      return { error: 'Invalid input' };
    }
  };
}
```

### File Upload Security

```typescript
// File validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png'
];

export function validateFile(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'File too large' };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'Invalid file type' };
  }
  
  return { success: true };
}
```

### SQL Injection Prevention

Prisma ORM provides built-in protection against SQL injection:

```typescript
// Safe - Prisma automatically parameterizes queries
const products = await prisma.product.findMany({
  where: {
    name: { contains: userInput } // Automatically escaped
  }
});

// Unsafe - Raw SQL should be avoided
// const products = await prisma.$queryRaw`SELECT * FROM Product WHERE name LIKE '%${userInput}%'`;
```

---

**Last Updated:** June 26, 2025  
**Version:** 2.0