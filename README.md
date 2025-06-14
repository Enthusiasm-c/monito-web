# 🏪 Monito Web - B2B Price Monitoring Platform

<div align="center">
  <img src="public/logo.png" alt="Monito Web Logo" width="200" />
  
  [\![Next.js](https://img.shields.io/badge/Next.js-15.1-black)](https://nextjs.org/)
  [\![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
  [\![Prisma](https://img.shields.io/badge/Prisma-5.0-green)](https://www.prisma.io/)
  [\![License](https://img.shields.io/badge/license-MIT-purple)](LICENSE)
</div>

## 🌟 Overview

Monito Web is a comprehensive B2B price monitoring and comparison platform designed specifically for the Indonesian HORECA (Hotel, Restaurant, Catering) market. It helps businesses track supplier prices, standardize product data across different naming conventions, and make data-driven purchasing decisions.

### 🎯 Key Features

- **📊 Multi-Supplier Price Comparison** - Compare prices across all your suppliers in real-time
- **📄 Intelligent File Processing** - Upload price lists in any format (Excel, PDF, CSV, Images)
- **🤖 AI-Powered Standardization** - Automatically matches "Ayam Potong" with "Chicken Fresh Cut"
- **📱 Telegram Bot Integration** - Check prices and scan invoices on the go
- **📈 Analytics & Insights** - Track price trends and identify savings opportunities
- **🔍 Smart Search** - Find products even with typos or different naming
- **🌏 Indonesian Market Optimized** - Handles Rupiah formatting, local units, and Indonesian product names

## 📚 Documentation

For detailed documentation, please refer to:

1. **[Architecture Overview](docs/01_ARCHITECTURE.md)** - System design, technology stack, and component details
2. **[Bugs & Solutions](docs/02_BUGS_AND_SOLUTIONS.md)** - Common issues, solutions, and lessons learned
3. **[Developer Guide](docs/03_DEVELOPER_GUIDE.md)** - Setup instructions, coding standards, and workflows

## 🚀 Quick Start

### Prerequisites

- Node.js 18.17+ 
- Python 3.11+ (for Telegram bot)
- PostgreSQL 14+ (or use cloud Neon DB)
- Git 2.0+

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/monito-web.git
cd monito-web

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Setup database
npx prisma generate
npx prisma migrate dev

# Start development server
npm run dev
```

Visit http://localhost:3000 to see the application.

### Telegram Bot Setup (Optional)

```bash
cd telegram-bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with bot token
python -m app.bot
```

## 🏗️ Project Structure

```
monito-web/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Main application
│   ├── api/               # API routes
│   │   └── upload-unified/ # Unified upload endpoint
│   ├── lib/               # Core business logic
│   │   └── core/          # Unified architecture
│   │       ├── BaseProcessor.ts    # Base class for all processors
│   │       ├── Interfaces.ts       # Unified type definitions
│   │       ├── ErrorHandler.ts     # Centralized error handling
│   │       └── PromptTemplates.ts  # AI prompt management
│   ├── services/          # Business services
│   │   └── core/          # Core services
│   │       └── UnifiedGeminiService.ts # Main AI processing service
│   ├── components/        # React components
│   └── globals.css        # Global styles
├── prisma/               # Database schema
├── public/               # Static assets
├── telegram-bot/         # Telegram bot (Python)
└── docs/                 # Technical documentation
```

## 🔧 Core Technologies

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Recharts** - Data visualization

### Backend
- **Node.js** - JavaScript runtime
- **Prisma** - Type-safe ORM
- **PostgreSQL** - Database (Neon cloud)
- **Google Gemini AI** - Primary AI processing (Gemini 2.0 Flash)
- **OpenAI API** - Secondary AI features
- **Unified Architecture** - Centralized processing patterns

### Infrastructure
- **Vercel** - Hosting platform
- **Vercel Blob** - File storage
- **Docker** - Containerization
- **GitHub Actions** - CI/CD

## 📋 Features in Detail

### 1. Intelligent File Processing

The platform can process price lists in various formats:

- **Excel Files** (.xlsx, .xls) - Even with complex formatting
- **PDF Documents** - Including scanned documents
- **CSV Files** - Standard and custom delimiters
- **Images** - Photos of price lists using OCR

### 2. AI-Powered Standardization

```javascript
// Input from different suppliers:
"Ayam Potong Segar"     → "Fresh Cut Chicken"
"Aym Ptg"               → "Fresh Cut Chicken"  
"CHICKEN FRESH (CUT)"   → "Fresh Cut Chicken"
```

### 3. Real-time Price Comparison

```javascript
// API Response Example
{
  "product": "Fresh Cut Chicken",
  "unit": "kg",
  "prices": [
    { "supplier": "PT Segar Jaya", "price": 35000 },
    { "supplier": "CV Mitra Food", "price": 37000 },
    { "supplier": "UD Berkah", "price": 34500 }
  ],
  "best_price": 34500,
  "average_price": 35500,
  "potential_savings": "5.6%"
}
```

### 4. Telegram Bot Commands

```
/start - Get started
/price chicken - Check chicken prices
/price "minyak goreng" - Check cooking oil prices
Send photo - Scan invoice for price comparison
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- ExcelProcessor.test.ts

# E2E tests
npm run test:e2e
```

## 📦 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

### Docker

```bash
# Build image
docker build -t monito-web .

# Run container
docker run -p 3000:3000 --env-file .env.production monito-web
```

### Manual Deployment

```bash
# Build application
npm run build

# Start production server
npm start
```

## 🔒 Environment Variables

### Required

```env
DATABASE_URL=            # PostgreSQL connection string
GOOGLE_API_KEY=         # Google Gemini API key (primary)
OPENAI_API_KEY=         # OpenAI API key (secondary)
BLOB_READ_WRITE_TOKEN=  # Vercel Blob storage
BOT_API_KEY=            # Internal API authentication
```

### Optional

```env
NEXTAUTH_SECRET=        # For authentication
NEXTAUTH_URL=          # App URL
REDIS_URL=             # For caching
SENTRY_DSN=            # Error tracking
```

## 📊 API Endpoints

### Products
- `GET /api/products` - List products with prices
- `GET /api/products/search` - Search products
- `POST /api/products` - Create product

### Suppliers
- `GET /api/suppliers` - List suppliers
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/:id` - Update supplier

### Upload
- `POST /api/upload-unified` - Unified upload endpoint for all file types
- `GET /api/upload-unified` - Health check and supported formats
- `GET /api/uploads/status/:id` - Check processing status

### Bot API
- `GET /api/bot/products/search` - Search for bot
- `POST /api/bot/prices/compare` - Bulk comparison

## 🤝 Contributing

We welcome contributions\! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Style

- Use TypeScript for type safety
- Follow ESLint rules
- Write tests for new features
- Update documentation

## 🐛 Known Issues

1. **Large PDF Processing** - PDFs over 20MB may timeout
2. **Complex Excel Formulas** - Calculated cells may not import correctly
3. **Telegram Bot Conflicts** - Only one instance can run per token

See [Bugs & Solutions](docs/02_BUGS_AND_SOLUTIONS.md) for detailed information.

## 📈 Performance

- **Average Upload Processing**: 2-5 seconds for 1000 products
- **Search Response Time**: <100ms for 100k products
- **AI Standardization**: 0.5-2 seconds per product
- **Database Queries**: Optimized with indexes

## 🔐 Security

- Environment variables for secrets
- API authentication required
- Input validation and sanitization
- SQL injection prevention via Prisma
- Rate limiting on public endpoints

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT-4 API
- [Vercel](https://vercel.com) for hosting and storage
- [Neon](https://neon.tech) for PostgreSQL hosting
- All our beta testers in the Indonesian HORECA industry

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/monito-web/issues)
- **Email**: support@monito-web.com
- **Discord**: [Join our community](https://discord.gg/monito-web)

---

<div align="center">
  Made with ❤️ for the Indonesian HORECA industry
  
  ⭐ Star us on GitHub\!
</div>
EOF < /dev/null