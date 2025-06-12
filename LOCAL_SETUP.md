# Local Setup Guide for Monito Web + Telegram Bot

## Prerequisites

1. **PostgreSQL** (v14+)
2. **Node.js** (v18+) and npm
3. **Python** (v3.11+)
4. **Redis** (optional, for caching)
5. **Telegram Bot Token** (from @BotFather)
6. **OpenAI API Key** (for OCR)

## Step 1: Database Setup

```bash
# Create PostgreSQL database
createdb monito_db

# Or using psql
psql -U postgres
CREATE DATABASE monito_db;
\q
```

## Step 2: Monito Web Setup

```bash
cd /Users/denisdomashenko/monito-web

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env file with your settings:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/monito_db
# OPENAI_API_KEY=your-openai-key
# BOT_API_KEY=generate-random-key-here

# Run database migrations
npx prisma generate
npx prisma db push

# Seed database with test data (optional)
npx prisma db seed

# Start development server
npm run dev
```

The web app will be available at http://localhost:3000

## Step 3: Telegram Bot Setup

```bash
cd /Users/denisdomashenko/monito-web/telegram-bot

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env file:
# BOT_TOKEN=your-telegram-bot-token
# MONITO_API_URL=http://localhost:3000/api/bot
# BOT_API_KEY=same-key-as-in-monito-web
# OPENAI_API_KEY=same-openai-key
```

## Step 4: Get Telegram Bot Token

1. Open Telegram and search for @BotFather
2. Send `/newbot`
3. Choose a name for your bot
4. Choose a username (must end with 'bot')
5. Copy the token and add to BOT_TOKEN in .env

## Step 5: Generate API Key

```bash
# Generate a secure API key
openssl rand -hex 32
```

Add this key to both .env files as BOT_API_KEY

## Step 6: Test Data Setup

Create a file `seed-test-data.ts` in Monito Web:

```typescript
// /Users/denisdomashenko/monito-web/prisma/seed-test-data.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test suppliers
  const supplier1 = await prisma.supplier.create({
    data: {
      name: 'Toko Sembako Jaya',
      email: 'toko.jaya@example.com',
      phone: '+62812345678'
    }
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: 'CV Mitra Pangan',
      email: 'mitra@example.com',
      phone: '+62887654321'
    }
  });

  // Create test products with prices
  const products = [
    { name: 'Beras Premium', unit: 'kg', category: 'Groceries' },
    { name: 'Minyak Goreng', unit: 'liter', category: 'Groceries' },
    { name: 'Gula Pasir', unit: 'kg', category: 'Groceries' },
    { name: 'Ayam Potong', unit: 'kg', category: 'Meat' },
    { name: 'Telur Ayam', unit: 'kg', category: 'Dairy' }
  ];

  for (const productData of products) {
    const product = await prisma.product.create({
      data: {
        ...productData,
        standardizedName: productData.name.toLowerCase(),
        standardizedUnit: productData.unit.toLowerCase()
      }
    });

    // Add prices from different suppliers
    await prisma.price.createMany({
      data: [
        {
          productId: product.id,
          supplierId: supplier1.id,
          amount: Math.floor(Math.random() * 50000) + 10000,
          currency: 'IDR'
        },
        {
          productId: product.id,
          supplierId: supplier2.id,
          amount: Math.floor(Math.random() * 50000) + 10000,
          currency: 'IDR'
        }
      ]
    });
  }

  console.log('Test data seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run the seed script:
```bash
npx ts-node prisma/seed-test-data.ts
```

## Step 7: Start Services

### Terminal 1 - Monito Web:
```bash
cd /Users/denisdomashenko/monito-web
npm run dev
```

### Terminal 2 - Telegram Bot:
```bash
cd /Users/denisdomashenko/monito-web/telegram-bot
source venv/bin/activate
python -m app.bot
```

### Terminal 3 - Redis (optional):
```bash
redis-server
```

## Step 8: Test the Bot

1. Open Telegram and find your bot
2. Send `/start` - should show welcome message
3. Send `/price beras` - should show rice prices
4. Send a photo of an invoice - should analyze prices

## Testing Checklist

- [ ] Web app loads at http://localhost:3000
- [ ] Can create account and login
- [ ] Can upload price lists
- [ ] Bot responds to /start command
- [ ] Bot searches products with /price
- [ ] Bot processes invoice photos
- [ ] API endpoints return data

## Common Issues & Solutions

### 1. Database Connection Error
```
Error: P1001: Can't reach database server
```
**Solution**: Make sure PostgreSQL is running:
```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### 2. Bot Not Responding
**Check**:
- Bot token is correct
- No other instance running with same token
- Check logs: `tail -f bot.log`

### 3. OCR Not Working
**Check**:
- OpenAI API key is valid
- Image is clear and readable
- Check OpenAI API quota

### 4. API Authentication Error
**Check**:
- BOT_API_KEY matches in both .env files
- API URL is correct (http://localhost:3000/api/bot)

## Quick Test Script

Create `test-bot-api.js`:

```javascript
// Test API endpoints
const API_URL = 'http://localhost:3000/api/bot';
const API_KEY = 'your-bot-api-key';

async function testAPI() {
  // Test product search
  const searchRes = await fetch(`${API_URL}/products/search?q=beras`, {
    headers: { 'X-Bot-API-Key': API_KEY }
  });
  console.log('Search:', await searchRes.json());

  // Test price comparison
  const compareRes = await fetch(`${API_URL}/prices/compare`, {
    method: 'POST',
    headers: {
      'X-Bot-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items: [
        { product_name: 'Beras Premium', scanned_price: 70000 }
      ]
    })
  });
  console.log('Compare:', await compareRes.json());
}

testAPI().catch(console.error);
```

Run with: `node test-bot-api.js`

## Docker Alternative

If you prefer Docker:

```bash
# Start everything with docker-compose
cd /Users/denisdomashenko/monito-web
docker-compose up -d

cd /Users/denisdomashenko/monito-web/telegram-bot
docker-compose up -d
```

## Monitoring

Watch logs in real-time:

```bash
# Monito Web logs
npm run dev

# Bot logs
tail -f telegram-bot/bot.log

# PostgreSQL logs
tail -f /usr/local/var/log/postgresql@14.log
```