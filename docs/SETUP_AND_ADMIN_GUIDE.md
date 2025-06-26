# Setup and Admin Guide

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Production Deployment](#production-deployment)
3. [Admin Dashboard Setup](#admin-dashboard-setup)
4. [Telegram Bot Configuration](#telegram-bot-configuration)
5. [Admin Features Guide](#admin-features-guide)
6. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

1. **PostgreSQL** (v14+)
2. **Node.js** (v18+) and npm
3. **Python** (v3.11+)
4. **Git** (v2.0+)

### Step 1: Database Setup

#### Option A: Local PostgreSQL
```bash
# Create PostgreSQL database
createdb monito_db

# Or using psql
psql -U postgres
CREATE DATABASE monito_db;
\q
```

#### Option B: Cloud Database (Recommended)
Use Neon PostgreSQL (free tier) for easier setup:
1. Visit [neon.tech](https://neon.tech)
2. Create account and new project
3. Copy connection string

### Step 2: Monito Web Setup

```bash
cd /Users/denisdomashenko/monito-web

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your settings
nano .env
```

**Required Environment Variables:**
```env
# Database - Use local or cloud PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/monito_db
# Or for Neon: postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb

# AI Services (Required)
GOOGLE_API_KEY=your-gemini-api-key           # Primary AI service
OPENAI_API_KEY=your-openai-api-key           # Secondary AI service

# File Storage (Required for uploads)
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Authentication (Required for admin)
NEXTAUTH_SECRET=your-super-secret-key-here-at-least-32-characters-long
NEXTAUTH_URL=http://localhost:3000

# Bot Integration
BOT_API_KEY=generate-random-key-here
```

**Generate API Key:**
```bash
# Generate secure API key for bot
openssl rand -hex 32
```

**Database Setup:**
```bash
# Generate Prisma client
npx prisma generate

# Apply database migrations
npx prisma db push

# Seed with test data (optional)
npx ts-node prisma/seed-test-data.ts
```

**Start Development Server:**
```bash
npm run dev
```

The web app will be available at http://localhost:3000

### Step 3: Telegram Bot Setup

```bash
cd telegram-bot

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create bot environment file
cp .env.example .env
```

**Bot Environment Variables:**
```env
# Telegram Bot Token (from @BotFather)
BOT_TOKEN=your-telegram-bot-token

# API Connection
MONITO_API_URL=http://localhost:3000/api/bot
BOT_API_KEY=same-key-as-in-monito-web

# AI Service (for OCR)
OPENAI_API_KEY=same-openai-key
```

**Get Telegram Bot Token:**
1. Open Telegram and search for @BotFather
2. Send `/newbot`
3. Choose a name for your bot
4. Choose a username (must end with 'bot')
5. Copy the token and add to BOT_TOKEN in .env

### Step 4: Start All Services

**Terminal 1 - Monito Web:**
```bash
cd /Users/denisdomashenko/monito-web
npm run dev
```

**Terminal 2 - Telegram Bot:**
```bash
cd /Users/denisdomashenko/monito-web/telegram-bot
source venv/bin/activate
python -m app.bot
```

### Step 5: Verify Setup

**Test Checklist:**
- [ ] Web app loads at http://localhost:3000
- [ ] Database connection successful
- [ ] Bot responds to /start command
- [ ] Can upload price lists
- [ ] Admin dashboard accessible

---

## Production Deployment

### Vercel Deployment (Recommended)

**1. Prepare Environment Variables**

Set up these variables in Vercel dashboard:

```env
# Database (Production)
DATABASE_URL=your-production-postgresql-url

# AI Services
GOOGLE_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# File Storage
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Authentication
NEXTAUTH_SECRET=your-production-secret-key
NEXTAUTH_URL=https://your-domain.vercel.app

# Bot Integration
BOT_API_KEY=your-production-bot-key
```

**2. Deploy to Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

**3. Database Migration**

```bash
# Run database migrations in production
npx prisma migrate deploy
```

### Bot Deployment

**For Python Bot on Server:**

```bash
# On your production server
git clone your-repo
cd telegram-bot

# Setup environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create production .env
cp .env.example .env
# Edit with production values

# Run with supervisor or systemd
python -m app.bot
```

---

## Admin Dashboard Setup

### Step 1: Enable Authentication

Ensure environment variables are set:
```bash
# Check required variables
echo $NEXTAUTH_SECRET
echo $NEXTAUTH_URL
```

If missing, add to `.env`:
```env
NEXTAUTH_SECRET=your-super-secret-key-here-at-least-32-characters-long
NEXTAUTH_URL=http://localhost:3000  # or your production URL
```

### Step 2: Create Admin User

```bash
# Run admin user creation script
node scripts/update-admin-password.js
```

This creates:
- **Email:** `admin@monito-web.com`
- **Password:** `admin123`

### Step 3: Access Admin Dashboard

1. **Navigate to admin area:**
   ```
   http://localhost:3000/admin/suppliers
   ```

2. **Login redirect:**
   ```
   http://localhost:3000/admin/login
   ```

3. **Enter credentials:**
   - Email: `admin@monito-web.com`
   - Password: `admin123`

### Step 4: Change Default Password

**After first login:**
1. Go to User Management (if available)
2. Or run update script with new password:
   ```bash
   node scripts/update-admin-password.js --password "your-new-secure-password"
   ```

---

## Telegram Bot Configuration

### Bot Commands Setup

Set bot commands via @BotFather:

```
/start - Get started with price monitoring
/price - Search for product prices (usage: /price chicken)
/help - Show available commands
```

### Webhook vs Polling

**For Development:** Polling (default)
**For Production:** Webhook (recommended)

**Setup Webhook:**
```python
# In bot configuration
WEBHOOK_URL = "https://your-domain.com/bot/webhook"
WEBHOOK_SECRET = "your-webhook-secret"
```

### Bot Features

1. **Price Search**
   ```
   /price beras
   /price "minyak goreng"
   ```

2. **Invoice Scanning**
   - Send photo of receipt/invoice
   - Bot analyzes prices and suggests alternatives

3. **Multi-language Support**
   - Supports Indonesian and English product names
   - Automatic translation for common items

---

## Admin Features Guide

### Authentication & Security

**Role-based Access:**
- **Admin**: Full access (delete, modify, create)
- **Manager**: Edit and create data
- **Viewer**: Read-only access

**Security Features:**
- NextAuth.js authentication
- bcryptjs password hashing
- Protected routes middleware
- API key authentication for bot

### Data Management

#### 1. Inline Editing
- **Click any cell** to start editing
- **Enter** to save changes
- **Esc** to cancel
- Works for products, prices, supplier info

#### 2. Bulk Operations
- **Select multiple items** using checkboxes
- **Bulk delete** all prices for a supplier
- **Mass update** categories or units
- **Confirmation dialogs** prevent accidents

#### 3. Product Management
**Navigate to:** `/admin/products/[id]`

**Features:**
- Edit product names and categories
- Manage units and standardized names
- Add/remove product aliases
- View price history

#### 4. Supplier Management
**Navigate to:** `/admin/suppliers`

**Features:**
- View all suppliers and their products
- Edit supplier information
- Analyze supplier pricing patterns
- Manage supplier-specific settings

#### 5. Price Analytics
**Access via:** "📊 Analytics" button in product tables

**Features:**
- **Price Trend Charts**: Historical price movements
- **Supplier Comparison**: Compare prices across suppliers
- **Statistics Dashboard**:
  - Current average price
  - Min/max prices
  - Price spread analysis
  - Supplier count

#### 6. Upload Management
**Navigate to:** `/admin/uploads`

**Features:**
- View all file uploads and their status
- Retry failed uploads
- Review extracted data before approval
- Monitor processing logs

### Advanced Features

#### 1. Product Aliases
**Purpose:** Handle multi-language product names

**Example:**
- Alias: "wortel" → Maps to: "Carrot"
- Alias: "zanahoria" → Maps to: "Carrot"

**Management:**
- Add aliases via product edit page
- Bulk import aliases via API
- Support for Indonesian, English, Spanish

#### 2. Price History Tracking
**Automatic Features:**
- All price changes logged
- User attribution (who made change)
- Timestamp recording
- Reason tracking

**Manual Features:**
- Add notes to price changes
- Mark significant price events
- Export price history

#### 3. Data Quality Tools
**Validation:**
- Duplicate product detection
- Price range validation
- Unit consistency checking
- Supplier data verification

**Cleanup:**
- Remove orphaned products
- Merge duplicate entries
- Standardize naming conventions
- Fix unit inconsistencies

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Error
```
Error: P1001: Can't reach database server
```

**Solutions:**
```bash
# Check PostgreSQL is running (macOS)
brew services start postgresql

# Check PostgreSQL is running (Linux)
sudo systemctl start postgresql

# Test connection
psql -U postgres -d monito_db -c "\dt"

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

#### 2. Admin Authentication Not Working
**Check:**
- `NEXTAUTH_SECRET` is set and at least 32 characters
- `NEXTAUTH_URL` matches your domain
- Admin user exists in database

**Debug:**
```bash
# Verify environment variables
cat .env | grep NEXTAUTH

# Check user exists
npx prisma studio
# Navigate to User table
```

#### 3. Bot Not Responding
**Check:**
- Bot token is correct and active
- No other instance running with same token
- API endpoint is accessible
- BOT_API_KEY matches between services

**Debug:**
```bash
# Check bot logs
tail -f telegram-bot/bot.log

# Test API manually
curl -H "X-Bot-API-Key: your-api-key" \
     "http://localhost:3000/api/bot/products/search?q=test"
```

#### 4. File Upload Issues
**Check:**
- BLOB_READ_WRITE_TOKEN is valid
- File size is under limits (10MB default)
- Supported file formats (.xlsx, .pdf, .csv, images)

**Debug:**
```bash
# Check upload logs
tail -f logs/processing.log

# Test upload endpoint
curl -X POST -F "file=@test.xlsx" \
     "http://localhost:3000/api/upload-unified"
```

#### 5. AI Processing Errors
**Check:**
- GOOGLE_API_KEY is valid and has quota
- OPENAI_API_KEY is valid and has credits
- Network connectivity to AI services

**Debug:**
```bash
# Check token usage
node calculate_token_usage.js

# Test AI services directly
node debug-ai-pipeline.js
```

### Performance Issues

#### 1. Slow Database Queries
**Solutions:**
- Check database indexes
- Monitor connection pool
- Optimize Prisma queries

```bash
# Check slow queries
npx prisma studio

# Monitor queries in development
DEBUG=prisma:query npm run dev
```

#### 2. Memory Issues
**Check:**
- Using singleton Prisma instance
- No memory leaks in file processing
- Proper garbage collection

**Monitor:**
```bash
# Check memory usage
node --inspect app.js
# Open Chrome DevTools for profiling
```

#### 3. File Processing Timeouts
**Solutions:**
- Increase timeout limits
- Implement chunking for large files
- Use background processing

```typescript
// Increase timeout in API route
export const config = {
  maxDuration: 300, // 5 minutes
};
```

### Getting Help

**Log Files:**
- Web application: Console output from `npm run dev`
- Telegram bot: `telegram-bot/bot.log`
- Processing: `logs/processing.log`
- Database: `logs/database.log` (if enabled)

**Debug Tools:**
```bash
# Test API endpoints
node test-bot-api.js

# Test file processing
node debug-upload.js

# Test standardization
node test-ai-standardization.js

# Performance testing
node test-integration.js
```

**Support Channels:**
- Check [GitHub Issues](https://github.com/your-org/monito-web/issues)
- Review [Technical Documentation](TECHNICAL_DOCUMENTATION.md)
- Contact support team

---

**Last Updated:** June 26, 2025  
**Version:** 2.0