# 👨‍💻 Developer Guide - Getting Started with Monito Web

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Development Workflow](#development-workflow)
4. [Code Structure & Conventions](#code-structure--conventions)
5. [Common Tasks](#common-tasks)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- **Node.js** 18.17+ (LTS recommended)
- **Python** 3.11+ (for Telegram bot)
- **PostgreSQL** 14+ (or use cloud Neon DB)
- **Git** 2.0+
- **pnpm** or npm (pnpm recommended for faster installs)

### Recommended Tools
- **VS Code** with extensions:
  - Prisma
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - GitLens
- **TablePlus** or **DBeaver** for database management
- **Postman** or **Insomnia** for API testing
- **Docker Desktop** (optional, for containerized development)

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/monito-web.git
cd monito-web
```

### 2. Install Dependencies

#### Main Application
```bash
# Install Node dependencies
pnpm install  # or npm install

# Generate Prisma client
npx prisma generate

# Setup database (if using local PostgreSQL)
createdb monito_db

# Run migrations
npx prisma migrate dev

# Seed test data (optional)
node prisma/seed-simple.js
```

#### Telegram Bot
```bash
cd telegram-bot
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Configuration

#### Main App (.env)
```env
# Database (use Neon for cloud DB)
DATABASE_URL="postgresql://user:pass@localhost:5432/monito_db"

# OpenAI
OPENAI_API_KEY="sk-..."  # Get from OpenAI dashboard

# File Storage
BLOB_READ_WRITE_TOKEN="..."  # Get from Vercel dashboard

# Bot API
BOT_API_KEY="generate-random-key-here"  # openssl rand -hex 32

# Optional
NEXTAUTH_SECRET="..."  # For future auth implementation
NEXTAUTH_URL="http://localhost:3000"
```

#### Telegram Bot (.env)
```env
# Bot credentials
BOT_TOKEN="..."  # Get from @BotFather on Telegram

# API connection
MONITO_API_URL="http://localhost:3000/api/bot"
BOT_API_KEY="same-as-main-app"

# OpenAI (for OCR)
OPENAI_API_KEY="same-as-main-app"
OPENAI_MODEL="gpt-4o-mini"

# Settings
BOT_LANGUAGE="en"
LOG_LEVEL="INFO"
```

### 4. Verify Setup
```bash
# Check main app
npm run dev
# Visit http://localhost:3000

# Check database
npx prisma studio
# Opens at http://localhost:5555

# Test API
curl http://localhost:3000/api/stats
```

## Development Workflow

### 1. Branch Strategy
```bash
# Create feature branch
git checkout -b feature/add-price-alerts

# Create bugfix branch
git checkout -b bugfix/fix-excel-parsing

# Create hotfix from main
git checkout main
git checkout -b hotfix/security-patch
```

### 2. Making Changes

#### Adding a New API Endpoint
```typescript
// 1. Create route file: app/api/products/trending/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Implementation
    const trending = await prisma.product.findMany({
      // Query logic
    });
    
    return NextResponse.json({ products: trending });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch trending products' },
      { status: 500 }
    );
  }
}
```

#### Adding a New Page
```typescript
// app/(dashboard)/products/trending/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trending Products | Monito Web',
};

export default async function TrendingPage() {
  const products = await fetch('/api/products/trending');
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Trending Products</h1>
      {/* Component implementation */}
    </div>
  );
}
```

#### Adding Database Models
```prisma
// prisma/schema.prisma
model PriceAlert {
  id        String   @id @default(cuid())
  userId    String
  productId String
  threshold Decimal
  type      String   // "above" | "below"
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  
  product Product @relation(fields: [productId], references: [id])
  
  @@index([userId, active])
  @@map("price_alerts")
}
```

```bash
# Create migration
npx prisma migrate dev --name add-price-alerts

# Update TypeScript types
npx prisma generate
```

### 3. Code Quality

#### Run Linters
```bash
# ESLint
npm run lint

# Fix automatically
npm run lint:fix

# Type checking
npm run type-check
```

#### Pre-commit Checks
```json
// package.json
"scripts": {
  "pre-commit": "lint-staged",
  "prepare": "husky install"
}

// .lintstagedrc.json
{
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

## Code Structure & Conventions

### 1. File Organization
```
monito-web/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Auth group (login, register)
│   ├── (dashboard)/       # Main app group
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── products/         # Product-related components
│   └── shared/           # Shared components
├── lib/                   # Core business logic
│   ├── processors/       # File processors
│   ├── ai/              # AI integrations
│   ├── utils/           # Utilities
│   └── prisma.ts        # Database client
├── prisma/               # Database schema & migrations
├── public/               # Static assets
└── tests/                # Test files
```

### 2. Naming Conventions

#### Files
```typescript
// Components: PascalCase
ProductCard.tsx
PriceComparisonTable.tsx

// Utilities: camelCase
formatCurrency.ts
parseIndonesianNumber.ts

// Constants: UPPER_SNAKE_CASE
API_ENDPOINTS.ts
ERROR_MESSAGES.ts

// Types: PascalCase with .types.ts
Product.types.ts
ApiResponse.types.ts
```

#### Code
```typescript
// Interfaces: PascalCase with 'I' prefix (optional)
interface IProductService {
  findById(id: string): Promise<Product>;
}

// Types: PascalCase
type ProductWithPrices = Product & {
  prices: Price[];
};

// Enums: PascalCase
enum UploadStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed'
}

// Functions: camelCase
function calculatePriceRange(prices: Price[]): PriceRange {
  // Implementation
}

// React components: PascalCase
export function ProductCard({ product }: Props) {
  return <div>...</div>;
}

// Hooks: camelCase with 'use' prefix
function useProductSearch(query: string) {
  // Implementation
}
```

### 3. TypeScript Best Practices

#### Avoid 'any'
```typescript
// ❌ Bad
function processData(data: any) {
  return data.map((item: any) => item.name);
}

// ✅ Good
function processData<T extends { name: string }>(data: T[]) {
  return data.map(item => item.name);
}
```

#### Use Type Guards
```typescript
// Type guard function
function isProduct(item: unknown): item is Product {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'name' in item
  );
}

// Usage
if (isProduct(data)) {
  console.log(data.name); // TypeScript knows this is safe
}
```

#### Prefer Interfaces for Objects
```typescript
// ✅ Interfaces for object shapes
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

// ✅ Types for unions, intersections, primitives
type Status = 'pending' | 'active' | 'inactive';
type ID = string | number;
```

### 4. React/Next.js Patterns

#### Server Components (Default)
```typescript
// app/products/page.tsx
export default async function ProductsPage() {
  // Fetch data on server
  const products = await prisma.product.findMany();
  
  return <ProductList products={products} />;
}
```

#### Client Components (When Needed)
```typescript
// components/SearchBar.tsx
'use client';

import { useState } from 'react';

export function SearchBar() {
  const [query, setQuery] = useState('');
  // Interactive component logic
}
```

#### Data Fetching Patterns
```typescript
// Parallel fetching
export default async function DashboardPage() {
  // Fetch in parallel
  const [products, suppliers, stats] = await Promise.all([
    getProducts(),
    getSuppliers(),
    getStats()
  ]);
  
  return <Dashboard {...{ products, suppliers, stats }} />;
}

// With error handling
async function getProductsWithFallback() {
  try {
    return await prisma.product.findMany();
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return [];
  }
}
```

## Common Tasks

### 1. Adding a New File Processor

```typescript
// lib/processors/JsonProcessor.ts
import { BaseProcessor, ProcessorResult } from './types';

export class JsonProcessor extends BaseProcessor {
  async canProcess(file: File): Promise<boolean> {
    return file.type === 'application/json';
  }
  
  async process(file: File): Promise<ProcessorResult> {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Extract products
    const products = this.extractProducts(data);
    
    return {
      success: true,
      products,
      confidence: 0.95,
      metadata: {
        processor: 'json',
        fileType: file.type
      }
    };
  }
  
  private extractProducts(data: any): ExtractedProduct[] {
    // Implementation
  }
}

// Register processor
// lib/processors/index.ts
export const processors = [
  new ExcelProcessor(),
  new PDFProcessor(),
  new JsonProcessor(), // Add here
];
```

### 2. Adding API Authentication

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey || !isValidApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

### 3. Implementing Search

```typescript
// lib/search/productSearch.ts
export async function searchProducts(
  query: string,
  options: SearchOptions = {}
) {
  const {
    limit = 10,
    fuzzy = true,
    categories = []
  } = options;
  
  // Basic search
  const basicResults = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { standardizedName: { contains: query, mode: 'insensitive' } },
      ],
      ...(categories.length > 0 && {
        category: { in: categories }
      })
    },
    take: limit
  });
  
  // Fuzzy search if enabled and few results
  if (fuzzy && basicResults.length < limit / 2) {
    const fuzzyResults = await fuzzySearch(query, {
      exclude: basicResults.map(p => p.id)
    });
    
    return [...basicResults, ...fuzzyResults].slice(0, limit);
  }
  
  return basicResults;
}
```

### 4. Background Jobs

```typescript
// lib/jobs/priceUpdateJob.ts
import { Queue } from 'bull';
import { prisma } from '@/lib/prisma';

const priceQueue = new Queue('price-updates', {
  redis: process.env.REDIS_URL
});

// Define job processor
priceQueue.process(async (job) => {
  const { supplierId, products } = job.data;
  
  for (const product of products) {
    await updateProductPrice(product, supplierId);
    
    // Report progress
    await job.progress(
      (products.indexOf(product) / products.length) * 100
    );
  }
  
  return { processed: products.length };
});

// Schedule job
export async function schedulePriceUpdate(data: any) {
  const job = await priceQueue.add(data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
  
  return job.id;
}
```

## Testing

### 1. Unit Tests

```typescript
// __tests__/lib/processors/ExcelProcessor.test.ts
import { ExcelProcessor } from '@/lib/processors/ExcelProcessor';

describe('ExcelProcessor', () => {
  let processor: ExcelProcessor;
  
  beforeEach(() => {
    processor = new ExcelProcessor();
  });
  
  it('should detect Excel files', async () => {
    const file = new File([''], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    expect(await processor.canProcess(file)).toBe(true);
  });
  
  it('should extract products from valid Excel', async () => {
    const file = await loadTestFile('valid-price-list.xlsx');
    const result = await processor.process(file);
    
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(10);
    expect(result.products[0]).toMatchObject({
      name: expect.any(String),
      price: expect.any(Number),
      unit: expect.any(String)
    });
  });
});
```

### 2. Integration Tests

```typescript
// __tests__/api/products.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '@/app/api/products/route';

describe('/api/products', () => {
  it('should return products', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: {
        search: 'beras',
        limit: '10'
      },
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.products).toBeInstanceOf(Array);
  });
});
```

### 3. E2E Tests

```typescript
// e2e/upload-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete upload flow', async ({ page }) => {
  await page.goto('/upload');
  
  // Upload file
  await page.setInputFiles('input[type="file"]', 'test-files/prices.xlsx');
  
  // Select supplier
  await page.selectOption('select[name="supplier"]', 'supplier-1');
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Wait for processing
  await expect(page.locator('[data-status="completed"]')).toBeVisible({
    timeout: 30000
  });
  
  // Verify results
  await expect(page.locator('.upload-summary')).toContainText('10 products imported');
});
```

### 4. Running Tests

```bash
# Unit tests
npm test

# With coverage
npm run test:coverage

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

## Deployment

### 1. Pre-deployment Checklist

```bash
# 1. Run all tests
npm run test:all

# 2. Build check
npm run build

# 3. Type check
npm run type-check

# 4. Database migrations
npx prisma migrate deploy

# 5. Environment variables
# Ensure all required vars are set in production
```

### 2. Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

### 3. Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t monito-web .
docker run -p 3000:3000 --env-file .env.production monito-web
```

### 4. Database Migrations in Production

```bash
# Safe migration process
# 1. Backup database
pg_dump $DATABASE_URL > backup.sql

# 2. Run migration
npx prisma migrate deploy

# 3. Verify
npx prisma db pull
npx prisma generate
```

## Troubleshooting

### Common Issues

#### 1. "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma client
npx prisma generate
```

#### 2. Database connection issues
```bash
# Test connection
npx prisma db pull

# Check connection string format
# Should be: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

#### 3. TypeScript errors after schema changes
```bash
# Regenerate types
npx prisma generate

# Restart TypeScript server in VS Code
Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

#### 4. Build failures
```bash
# Clean build cache
rm -rf .next

# Check for circular dependencies
npx madge --circular --extensions ts,tsx .

# Analyze bundle size
npm run analyze
```

### Debug Mode

```typescript
// Enable debug logging
// .env.local
DEBUG=true
LOG_LEVEL=debug

// In code
if (process.env.DEBUG) {
  console.log('Debug info:', data);
}
```

### Performance Profiling

```typescript
// API route timing
export async function GET(request: Request) {
  const start = performance.now();
  
  try {
    const result = await expensiveOperation();
    return NextResponse.json(result);
  } finally {
    const duration = performance.now() - start;
    console.log(`API call took ${duration}ms`);
  }
}
```

### Memory Profiling

```bash
# Run with memory profiling
node --inspect npm run dev

# Open Chrome DevTools
chrome://inspect

# Take heap snapshots and analyze
```

## Additional Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Internal Docs
- [API Documentation](./API_DOCUMENTATION.md)
- [Architecture Overview](./01_ARCHITECTURE.md)
- [Bug History](./02_BUGS_AND_SOLUTIONS.md)

### Tools
- [Prisma Studio](https://www.prisma.io/studio) - Database GUI
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools) (if using Redux)

### Communities
- Internal Slack: #monito-web-dev
- Stack Overflow: [nextjs], [prisma], [typescript]
- GitHub Issues: Report bugs and request features

## Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npx prisma studio       # Open database GUI
npx prisma migrate dev  # Create migration
npx prisma db push      # Push schema changes (dev only)
npx prisma generate     # Generate client

# Testing
npm test                # Run unit tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix lint issues
npm run type-check      # TypeScript check
npm run format          # Format with Prettier

# Telegram Bot
cd telegram-bot
source venv/bin/activate
python -m app.bot       # Start bot

# Utilities
npm run analyze         # Bundle analysis
npm run clean           # Clean build artifacts
```

Remember: When in doubt, check the existing code for patterns and conventions. The codebase is your best documentation!