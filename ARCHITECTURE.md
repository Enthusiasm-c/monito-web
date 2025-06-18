# Monito Web Architecture Documentation

## 🎯 System Overview

Monito Web is a comprehensive price comparison platform with intelligent invoice scanning and analysis capabilities. The system consists of a Next.js web application, PostgreSQL database, and a Telegram bot for automated invoice processing.

## 🏗️ Core Architecture

### **System Components**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │  Telegram Bot   │    │  Neon PostgreSQL│
│   (Next.js)     │◄──►│   (Python)      │◄──►│   Database      │
│   209.38.85.196 │    │ 209.38.85.196   │    │   Cloud Hosted  │
│                 │    │                 │    │                 │
│ - File Upload   │    │ - OCR Processing│    │ - Products      │
│ - Price Mgmt    │    │ - Price Compare │    │ - Suppliers     │
│ - Admin Panel   │    │ - AI Analysis   │    │ - Prices        │
│ - Data Cleanup  │    │ - Unit Fix Logs │    │ - Uploads       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                        │                        │
          └────────── REST API ────┴──── Database Queries ──┘
```

### **⚠️ CRITICAL DEPLOYMENT RULES**

1. **🚫 NEVER reset database** (`npx prisma db push --force-reset`)
2. **✅ Single Server Deployment** - All components run on 209.38.85.196:3000
3. **✅ Local Backups Only** - Keep full database backups locally
4. **✅ Schema Sync Required** - Always sync Prisma schema with actual DB

## 📊 Database Schema

### **Core Entities**

1. **Products** - Standardized product catalog
2. **Suppliers** - Vendor information and mappings
3. **Prices** - Historical price records with validity periods
4. **Uploads** - File processing tracking and metadata

### **Key Relationships**

```sql
Product 1:N Price (Product has many prices over time)
Supplier 1:N Price (Supplier provides prices for products)
Upload 1:N Price (Upload can contain multiple price records)
```

## 🤖 AI-Powered Processing Pipeline

### **MVP Implementation Strategy**

Following the **80/20 principle** - solving 80% of problems with 20% effort:

#### **Product Matching Engine**
- **Word-based similarity** with modifier awareness
- **Exclusive vs Descriptive modifiers** classification
- **Unit price normalization** across canonical units

#### **Price Comparison Logic**
```typescript
// MVP Features Implemented:
- Supplier filtering (exclude same supplier recommendations)
- Stale price filtering (30+ days old)
- Unit price calculation and comparison
- Minimum 5% savings threshold
- Modifier-based product differentiation
```

### **Enhanced Product Similarity Algorithm**

#### **Modifier Classification System**
```typescript
PRODUCT_MODIFIERS = {
  // Words that fundamentally change the product (exclude if mismatch)
  exclusive: ['sweet', 'wild', 'sea', 'water', 'bitter', 'black', 'white', ...],
  
  // Words that describe size/quality but don't change core product  
  descriptive: ['big', 'large', 'small', 'fresh', 'premium', ...]
}
```

#### **Similarity Scoring Process**
1. **Exclusive modifier check** - Reject incompatible products immediately
2. **Exact normalized match** - Highest priority (100 points)
3. **Sorted word match** - Handle word order variations (95 points)
4. **Core words validation** - Essential product words must match
5. **Word overlap calculation** - Weighted similarity scoring

## 🔧 Technical Implementation

### **Web Application (Next.js)**

#### **API Endpoints Structure**
```
/api/
├── bot/                    # Telegram bot integration
│   ├── prices/compare/     # Price comparison engine  
│   ├── products/search/    # Product search with similarity
│   └── suppliers/search/   # Supplier lookup
├── uploads/               # File processing workflow
│   ├── approve/          # Manual approval endpoint
│   ├── pending/          # Queue management
│   └── status/           # Processing status tracking
└── admin/                # ✨ NEW: Administrative Management
    ├── products/         # Product CRUD operations
    │   ├── /             # List/search products with filters
    │   └── [id]/         # Edit individual product details
    ├── suppliers/        # Supplier CRUD operations  
    │   ├── /             # List/search suppliers
    │   └── [id]/         # Edit supplier contact info
    └── data-quality/     # Data integrity tools
```

#### **🆕 Admin Panel Features**

**Product Management** (`/admin/products`):
- **Search & Filter**: By name, category, unit
- **Unit Correction**: Fix `g` → `kg` and similar errors
- **Price Overview**: See price ranges and supplier count
- **Bulk Operations**: Multi-product editing capabilities

**Supplier Management** (`/admin/suppliers`):
- **Contact Details**: Edit address, phone, email
- **Business Info**: Company information management  
- **Upload History**: Track supplier data uploads
- **Performance Metrics**: Price update frequency

#### **Key Services**

1. **PriceService** (`app/services/database/priceService.ts`)
   - Unit price calculation with MVP approach
   - Price history management
   - Bulk update operations

2. **Unit Price Calculator** (`app/lib/utils/unit-price-calculator.ts`)
   - Canonical unit conversions (kg, ltr, pcs)
   - Cross-unit price comparison
   - Quantity normalization

### **Telegram Bot (Python)**

#### **Architecture Principles**
- **Single Process Enforcement** - Strict prevention of multiple instances
- **Modular Handler System** - Separated concerns for different operations
- **Error-Safe Formatting** - None-safe string operations

#### **Core Components**

1. **Invoice Scanning Handler** (`app/handlers/invoice_scan.py`)
   - OCR processing with OpenAI Vision API
   - Price extraction and validation
   - API integration for comparison

2. **Database Integration** (`app/database_api.py`)
   - Direct API calls to web application
   - Async HTTP client configuration
   - Response processing and error handling

3. **Formatting Utils** (`app/utils/formatting.py`)
   - None-safe price formatting
   - Currency display functions
   - Message formatting for Telegram

#### **Bot Management**
```bash
# Single Instance Startup (Recommended)
cd /opt/telegram-bot
nohup venv/bin/python __main__.py > bot_single.log 2>&1 &

# Startup Script with PID Management
./start-bot.sh
```

### **Database Configuration**

#### **PostgreSQL Extensions Required**
```sql
-- Enable similarity search capabilities
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### **Price Data Model**
- **Amount**: Total price value
- **Unit**: Measurement unit (kg, pcs, ltr, etc.)
- **UnitPrice**: Calculated price per canonical unit
- **ValidFrom/ValidTo**: Price validity period
- **SupplierId**: Source supplier reference

## 🚀 Deployment Architecture

### **Production Environment**
- **Web App**: Ubuntu 22.04 LTS (209.38.85.196:3000)
- **Bot Server**: Ubuntu 22.04 LTS (209.38.85.196) 
- **Database**: Neon PostgreSQL Cloud (ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech)
- **Admin Panel**: http://209.38.85.196:3000/admin

### **🚀 Deployment Commands**

**Server Management**:
```bash
# Deploy code changes to server
scp -r app/admin root@209.38.85.196:/opt/monito-web/app/
scp -r app/api/admin root@209.38.85.196:/opt/monito-web/app/api/

# Restart web application  
ssh root@209.38.85.196 "cd /opt/monito-web && pm2 restart monito-web"

# Check server status
ssh root@209.38.85.196 "cd /opt/monito-web && pm2 status"
```

**Database Management**:
```bash
# ⚠️ NEVER run this command: npx prisma db push --force-reset
# ✅ Safe operations only:

# Generate Prisma client after schema changes
npx prisma generate

# Check database connection  
psql 'postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' -c 'SELECT COUNT(*) FROM products;'

# Backup database (local only)
pg_dump 'postgresql://...' > monito_backup_$(date +%Y%m%d).sql
```

### **Environment Variables**
```env
# Database
DATABASE_URL=postgresql://[credentials]

# AI Services  
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
GOOGLE_API_KEY=...

# Bot Authentication
BOT_API_KEY=...

# Processing Configuration
MIN_SAVING_PCT=5
FRESH_DAYS=7
```

## 📈 Performance Characteristics

### **Price Comparison Performance**
- **Response Time**: < 3 seconds for 10 products
- **Accuracy**: Enhanced with modifier-aware matching
- **Scalability**: Optimized database queries with indexing

### **Bot Processing Metrics**
- **OCR Accuracy**: Improved with AI vision preprocessing
- **Memory Usage**: ~180MB per bot instance
- **Concurrency**: Single instance design prevents conflicts

## 🔐 Security Measures

### **Authentication**
- **Bot API**: Token-based authentication for telegram integration
- **Admin Access**: Protected administrative endpoints
- **Database**: SSL-enforced connections with connection pooling

### **Data Validation**
- **Product Validation**: Middleware ensures data integrity
- **Price Validation**: Business rules enforcement
- **Input Sanitization**: Protection against malicious data

## 🧪 Testing Strategy

### **Unit Testing**
- **Price Calculator**: Unit conversion accuracy
- **Product Matching**: Similarity algorithm validation
- **Formatting Functions**: None-safe operations

### **Integration Testing**
- **API Endpoints**: End-to-end workflow validation
- **Bot Processing**: Invoice scan to comparison pipeline
- **Database Operations**: Transaction integrity

## 📚 Dependencies

### **Web Application**
```json
{
  "@prisma/client": "^5.x",
  "next": "15.x",
  "openai": "^4.x",
  "@google/generative-ai": "^0.x"
}
```

### **Telegram Bot**
```txt
aiogram==3.15.0
openai==1.62.1
python-dotenv==1.0.1
httpx==0.24.1
asyncpg==0.29.0
```

## 🔄 Data Flow

### **Invoice Processing Workflow**
```
1. User uploads invoice photo → Telegram Bot
2. OCR extraction → OpenAI Vision API  
3. Product matching → Enhanced similarity algorithm
4. Price comparison → MVP comparison engine
5. Response formatting → User notification
```

### **Price Update Workflow**
```
1. File upload → Web interface
2. Data extraction → AI processing
3. Standardization → Product normalization
4. Validation → Business rules check
5. Storage → Database with audit trail
```

## 🔧 Common Issues & Solutions

### **Database Schema Mismatches**

**Problem**: `The column 'prices.unit_price' does not exist`
**Solution**:
```bash
# Remove non-existent fields from schema
ssh root@209.38.85.196 "cd /opt/monito-web && sed -i '/unitPrice.*unit_price/d' prisma/schema.prisma"
ssh root@209.38.85.196 "cd /opt/monito-web && npx prisma generate && pm2 restart monito-web"
```

### **Product Unit Issues** 

**Problem**: Products with wrong units (g instead of kg)
**Solution**: Use Admin Panel
1. Go to http://209.38.85.196:3000/admin/products
2. Search for problematic products
3. Edit unit field from `g` to `kg`
4. Save changes

### **Bot Multiple Instances**

**Problem**: Multiple bot processes running
**Solution**:
```bash
# Kill all bot processes
ssh root@209.38.85.196 "pkill -f telegram-bot"
# Start single instance
ssh root@209.38.85.196 "cd /opt/telegram-bot && nohup venv/bin/python __main__.py > bot.log 2>&1 &"
```

## 🎯 Current Status & Next Steps

### **✅ Completed Features**
1. **Admin Panel** - Full CRUD for products and suppliers
2. **Modifier System** - Enhanced product matching with exclusive/descriptive modifiers  
3. **Unit Normalization** - Canonical unit price comparisons
4. **Single Server Deploy** - Consolidated architecture on 209.38.85.196
5. **Database Restoration** - Working system with 2043+ products

### **🚧 Known Issues**
1. **Tomato Unit Mismatch** - Some products have `g` instead of `kg` (fixable via admin)
2. **Client Component Warnings** - Next.js build warnings (non-critical)
3. **API Key Validation** - Some endpoints need API key cleanup

### **🎯 Immediate Priorities**
1. **Fix Tomato Pricing** - Use admin panel to correct unit mismatches
2. **Supplier Management** - Complete supplier admin interface
3. **Data Quality Tools** - Automated detection of unit inconsistencies

---

*Last Updated: 2025-06-18*
*Version: 2.0 (MVP Implementation)*