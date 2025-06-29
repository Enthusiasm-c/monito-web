# 🏪 Monito Web - B2B Price Monitoring Platform

<div align="center">
  <img src="assets/logo.svg" alt="Monito Web Logo" width="200" />
  
  [![Next.js](https://img.shields.io/badge/Next.js-15.1-black)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-5.0-green)](https://www.prisma.io/)
  [![License](https://img.shields.io/badge/license-MIT-purple)](LICENSE)
</div>

## 🌟 Overview

Monito Web is a comprehensive B2B price monitoring and comparison platform designed specifically for the Indonesian HORECA (Hotel, Restaurant, Catering) market. It helps businesses track supplier prices, standardize product data across different naming conventions, and make data-driven purchasing decisions.

### 🎯 Key Features

- **📊 Multi-Supplier Price Comparison** - Compare prices across all your suppliers in real-time
- **📄 Intelligent File Processing** - Upload price lists in any format (Excel, PDF, CSV, Images)
- **🤖 AI-Powered Standardization** - Automatically matches "Ayam Potong" with "Fresh Cut Chicken"
- **📱 Telegram Bot Integration** - Check prices and scan invoices on the go
- **📈 Analytics & Insights** - Track price trends and identify savings opportunities
- **🔍 Smart Search** - Find products even with typos or different naming
- **🌏 Indonesian Market Optimized** - Handles Rupiah formatting, local units, and Indonesian product names
- **🏗️ Admin Dashboard** - Complete management interface with inline editing and analytics
- **🔄 Refactored Architecture** - Clean, maintainable codebase with unified patterns (2024)

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

### Environment Variables Setup

Required variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/monito_db

# AI Services
GOOGLE_API_KEY=your-gemini-api-key        # Primary AI (Gemini 2.0 Flash)
OPENAI_API_KEY=your-openai-api-key        # Secondary AI (GPT-4o)

# File Storage
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Authentication
NEXTAUTH_SECRET=your-super-secret-key-here-at-least-32-characters-long
NEXTAUTH_URL=http://localhost:3000

# Bot Integration
BOT_API_KEY=your-generated-api-key
```

### Admin Setup

Create an admin user:

```bash
node scripts/update-admin-password.js
```

Login with:
- Email: `admin@monito-web.com`
- Password: `admin123`

## 🏗️ Project Structure

```
monito-web/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard with authentication
│   ├── api/               # API routes
│   │   ├── upload-unified/ # Unified upload endpoint
│   │   ├── bot/           # Telegram bot API
│   │   └── admin/         # Admin management API
│   ├── lib/               # Core business logic
│   │   ├── core/          # Unified architecture (refactored 2024)
│   │   │   ├── BaseProcessor.ts    # Base class for all processors
│   │   │   ├── Interfaces.ts       # Unified type definitions
│   │   │   ├── ErrorHandler.ts     # Centralized error handling
│   │   │   └── PromptTemplates.ts  # AI prompt management
│   │   └── utils/         # Utilities
│   │       └── unified-unit-converter.ts # Consolidated unit conversion
│   ├── services/          # Business services
│   │   ├── DatabaseService.ts      # Unified database operations
│   │   └── core/          # Core services
│   │       └── UnifiedGeminiService.ts # Main AI processing service
│   ├── utils/             # Shared utilities
│   │   ├── errors.ts      # Error handling with asyncHandler
│   │   └── api-helpers.ts # Common API patterns
│   └── components/        # React components
├── prisma/               # Database schema and migrations
├── telegram-bot/         # Telegram bot (Python)
├── docs/                 # Technical documentation
│   ├── 01_ARCHITECTURE.md       # System architecture overview
│   ├── 02_REFACTORED_ARCHITECTURE.md # 2024 refactoring details
│   └── *.md             # Additional documentation
└── scripts/              # Utility scripts
```

## 🔧 Core Technologies

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety throughout the application
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Data visualization for analytics

### Backend
- **Node.js** - JavaScript runtime
- **Prisma** - Type-safe ORM with PostgreSQL
- **Google Gemini 2.0 Flash** - Primary AI processing (free tier)
- **OpenAI GPT-4o** - Secondary AI features
- **NextAuth.js** - Authentication system
- **Unified Architecture** - Refactored codebase with BaseProcessor pattern and consolidated utilities

### Database
- **PostgreSQL** - Primary database (hosted on Neon)
- **Prisma ORM** - Type-safe database access
- **Connection pooling** - Optimized for performance

### Infrastructure
- **Vercel** - Hosting platform
- **Vercel Blob** - File storage
- **Neon** - PostgreSQL hosting

## 📋 Key Features in Detail

### 1. Intelligent File Processing

The platform processes price lists in various formats using a unified pipeline:

- **Excel Files** (.xlsx, .xls) - Handles complex formatting and formulas
- **PDF Documents** - Including scanned documents with OCR
- **CSV Files** - Standard and custom delimiters
- **Images** - Photos of price lists using AI vision

**Unified Processing Pipeline:**
```
File Upload → Type Detection → AI Extraction → Standardization → Database Storage
```

### 2. AI-Powered Product Standardization

Smart matching system that handles Indonesian product variations:

```javascript
// Examples of automatic standardization:
"Ayam Potong Segar"     → "Fresh Cut Chicken"
"Aym Ptg"               → "Fresh Cut Chicken"  
"CHICKEN FRESH (CUT)"   → "Fresh Cut Chicken"
"wortel"                → "Carrot" (via aliases)
```

### 3. Advanced Product Matching

- **Alias System**: Direct mapping for common translations
- **Multi-language Support**: Indonesian, English, Spanish
- **Fuzzy Matching**: Handles OCR errors and typos
- **Smart Modifiers**: Distinguishes between "sweet potato" and "potato"
- **Unit Conversion**: Automatic g→kg, ml→L conversions

### 4. Admin Dashboard Features

- **Inline Editing**: Click any cell to edit products and prices
- **Bulk Operations**: Mass delete, update, and manage data
- **Price Analytics**: Charts and trends for individual products
- **History Tracking**: Automatic price change logging
- **Role-based Access**: Admin, Manager, Viewer roles

### 5. Telegram Bot Integration

```
/start - Get started with the bot
/price chicken - Check chicken prices across suppliers
/price "minyak goreng" - Search for cooking oil prices
Send photo - Scan invoice for price comparison with alternatives
```

## 📊 API Endpoints (Refactored with AsyncHandler)

### Core API
- `POST /api/upload-unified` - Unified file upload for all formats
- `GET /api/products` - List products with current prices (uses DatabaseService)
- `GET /api/products/search` - Search products with fuzzy matching
- `GET /api/suppliers` - List suppliers (uses DatabaseService)

**Note**: All API routes now use standardized error handling with `asyncHandler` pattern for consistent responses.

### Bot API
- `GET /api/bot/products/search` - Product search for Telegram bot
- `POST /api/bot/prices/compare` - Bulk price comparison with alternatives

### Admin API
- `GET/PUT/DELETE /api/admin/products/[id]` - Product management
- `GET/PUT/DELETE /api/admin/prices/[id]` - Price management
- `GET /api/admin/analytics/prices` - Price analytics and trends
- `POST /api/admin/aliases` - Product alias management

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm test -- matching-pipeline.test.ts
npm test -- admin.test.ts

# Test Telegram bot API
node test-bot-api.js
```

## 📦 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

### Environment Setup for Production

Ensure all environment variables are configured in your hosting platform:

```env
DATABASE_URL=your-production-database-url
GOOGLE_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://your-domain.com
BOT_API_KEY=your-production-bot-key
```

## 🔒 Security Features

- **Authentication**: NextAuth.js with role-based access control
- **API Protection**: Bot API uses secure API key authentication
- **Input Validation**: Comprehensive validation using Zod schemas
- **SQL Injection Prevention**: Prisma ORM provides built-in protection
- **File Security**: Type and size validation for uploads
- **Password Hashing**: bcryptjs for secure password storage

## 📈 Performance Metrics

- **Average Upload Processing**: 2-5 seconds for 1000 products
- **Search Response Time**: <100ms for 100k products
- **AI Standardization**: 0.5-2 seconds per product
- **Database Optimization**: Singleton connection pattern saves ~1.2GB memory
- **Batch Processing**: Handles 200+ products per AI call

## 📚 Documentation

For detailed documentation, refer to:

1. **[Setup and Admin Guide](docs/SETUP_AND_ADMIN_GUIDE.md)** - Installation, configuration, and admin features
2. **[Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md)** - Architecture, matching mechanism, and implementation details

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow TypeScript and ESLint rules
4. Write tests for new features
5. Update documentation as needed
6. Submit a pull request

## 🐛 Known Issues

1. **Large PDF Processing**: Files over 20MB may require chunking
2. **Complex Excel Formulas**: Calculated cells may need manual review
3. **Telegram Bot Limitations**: Only one instance per token

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/monito-web/issues)
- **Email**: support@monito-web.com

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT-4o API
- [Google](https://ai.google.dev) for Gemini 2.0 Flash API
- [Vercel](https://vercel.com) for hosting and storage
- [Neon](https://neon.tech) for PostgreSQL hosting
- All our beta testers in the Indonesian HORECA industry

---

<div align="center">
  Made with ❤️ for the Indonesian HORECA industry
  
  ⭐ Star us on GitHub!
</div>