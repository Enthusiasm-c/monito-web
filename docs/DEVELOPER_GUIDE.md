# 🚀 DEVELOPER_GUIDE.md - Setup, Development & Deployment

> **CRITICAL**: This is 1 of only 3 core documentation files. Contains ALL development workflow information.

## 📋 Complete Development Workflow

**This file contains ALL development information:**

1. [Quick Setup](#quick-setup) - Get running in 5 minutes
2. [Development Environment](#development-environment) - Local development
3. [Code Quality](#code-quality) - Standards and testing
4. [Deployment](#deployment) - Production deployment
5. [Troubleshooting](#troubleshooting) - Common issues and solutions
6. [API Usage](#api-usage) - How to use the APIs
7. [Database Management](#database-management) - Schema and migrations

---

## Quick Setup

### Prerequisites
- **Node.js** 18+ and npm/yarn
- **PostgreSQL** database (or use Neon cloud)
- **Python** 3.11+ (for Telegram bot)
- **Git** for version control

### 5-Minute Setup
```bash
# 1. Clone and install
git clone <repository-url>
cd monito-web
npm install

# 2. Environment setup
cp .env.example .env
# Edit .env with your API keys (see Environment Variables section)

# 3. Database setup
npx prisma generate
npx prisma db push

# 4. Start development
npm run dev
# App runs at http://localhost:3000

# 5. Run duplication checks (MANDATORY)
chmod +x scripts/check-duplication.sh
./scripts/check-duplication.sh
```

### Environment Variables
```bash
# Required for core functionality
DATABASE_URL="postgresql://user:pass@host/db"
GOOGLE_API_KEY="your-gemini-api-key"
OPENAI_API_KEY="your-openai-api-key"
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"

# Optional for full features
NEXTAUTH_SECRET="your-auth-secret"
NEXTAUTH_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN="your-telegram-token"
WEBHOOK_SECRET="your-webhook-secret"

# Processing configuration
MAX_FILE_SIZE_MB="10"
AI_VISION_MAX_PAGES="8"
COMPLETENESS_THRESHOLD_EXCEL="0.95"
LLM_FALLBACK_ENABLED="true"
MAX_PARALLEL_UPLOADS="3"
ENABLE_PROGRESS_TRACKING="true"
```

---

## Development Environment

### Project Structure
```
monito-web/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (use AsyncHandler!)
│   ├── lib/core/                 # BaseProcessor & core classes
│   ├── services/                 # Business logic (extend BaseProcessor!)
│   │   └── UploadProgressTracker # Real-time progress tracking service
│   ├── utils/                    # Shared utilities
│   └── components/               # React components
├── prisma/                       # Database schema
├── telegram-bot/                 # Python Telegram bot
├── docs/                         # Only 3 core documentation files
└── scripts/                      # Utility scripts
```

### Development Scripts
```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate       # Create migration files
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database with test data

# Code Quality
npm run lint             # ESLint code checking
npm run type-check       # TypeScript type checking
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode

# Duplication Checks (MANDATORY before commit)
./scripts/check-duplication.sh    # Check for code duplication
npm run validate-architecture     # Validate architecture patterns
```

### Development Workflow

#### 1. Before Writing Code (MANDATORY)
```bash
# Always run duplication checks first
./scripts/check-duplication.sh

# Check if your feature exists
grep -r "your-feature-name" app/
grep -r "yourFunction" app/

# Review existing patterns
ls app/lib/core/          # Check BaseProcessor methods
ls app/services/          # Check existing services  
ls app/utils/             # Check existing utilities
```

#### 2. Writing Code (Follow Patterns)
```typescript
// ✅ CORRECT: New API route
import { asyncHandler, ValidationError } from '../../utils/errors';
import { databaseService } from '../../services/DatabaseService';

export const GET = asyncHandler(async (request: NextRequest) => {
  const data = await databaseService.getData();
  return NextResponse.json(data);
});

// ✅ CORRECT: SSE endpoint for real-time updates
export const GET = asyncHandler(async (request: NextRequest) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send progress updates
      const progress = await uploadProgressTracker.getProgress(uploadId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// ✅ CORRECT: New processor
class NewProcessor extends BaseProcessor {
  public static getInstance(): NewProcessor {
    return super.getInstance.call(this) as NewProcessor;
  }
  
  constructor() {
    super('NewProcessor');
  }
  
  async processDocument(content: Buffer, fileName: string): Promise<ProcessingResult> {
    return this.executeWithErrorHandling(async () => {
      // Your logic here
    }, 'processDocument', fileName);
  }
}

// ✅ CORRECT: Unit conversion
import { calculateUnitPrice } from '../../lib/utils/unified-unit-converter';
const unitPrice = calculateUnitPrice(price, quantity, unit);
```

#### 3. Testing Requirements
```bash
# Unit tests for new functions
npm run test -- --testNamePattern="YourFeature"

# Integration tests for API routes
npm run test:api

# End-to-end tests for critical flows
npm run test:e2e

# Manual testing checklist
- [ ] API returns correct data
- [ ] Error handling works properly
- [ ] No console errors
- [ ] Responsive design works
- [ ] Performance is acceptable
```

#### 4. Before Committing (MANDATORY)
```bash
# Run all quality checks
npm run lint                      # Fix linting issues
npm run type-check               # Fix TypeScript errors
npm test                         # All tests must pass
./scripts/check-duplication.sh   # No duplication allowed

# Pre-commit hook automatically runs these checks
git add .
git commit -m "Your message"     # Will fail if checks don't pass
```

---

## Code Quality

### Mandatory Patterns (NO EXCEPTIONS)

#### API Routes
```typescript
// MUST use asyncHandler pattern
export const GET = asyncHandler(async (request: NextRequest) => {
  // MUST use DatabaseService, not direct Prisma
  const data = await databaseService.getData();
  return NextResponse.json(data);
});
```

#### Processors
```typescript
// MUST extend BaseProcessor
class YourProcessor extends BaseProcessor {
  public static getInstance(): YourProcessor {
    return super.getInstance.call(this) as YourProcessor;
  }
}
```

#### Error Handling
```typescript
// MUST use custom error classes
throw new ValidationError('Message');
throw new NotFoundError('Resource', id);
throw new ConflictError('Message');
```

#### Unit Conversion
```typescript
// MUST use unified converter
import { calculateUnitPrice } from '../../lib/utils/unified-unit-converter';
```

### Testing Standards

#### Unit Tests
```typescript
import { YourClass } from '../path';

describe('YourClass', () => {
  it('should handle standard case', () => {
    // Test implementation
  });
  
  it('should handle edge cases', () => {
    // Test edge cases
  });
  
  it('should handle errors properly', () => {
    // Test error scenarios
  });
});
```

#### API Tests
```typescript
import { GET } from '../app/api/your-route/route';

describe('/api/your-route', () => {
  it('should return data successfully', async () => {
    const request = new Request('http://localhost/api/your-route');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

---

## Deployment

### Vercel Deployment (Recommended)

#### Setup
```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel --prod

# Environment variables (add in Vercel dashboard)
DATABASE_URL=your-production-db
GOOGLE_API_KEY=your-api-key
# ... other required env vars
```

#### Deployment Checklist
- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Build succeeds locally (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] No duplication detected
- [ ] Performance acceptable

#### Production Settings
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    domains: ['your-blob-domain.com'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'your-domain.com' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### Manual Deployment

#### Server Requirements
- **Node.js** 18+
- **PostgreSQL** 12+
- **SSL certificate** for HTTPS
- **Reverse proxy** (nginx recommended)

#### Deployment Steps
```bash
# 1. Clone and build
git clone <repo>
cd monito-web
npm ci --production
npm run build

# 2. Environment setup
cp .env.example .env.production
# Configure production environment variables

# 3. Database setup
DATABASE_URL=production-url npx prisma generate
DATABASE_URL=production-url npx prisma db push

# 4. Start production server
npm start
```

#### nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## API Usage

### Authentication
```javascript
// Currently using API key authentication
const headers = {
  'Authorization': `Bearer ${process.env.API_KEY}`,
  'Content-Type': 'application/json'
};
```

### Core Endpoints

#### Upload File
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('supplierId', 'supplier-id');

const response = await fetch('/api/upload-unified', {
  method: 'POST',
  body: formData
});

// Monitor progress via SSE
const eventSource = new EventSource(`/api/admin/uploads/status/${uploadId}/stream`);
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  console.log(`Upload progress: ${progress.progress}%`);
};
```

#### Search Products
```javascript
const params = new URLSearchParams({
  search: 'chicken',
  category: 'Meat',
  page: '1',
  limit: '50'
});

const response = await fetch(`/api/products?${params}`);
const data = await response.json();
```

#### Get Price Comparison
```javascript
const response = await fetch('/api/bot/prices/compare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    products: ['product1', 'product2']
  })
});
```

### Error Handling
```javascript
try {
  const response = await fetch('/api/endpoint');
  
  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.error.message);
    return;
  }
  
  const data = await response.json();
  // Handle success
} catch (error) {
  console.error('Network Error:', error);
}
```

---

## Database Management

### Schema Changes
```bash
# 1. Modify schema in prisma/schema.prisma
# 2. Generate migration
npx prisma migrate dev --name describe-your-change

# 3. Deploy to production
npx prisma migrate deploy
```

### Common Operations
```bash
# View database
npx prisma studio

# Reset database (DEV ONLY)
npx prisma migrate reset

# Seed database
npx prisma db seed

# Generate types
npx prisma generate

# Update schema for processingDetails change
# Note: processingDetails field changed from String? to Json?
npx prisma migrate dev --name update-processing-details-to-json
```

### Database Performance
```sql
-- Common indexes (already implemented)
CREATE INDEX idx_prices_supplier_valid ON prices(supplier_id, valid_to);
CREATE INDEX idx_prices_product_valid ON prices(product_id, valid_to);
CREATE INDEX idx_products_standardized ON products(standardized_name, standardized_unit);

-- Performance monitoring
EXPLAIN ANALYZE SELECT * FROM prices WHERE supplier_id = $1 AND valid_to IS NULL;
```

---

## Troubleshooting

### Running `ts-node` Scripts with Application Imports

Some scripts may need to import modules from the main application (`app/`). However, the default `ts-node` configuration in this project does not resolve the `@/` path alias correctly, which can lead to `Error: Cannot find module` errors.

**The Problem:**
The `tsconfig.node.json` is configured to run files in the `scripts/` directory but does not have the necessary setup to handle the path aliases used by the main application.

**The Solution:**
To fix this, you need to install `tsconfig-paths` and update the `npm` scripts to use it. This allows `ts-node` to correctly resolve the aliased paths.

**Step 1: Install `tsconfig-paths`**
```bash
npm install tsconfig-paths
```

**Step 2: Update `package.json`**
Modify the `scripts` in your `package.json` to prepend `-r tsconfig-paths/register` to any command that uses `ts-node`.

*Example:*

**Before:**
```json
"validate:data": "ts-node --project tsconfig.node.json scripts/validate-data-quality.ts",
```

**After:**
```json
"validate:data": "ts-node -r tsconfig-paths/register --project tsconfig.node.json scripts/validate-data-quality.ts",
```
This ensures that any script requiring application modules can now resolve the paths correctly.

### Common Issues

#### 1. Build Failures
```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run type-check
```

#### 2. Database Connection Issues
```bash
# Test connection
npx prisma db pull

# Check environment variables
echo $DATABASE_URL

# Reset connection
npx prisma generate
npx prisma db push
```

#### 3. API Errors
```bash
# Check logs
npm run dev
# Look for error messages in console

# Test API directly
curl -X GET http://localhost:3000/api/products

# Test SSE endpoint
curl -N http://localhost:3000/api/admin/uploads/status/[uploadId]/stream

# Test SSE endpoints with curl
curl -N -H "Accept: text/event-stream" http://localhost:3000/api/admin/uploads/status/[uploadId]/stream

# Check environment variables
echo $GOOGLE_API_KEY
echo $OPENAI_API_KEY

# OpenAI API errors (max_tokens deprecated)
# Fix: max_tokens changed to max_completion_tokens for o3-mini
```

#### 4. Duplication Check Failures
```bash
# Find problematic code
grep -r "static getInstance" app/services/
grep -r "try {" app/api/
grep -r "prisma\." app/api/

# Fix using mandatory patterns (see REFACTORING_GUIDE.md)
```

#### 5. Performance Issues
```bash
# Database query analysis
npx prisma studio
# Check slow queries

# Bundle analysis
npm run build
npm run analyze

# Memory usage
node --inspect app/api/your-route/route.ts
```

### Getting Help

#### Error Resolution Priority
1. Check this troubleshooting section
2. Review REFACTORING_GUIDE.md for pattern violations
3. Check ARCHITECTURE.md for system understanding
4. Search existing issues in repository
5. Create new issue with detailed information

#### Debug Information to Include
- Node.js version (`node --version`)
- npm version (`npm --version`)
- Error messages (full stack trace)
- Environment (development/production)
- Steps to reproduce
- Expected vs actual behavior

---

## Performance Guidelines

### Frontend Performance
- Use Next.js Image component for images
- Implement pagination for large lists
- Use React.memo for expensive components
- Optimize bundle size with tree shaking

### Backend Performance  
- Use DatabaseService for optimized queries
- Implement proper database indexes
- Use connection pooling (built into Prisma)
- Cache frequently accessed data

### AI Processing Performance
- Use batch processing for large files
- Implement request queuing for high load
- Monitor token usage and costs
- Use appropriate model for task complexity
- Enable parallel processing (up to 3 concurrent uploads)
- Track progress with UploadProgressTracker service
- Use max_completion_tokens for o3-mini API calls
- Track progress with UploadProgressTracker service
- Use max_completion_tokens for o3-mini API calls

---

This guide contains ALL development information for Monito Web. Follow the mandatory patterns to maintain code quality and prevent duplication.