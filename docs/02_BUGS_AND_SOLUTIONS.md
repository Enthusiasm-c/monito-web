# 🐛 Bugs, Challenges, and Solutions

This document details the major technical challenges encountered during development and their solutions. This is crucial for new team members to understand the evolution of the codebase and avoid repeating past mistakes.

## Table of Contents
1. [File Processing Challenges](#file-processing-challenges)
2. [AI Integration Issues](#ai-integration-issues)
3. [Database & Performance](#database--performance)
4. [Telegram Bot Integration](#telegram-bot-integration)
5. [Frontend Challenges](#frontend-challenges)
6. [Deployment Issues](#deployment-issues)

## File Processing Challenges

### 1. Excel File Structure Detection
**Problem**: Excel files from different suppliers had wildly varying structures - some had headers in row 5, others in row 1, some had multiple sheets, merged cells, or decorative formatting.

**Initial Approach**: 
```typescript
// Naive approach - assumed headers in row 1
const headers = worksheet.getRow(1).values;
```

**Issues**:
- Failed on 60% of real supplier files
- Couldn't handle merged cells
- Missed multi-sheet workbooks
- Broke on files with company logos/headers

**Solution**:
```typescript
async analyzeExcelStructure(worksheet: ExcelJS.Worksheet): Promise<ExcelStructure> {
  // Smart header detection
  const headerRow = await this.findHeaderRow(worksheet);
  
  // Analyze up to 10 rows to find the most likely header
  for (let i = 1; i <= Math.min(10, worksheet.rowCount); i++) {
    const row = worksheet.getRow(i);
    const score = this.calculateHeaderScore(row);
    if (score > threshold) {
      return { headerRow: i, columns: this.detectColumns(row) };
    }
  }
}

calculateHeaderScore(row: Row): number {
  // Score based on:
  // - Number of non-empty cells
  // - Presence of keywords (harga, price, produk, etc.)
  // - Cell formatting (bold, borders)
  // - Data type consistency in columns below
}
```

**Key Learnings**:
- Never assume file structure
- Use heuristics and scoring systems
- Validate against real-world data
- Keep supplier-specific overrides

### 2. PDF Table Extraction
**Problem**: PDFs are notoriously difficult for table extraction. Indonesian suppliers often use scanned documents or complex layouts.

**Evolution of Solutions**:

**v1 - pdf-parse library**:
```typescript
// First attempt - text extraction only
const data = await pdfParse(buffer);
const lines = data.text.split('\n');
// Result: Jumbled text, lost table structure
```

**v2 - Tabula integration**:
```typescript
// Better but required Java, slow
const tables = await tabula.extractTables(pdfPath);
// Result: 70% accuracy, failed on scanned PDFs
```

**v3 - AI-powered extraction** (Current):
```typescript
// Convert to images and use GPT-4 Vision
const images = await this.convertPDFToImages(buffer);
const extractedData = await this.openaiVision.extract(images, {
  prompt: PDF_EXTRACTION_PROMPT,
  expectedFormat: 'price_list'
});
// Result: 95% accuracy, handles any format
```

**Insights**:
- Traditional PDF libraries fail on real-world documents
- Image-based approach more reliable
- AI can understand context humans use
- Cost vs accuracy tradeoff is worth it

### 3. Indonesian Number Format Issues
**Problem**: Indonesian format uses dots as thousand separators (1.000.000 = 1 million), opposite of Western format.

**Bugs Encountered**:
```typescript
// Bug: "15.000" parsed as 15 instead of 15000
const price = parseFloat("15.000"); // Wrong!

// Bug: "1.500.000,50" not handled
const price = parseFloat("1.500.000,50".replace(",", ".")); // Still wrong!
```

**Solution**:
```typescript
export function parseIndonesianNumber(text: string): number {
  if (!text) return 0;
  
  // Remove currency symbols and spaces
  let cleaned = text.replace(/Rp\.?|IDR|idr|\s/gi, '').trim();
  
  // Handle Indonesian format
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Both separators: 1.500.000,50
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.match(/\.\d{3}(\.|$)/)) {
    // Dots as thousands: 1.500
    cleaned = cleaned.replace(/\./g, '');
  } else if (cleaned.includes(',')) {
    // Comma as decimal: 1500,50
    cleaned = cleaned.replace(',', '.');
  }
  
  return parseFloat(cleaned) || 0;
}
```

### 4. Memory Issues with Large Files
**Problem**: Processing 50MB+ Excel files caused Node.js to run out of memory.

**Failed Approach**:
```typescript
// Loading entire file into memory
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buffer); // 💥 OOM on large files
```

**Solution - Streaming**:
```typescript
// Stream processing for large files
const stream = new ExcelJS.stream.xlsx.WorkbookReader(bufferStream);
stream.on('worksheet', worksheet => {
  worksheet.on('row', row => {
    // Process row immediately
    this.processRow(row);
  });
});
```

**Additional Optimizations**:
- Implement file size limits
- Process in chunks
- Use worker threads for parallel processing
- Clear processed data from memory

## AI Integration Issues

### 1. Token Limit Exceeded
**Problem**: GPT-4 has token limits. Large files would fail processing.

**Initial Issue**:
```typescript
// Sending entire file content
const result = await openai.complete({
  prompt: `Extract products from: ${entireFileContent}` // 💥 Token limit
});
```

**Solution - Intelligent Chunking**:
```typescript
const chunks = this.smartChunk(content, {
  maxTokens: 3000,
  overlap: 200, // Prevent cutting products in half
  breakpoints: ['\n', '. ', ', '] // Natural break points
});

const results = await Promise.all(
  chunks.map(chunk => this.processChunk(chunk))
);

return this.mergeResults(results);
```

### 2. Inconsistent AI Responses
**Problem**: Same prompt would return different formats.

**Solution - Function Calling**:
```typescript
const functions = [{
  name: 'extract_products',
  parameters: {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'price', 'unit'],
          properties: {
            name: { type: 'string' },
            price: { type: 'number' },
            unit: { type: 'string' }
          }
        }
      }
    }
  }
}];

// Forces structured output
const response = await openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages: [{ role: 'user', content: prompt }],
  functions,
  function_call: { name: 'extract_products' }
});
```

### 3. Cost Optimization
**Problem**: Processing every file with GPT-4 was expensive ($0.30-0.50 per file).

**Solution - Tiered Approach**:
```typescript
async processFile(file: UploadedFile) {
  // Try cheap methods first
  const processors = [
    { processor: this.excelProcessor, cost: 0 },
    { processor: this.csvProcessor, cost: 0 },
    { processor: this.pdfProcessor, cost: 0.01 },
    { processor: this.gpt35Processor, cost: 0.05 },
    { processor: this.gpt4Processor, cost: 0.50 }
  ];
  
  for (const { processor, cost } of processors) {
    try {
      const result = await processor.process(file);
      if (result.confidence > 0.8) {
        await this.recordCost(cost);
        return result;
      }
    } catch (e) {
      continue; // Try next processor
    }
  }
}
```

## Database & Performance

### 1. Product Matching Performance
**Problem**: Finding existing products for price updates was O(n²) - checking every new product against every existing product.

**Slow Query**:
```sql
-- Original: 30+ seconds for 1000 products
SELECT * FROM products WHERE 
  LOWER(name) LIKE '%' || LOWER($1) || '%' OR
  LOWER(standardized_name) LIKE '%' || LOWER($1) || '%'
```

**Solution - Indexing and Exact Matching**:
```prisma
model Product {
  @@index([standardizedName, standardizedUnit])
  @@unique([standardizedName, standardizedUnit])
}
```

```typescript
// Fast lookup by standardized name
const existing = await prisma.product.findUnique({
  where: {
    standardizedName_standardizedUnit: {
      standardizedName: standardized.name,
      standardizedUnit: standardized.unit
    }
  }
});
```

### 2. Price History Explosion
**Problem**: Keeping all historical prices made queries slow.

**Solution - Soft Deletes with Archival**:
```typescript
// Mark old prices as invalid instead of keeping forever
await prisma.price.updateMany({
  where: {
    productId: product.id,
    supplierId: supplier.id,
    validTo: null
  },
  data: {
    validTo: new Date()
  }
});

// Periodic archival job
async function archiveOldPrices() {
  const threshold = new Date();
  threshold.setMonths(threshold.getMonth() - 3);
  
  await prisma.priceArchive.createMany({
    data: await prisma.price.findMany({
      where: { validTo: { lt: threshold } }
    })
  });
  
  await prisma.price.deleteMany({
    where: { validTo: { lt: threshold } }
  });
}
```

### 3. N+1 Query Problem
**Problem**: Loading products with prices and suppliers caused hundreds of queries.

**Before**:
```typescript
const products = await prisma.product.findMany();
for (const product of products) {
  const prices = await prisma.price.findMany({
    where: { productId: product.id }
  });
  // N+1 queries!
}
```

**After - Eager Loading**:
```typescript
const products = await prisma.product.findMany({
  include: {
    prices: {
      include: {
        supplier: true
      },
      where: {
        validTo: null
      },
      orderBy: {
        amount: 'asc'
      }
    }
  }
});
```

## Telegram Bot Integration

### 1. Database Connection vs API
**Problem**: Direct database connection from bot created coupling and deployment issues.

**Initial Approach**:
```python
# Bot directly connected to database
import psycopg2
conn = psycopg2.connect(DATABASE_URL)
```

**Issues**:
- Database credentials in multiple places
- Schema changes broke bot
- No rate limiting
- Security concerns

**Solution - API Gateway**:
```python
# Bot uses API with authentication
class DatabaseAPI:
    def __init__(self):
        self.base_url = settings.monito_api_url
        self.headers = {'X-Bot-API-Key': settings.bot_api_key}
    
    async def search_products(self, query: str):
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/products/search",
                params={'q': query},
                headers=self.headers
            ) as response:
                return await response.json()
```

### 2. OCR Response Time
**Problem**: Invoice OCR took 10-30 seconds, Telegram has 5-second webhook timeout.

**Solution - Async Processing**:
```python
@router.message(F.photo)
async def handle_invoice(message: types.Message):
    # Immediate response
    processing_msg = await message.answer("Processing invoice...")
    
    # Process in background
    asyncio.create_task(
        process_invoice_async(message, processing_msg)
    )

async def process_invoice_async(message, status_msg):
    try:
        result = await ocr_pipeline.process(photo)
        await status_msg.edit_text(format_result(result))
    except Exception as e:
        await status_msg.edit_text(f"Error: {e}")
```

### 3. Multi-language Number Formats
**Problem**: Bot used by Indonesian users but needed to handle both Western and Indonesian number formats.

**Solution - Smart Detection**:
```python
def parse_number(text: str) -> float:
    # Count dots and commas
    dots = text.count('.')
    commas = text.count(',')
    
    if dots > 1:  # Multiple dots = thousand separator
        return float(text.replace('.', ''))
    elif commas == 1 and dots == 1:
        # Determine which is decimal
        if text.index('.') < text.index(','):
            # European: 1.000,50
            return float(text.replace('.', '').replace(',', '.'))
        else:
            # US: 1,000.50
            return float(text.replace(',', ''))
    # ... more cases
```

## Frontend Challenges

### 1. Real-time Upload Progress
**Problem**: Large file uploads showed no progress, users would refresh and re-upload.

**Solution - Server-Sent Events**:
```typescript
// Frontend
const eventSource = new EventSource(`/api/upload/progress/${uploadId}`);
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  updateProgressBar(progress);
};

// Backend
export async function GET(req: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        const progress = await getUploadProgress(uploadId);
        controller.enqueue(`data: ${JSON.stringify(progress)}\n\n`);
        
        if (progress.status === 'completed') {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
```

### 2. Table Virtualization
**Problem**: Displaying 10,000+ products made the page unresponsive.

**Solution - Virtual Scrolling**:
```typescript
// Instead of rendering all rows
<VirtualTable
  data={products}
  rowHeight={60}
  visibleRows={20}
  renderRow={(product) => <ProductRow product={product} />}
/>

// Virtual table only renders visible rows
function VirtualTable({ data, rowHeight, visibleRows }) {
  const [scrollTop, setScrollTop] = useState(0);
  const startIndex = Math.floor(scrollTop / rowHeight);
  const endIndex = startIndex + visibleRows;
  const visibleData = data.slice(startIndex, endIndex);
  
  return (
    <div onScroll={(e) => setScrollTop(e.target.scrollTop)}>
      <div style={{ height: data.length * rowHeight }}>
        {visibleData.map((item, i) => (
          <div 
            key={startIndex + i}
            style={{ 
              position: 'absolute',
              top: (startIndex + i) * rowHeight 
            }}
          >
            {renderRow(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Search Performance
**Problem**: Searching products was slow and caused UI freezes.

**Solution - Debouncing and Web Workers**:
```typescript
// Debounced search
const debouncedSearch = useMemo(
  () => debounce(async (query: string) => {
    const results = await searchProducts(query);
    setSearchResults(results);
  }, 300),
  []
);

// Fuzzy search in web worker for large datasets
// search.worker.ts
self.onmessage = (e) => {
  const { products, query } = e.data;
  const fuse = new Fuse(products, {
    keys: ['name', 'standardizedName'],
    threshold: 0.3
  });
  const results = fuse.search(query);
  self.postMessage(results);
};
```

## Deployment Issues

### 1. Environment Variable Management
**Problem**: Different environments needed different configs, secrets were accidentally committed.

**Solution - Structured Config**:
```typescript
// config/index.ts
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    debug: true
  },
  production: {
    apiUrl: process.env.API_URL,
    debug: false
  }
};

// Validate required vars on startup
const required = ['DATABASE_URL', 'OPENAI_API_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

### 2. Database Migration Failures
**Problem**: Prisma migrations failed on production due to connection limits.

**Solution**:
```json
// package.json
"scripts": {
  "migrate:deploy": "prisma migrate deploy",
  "migrate:dev": "prisma migrate dev",
  "postinstall": "prisma generate && prisma migrate deploy"
}
```

```typescript
// Separate migration connection
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Specific connection limit for migrations
  connection_limit = 2
}
```

### 3. Memory Leaks in Production
**Problem**: Node.js process memory grew continuously.

**Found Issues**:
1. Event listeners not cleaned up
2. Large objects kept in closure scope
3. Circular references in price data

**Solutions**:
```typescript
// Cleanup event listeners
useEffect(() => {
  const handler = (e) => handleEvent(e);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// Clear references
class FileProcessor {
  private data: any;
  
  async process() {
    try {
      this.data = await loadData();
      // Process...
    } finally {
      this.data = null; // Clear reference
    }
  }
}

// Break circular references
const price = {
  ...priceData,
  product: { id: product.id }, // Only ID, not full object
  supplier: { id: supplier.id }
};
```

## Key Learnings

### 1. **Always validate with real data**
- Test with actual supplier files
- Build for edge cases first
- Keep examples of problematic files

### 2. **Plan for scale from day 1**
- Database indexes matter
- Pagination everywhere
- Async processing for heavy tasks

### 3. **AI is powerful but needs constraints**
- Structured prompts
- Output validation
- Cost monitoring
- Fallback strategies

### 4. **Monitoring is crucial**
- Log everything
- Track performance metrics
- Monitor costs
- Alert on anomalies

### 5. **User experience over perfection**
- Fast feedback > perfect accuracy
- Progress indicators for long tasks
- Graceful error handling
- Clear error messages

## Debugging Tips

### 1. File Processing Issues
```bash
# Check processing logs
tail -f processing.log | grep ERROR

# Test specific file
npm run test:processor -- --file=problem.xlsx

# Enable debug mode
DEBUG=processor:* npm run dev
```

### 2. AI Response Issues
```typescript
// Log full AI responses
if (process.env.DEBUG_AI) {
  console.log('AI Request:', prompt);
  console.log('AI Response:', JSON.stringify(response, null, 2));
}
```

### 3. Database Performance
```sql
-- Check slow queries
SELECT query, calls, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Analyze query plan
EXPLAIN ANALYZE 
SELECT * FROM products 
WHERE standardized_name = 'test';
```

This bug documentation should help new team members understand the evolution of solutions and avoid repeating past mistakes.