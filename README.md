# 🏪 Monito Web - B2B Price Monitoring Platform

<div align="center">
  <img src="assets/logo.svg" alt="Monito Web Logo" width="200" />
  
  [![Next.js](https://img.shields.io/badge/Next.js-15.1-black)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-5.0-green)](https://www.prisma.io/)
  [![Production](https://img.shields.io/badge/Status-Production_Ready-success)](http://209.38.85.196:3000)
</div>

## 🌟 Overview

Monito Web is a comprehensive B2B price monitoring and comparison platform designed specifically for the Indonesian HORECA (Hotel, Restaurant, Catering) market. It helps businesses track supplier prices, standardize product data across different naming conventions, and make data-driven purchasing decisions.

**🚀 Production Status:** Deployed and running at [209.38.85.196:3000](http://209.38.85.196:3000)

### 🎯 Key Features

- **📊 Multi-Supplier Price Comparison** - Compare prices across all your suppliers in real-time
- **📄 Intelligent File Processing** - Upload price lists in any format (Excel, PDF, CSV, Images)
- **🤖 AI-Powered Standardization** - Automatically matches "Ayam Potong" with "Fresh Cut Chicken"
- **📈 Interactive Price Analytics** - Real-time charts with 6-month history tracking
- **🔍 Smart Search** - Find products even with typos or different naming
- **🌏 Indonesian Market Optimized** - Handles Rupiah formatting, local units, and Indonesian product names
- **🏗️ Admin Dashboard** - Complete management interface with inline editing and analytics
- **🔄 Clean Architecture** - Unified patterns with BaseProcessor and consolidated utilities

## 📊 Current Database Status (July 2025)

- **Products**: 3,183 active products tracked
- **Suppliers**: 31 verified suppliers integrated
- **Price Points**: Real-time tracking with historical data
- **Categories**: Complete coverage - Fruits, Vegetables, Dairy, Meat, Seafood
- **Last Update**: July 7, 2025

### Key Suppliers in System
- **Widi Wiguna** - 214 products (largest supplier)
- **Milk Up, Bali Boga, Island Organics** - Major dairy/produce suppliers
- **Fresh suppliers** across Indonesia

## 🚀 Quick Start

### Prerequisites

- Node.js 18.17+ 
- PostgreSQL 14+ (or use cloud Neon DB)
- Google Gemini API key
- Git 2.0+

### Installation

```bash
# Clone repository
git clone https://github.com/Enthusiasm-c/monito-web.git
cd monito-web

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Setup database
npx prisma generate
npx prisma migrate dev

# Build and start
npm run build
npm start
```

Visit http://localhost:3000 to see the application.

### Environment Variables Setup

Required variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/monito_db

# AI Services
GEMINI_API_KEY=your-gemini-api-key        # Primary AI service

# Authentication
NEXTAUTH_SECRET=your-super-secret-key-here-at-least-32-characters-long
NEXTAUTH_URL=http://localhost:3000

# Optional: Bot Integration
BOT_API_KEY=your-generated-api-key
```

### Admin Access

Default admin credentials:
- **Email**: `admin@example.com`
- **Password**: `admin123`

## 🏗️ Project Structure

```
monito-web/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard with authentication
│   ├── api/               # API routes
│   │   ├── admin/         # Admin management API
│   │   │   └── analytics/ # Price analytics endpoints
│   │   ├── products/      # Product management API
│   │   └── upload-unified/ # File upload processing
│   ├── components/        # React components
│   │   └── PriceAnalytics/ # Price visualization components
│   ├── services/          # Business services
│   │   ├── admin/         # Admin-specific services
│   │   └── core/          # Core processing services
│   └── lib/               # Utilities and helpers
├── prisma/               # Database schema and migrations
├── docs/                 # Technical documentation
└── scripts/              # Utility scripts
```

## 📈 API Endpoints

### Public APIs (No Authentication Required)
```bash
# Get products with pricing
GET /api/products?limit=50&search=apple

# Get product details with price comparison
GET /api/products/[id]

# Price analytics - Fixed for public access
GET /api/admin/analytics/prices?type=product&productId=xxx
GET /api/admin/analytics/prices?type=market&limit=10
```

### Admin APIs (Authentication Required)
```bash
# Supplier management
GET /api/admin/suppliers
POST /api/admin/suppliers

# Upload management
GET /api/admin/uploads
POST /api/admin/uploads/approve

# Product management
GET /api/admin/products
PUT /api/admin/products/[id]
```

## 📊 Price Analytics Features

### ✅ Recent Fixes (July 2025)
- **Authentication Removed**: Price analytics API now publicly accessible
- **Apple Fuji Fix**: Resolved "Failed to load price analytics" error
- **Interactive Charts**: Added timeline and comparison views
- **6-Month History**: Complete price tracking with trends

### Available Analytics
- Product price history and trends
- Multi-supplier price comparison
- Market position analysis (cheapest/expensive/average)
- Real-time statistics (min/max/average/spread)
- Price change notifications

### Example API Response
```json
{
  "success": true,
  "data": {
    "productId": "product_xxx",
    "productName": "Apple Fuji",
    "currentPrices": [
      {
        "supplierId": "supplier_xxx",
        "supplierName": "Fresh Fruits Co",
        "price": 25000,
        "lastUpdated": "2025-07-07T07:22:32.783Z"
      }
    ],
    "statistics": {
      "currentAveragePrice": 25000,
      "currentMinPrice": 23000,
      "currentMaxPrice": 27000,
      "supplierCount": 3
    }
  }
}
```

## 🔧 Core Technologies

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety throughout the application
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Interactive charts for price analytics

### Backend
- **Node.js** - JavaScript runtime
- **Prisma** - Type-safe ORM with PostgreSQL
- **Google Gemini** - AI document processing
- **NextAuth.js** - Authentication system

### Database
- **PostgreSQL** - Primary database (Neon hosted)
- **Connection pooling** - Optimized for performance
- **Price history tracking** - Complete audit trail

### Infrastructure
- **Production Server**: Ubuntu 24.04 at 209.38.85.196
- **Process Manager**: PM2 with auto-restart
- **Database**: Neon PostgreSQL cloud

## 🚀 Production Deployment

### Current Production Status
- **Server**: 209.38.85.196:3000 ✅ Online
- **Process**: PM2 managed with auto-restart
- **Database**: 3,183 products, 31 suppliers
- **Last Deployment**: July 7, 2025

### Deployment Commands
```bash
# On production server
cd /root/monito-web
git pull origin main
npm install
npm run build
pm2 restart monito-web
```

### Health Check
```bash
# Check application status
pm2 list

# View logs
pm2 logs monito-web

# Test APIs
curl http://209.38.85.196:3000/api/products?limit=1
curl http://209.38.85.196:3000/api/admin/analytics/prices?type=market&limit=1
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific features
npm test -- price-analytics.test.ts
npm test -- product-matching.test.ts

# Test production API
curl -X GET "http://209.38.85.196:3000/api/products?limit=5"
```

## 📚 Documentation

### Core Documentation
- **DEPLOYMENT_GUIDE.md** - Production deployment instructions
- **CRITICAL_BUG_FIX.md** - Recent fixes and solutions
- **MATCHING_MECHANISM.md** - Product matching algorithm
- **BOT_CALCULATION_BUG.md** - Telegram bot integration

### Recent Updates
- **July 2025 Data Integration**: Complete supplier file upload
- **Price Analytics Fix**: Public API access restored
- **Database Cleanup**: Removed failed uploads and duplicates
- **Performance Optimization**: Enhanced file processing pipeline

## 🔒 Security & Performance

### Security Features
- **Role-based Authentication** (Admin/Manager/Viewer)
- **API Key Protection** for bot endpoints
- **Input Validation** using Zod schemas
- **SQL Injection Prevention** via Prisma ORM

### Performance Metrics
- **Database**: 3,183 products, optimized queries
- **API Response**: <200ms average
- **File Processing**: 2-5 seconds for 1000 products
- **Price Analytics**: Real-time with 6-month history

## 🐛 Known Issues & Solutions

### ✅ Recently Fixed
- **Price Analytics Authentication**: Removed auth requirement ✅
- **Apple Fuji Error**: "Failed to load price analytics" resolved ✅
- **Failed Suppliers**: 18 suppliers with 0 products cleaned up ✅
- **Duplicate Data**: Database cleanup completed ✅

### Current Limitations
- Large PDF files (>20MB) may require chunking
- Complex Excel formulas need manual review
- OCR accuracy depends on image quality

## 📞 Support

### Common Operations
```bash
# Check server status
ssh root@209.38.85.196 "pm2 list"

# View application logs
ssh root@209.38.85.196 "pm2 logs monito-web --lines 20"

# Restart application
ssh root@209.38.85.196 "pm2 restart monito-web"
```

### Contact & Issues
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: See docs/ directory
- **Email**: Technical support available

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Follow TypeScript and ESLint rules
4. Write tests for new features
5. Update documentation
6. Submit pull request

## 📝 License

This project is proprietary software developed for Indonesian HORECA market price monitoring.

---

<div align="center">
  
  **Production Ready** ✅ | **3,183 Products** 📊 | **31 Suppliers** 🏪 | **Real-time Analytics** 📈
  
  Made with ❤️ for the Indonesian HORECA industry
  
</div>

**Last Updated**: July 7, 2025  
**Version**: 2.0.0  
**Status**: Production Deployed ✅