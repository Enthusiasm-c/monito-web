# Monito Web - AI-Powered Price Monitoring System

🚀 **Advanced price monitoring and product management system with AI-driven data extraction capabilities**

## Overview

Monito Web is a comprehensive solution for automated price list processing and product management. The system uses cutting-edge AI technology to extract product information from various file formats (PDF, Excel, images) and provides a powerful admin interface for data management and supplier relationships.

## 🎯 Key Features

### AI-Powered Data Extraction
- **PDF Processing**: AI Vision technology converts PDF pages to images and extracts product data using OpenAI GPT-4o Vision API
- **Excel Support**: Advanced parsing for .xlsx, .xls, and .csv files with intelligent column mapping
- **Image Recognition**: Direct AI processing of menu images, price lists, and handwritten documents
- **Multi-format Support**: Handles various file types with automatic format detection

### Smart Processing Pipeline
- **Prioritized AI Vision**: PDF files processed through screenshot → AI analysis pipeline for maximum accuracy
- **Parallel Processing**: Multiple pages/items processed simultaneously for optimal performance
- **Quality Validation**: Automated data quality checks with visual indicators
- **Error Recovery**: Intelligent fallback mechanisms and reprocessing capabilities

### Comprehensive Admin Interface
- **Real-time Monitoring**: Live processing status with progress indicators
- **Two-Panel Preview**: Side-by-side view of original files and extracted data
- **Approval Workflow**: Review, approve, or reject uploads with detailed feedback
- **Data Management**: Full CRUD operations for products, suppliers, and pricing data

### Advanced Analytics
- **Price History Tracking**: Monitor price changes over time with visual charts
- **Cost Analysis**: Track AI processing costs and token usage
- **Performance Metrics**: Processing times, success rates, and accuracy measurements
- **Supplier Analytics**: Comprehensive supplier performance and pricing insights

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Prisma ORM, PostgreSQL (Neon)
- **AI Integration**: OpenAI GPT-4o Vision API, Google Gemini
- **File Processing**: Python scripts with PyMuPDF, Pillow
- **Authentication**: NextAuth.js
- **Deployment**: PM2, Ubuntu Server

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File Upload   │ → │  AI Processing   │ → │  Data Storage   │
│                 │    │                  │    │                 │
│ • PDF/Excel     │    │ • Image Convert  │    │ • PostgreSQL    │
│ • Images        │    │ • AI Vision API  │    │ • Product Data  │
│ • Validation    │    │ • Data Extract   │    │ • Price History │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                ↓
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Admin Review   │ ← │  Quality Control │ ← │  Normalization  │
│                 │    │                  │    │                 │
│ • Preview UI    │    │ • Data Quality   │    │ • Price Format  │
│ • Approve/Reject│    │ • Error Detection│    │ • Unit Standard │
│ • Bulk Actions  │    │ • Completeness   │    │ • Name Cleanup  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm
- Python 3.12+ with pip
- PostgreSQL database (Neon recommended)
- OpenAI API key
- Google API key (optional)

### Installation

1. **Clone Repository**
```bash
git clone <repository-url>
cd monito-web
```

2. **Install Dependencies**
```bash
# Node.js dependencies
npm install

# Python dependencies
pip3 install PyMuPDF Pillow aiohttp
```

3. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration (see Configuration section)
```

4. **Database Setup**
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed
```

5. **Start Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## ⚙️ Configuration

### Environment Variables

```env
# Database
DATABASE_URL='postgresql://user:pass@host/db?sslmode=require'

# Authentication
NEXTAUTH_SECRET='your-secret-key'
NEXTAUTH_URL='http://localhost:3000'

# AI APIs
OPENAI_API_KEY='sk-proj-...'
GOOGLE_API_KEY='AIzaSy...'

# AI Vision Settings
AI_VISION_ENABLED=true
PRIORITIZE_AI_VISION=true
USE_ASYNC_AI_EXTRACTION=true
AI_VISION_MAX_PAGES=8

# Processing Configuration
LLM_FALLBACK_ENABLED=true
COMPLETENESS_THRESHOLD_PDF=0.85
MIN_PRODUCTS_FOR_SUCCESS=50
MAX_PRODUCTS_FOR_FALLBACK=150
MAX_FILE_SIZE_MB=10

# Model Settings
LLM_MODEL=gpt-4o
AI_VALIDATION_MODEL=gpt-4o-mini
AI_STANDARDIZATION_ENABLED=true

# Costs (per 1K tokens)
OPENAI_GPT4O_INPUT_COST_PER_1K=0.0025
OPENAI_GPT4O_OUTPUT_COST_PER_1K=0.01
```

### Database Schema

The system uses a robust PostgreSQL schema with the following core models:

- **Upload**: File upload tracking with processing status
- **Product**: Product information with standardized data
- **Supplier**: Supplier management and relationships
- **PriceHistory**: Historical price tracking
- **ProductAlias**: Alternative product names for matching

## 📱 Usage Guide

### For Suppliers

1. **Upload Price Lists**
   - Navigate to upload interface
   - Select supplier from dropdown
   - Upload PDF, Excel, or image files
   - Monitor processing status

2. **Review Results**
   - Check processing completion
   - Review extracted product data
   - Verify accuracy and completeness

### For Administrators

1. **Access Admin Panel**
   - Navigate to `/admin/login`
   - Use admin credentials
   - Access comprehensive dashboard

2. **Manage Uploads**
   - Review pending uploads at `/admin/uploads`
   - Use preview mode to compare original files with extracted data
   - Approve or reject uploads with feedback

3. **Product Management**
   - View all products at `/admin/products`
   - Edit product information and standardized names
   - Manage product aliases and categories

4. **Supplier Management**
   - Monitor supplier activity at `/admin/suppliers`
   - View price history and analytics
   - Manage supplier relationships

## 🔧 API Reference

### Upload APIs

```typescript
// Submit new upload
POST /api/async-upload
Content-Type: multipart/form-data
Body: { supplierId: string, file: File }

// Check upload status
GET /api/admin/uploads/status/{uploadId}

// List pending uploads
GET /api/admin/uploads/pending?page=1&limit=10

// Approve upload
POST /api/admin/uploads/approve
Body: { uploadId: string, approvedBy: string, reviewNotes: string }

// Reject upload
POST /api/admin/uploads/reject
Body: { uploadId: string, rejectedBy: string, rejectionReason: string }

// Reprocess failed upload
POST /api/admin/uploads/reprocess
Body: { uploadId: string }
```

### Product APIs

```typescript
// List products
GET /api/admin/products?page=1&limit=50&search=query

// Get product details
GET /api/admin/products/{id}

// Update product
PUT /api/admin/products/{id}
Body: { name: string, price: number, unit: string, ... }

// Delete product
DELETE /api/admin/products/{id}
```

### Analytics APIs

```typescript
// Price history
GET /api/admin/price-history?productId={id}&days=30

// Processing statistics
GET /api/stats

// Token usage tracking
GET /api/token-usage
```

## 🎨 Admin Interface Features

### Upload Management
- **Real-time Status**: Live processing updates with progress bars
- **Preview Mode**: Two-panel view showing original file and extracted data
- **Quality Indicators**: Visual feedback on data quality and completeness
- **Bulk Operations**: Process multiple uploads simultaneously

### Data Visualization
- **Price Charts**: Historical price trends with interactive graphs
- **Processing Metrics**: Token usage, costs, and performance statistics
- **Supplier Analytics**: Comprehensive supplier performance dashboards

### Advanced Features
- **Inline Editing**: Direct data modification in preview mode
- **Smart Validation**: Automated quality checks with suggestions
- **Export Capabilities**: Data export in multiple formats
- **Search and Filtering**: Advanced search across all data types

## 🧪 Testing

### Automated Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests with Playwright
npm run test:e2e

# Production deployment tests
npm run test:production
```

### Test Coverage

- Upload processing workflows
- AI Vision extraction accuracy
- Admin interface functionality
- API endpoint validation
- Authentication and authorization
- Data integrity and validation

## 🚀 Deployment

### Production Deployment

1. **Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Python dependencies
pip3 install --break-system-packages PyMuPDF Pillow aiohttp
```

2. **Application Deployment**
```bash
# Clone and setup
git clone <repository-url> /opt/monito-web
cd /opt/monito-web
npm install
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

3. **Environment Setup**
```bash
# Copy production environment
cp .env.production .env

# Run database migrations
npx prisma migrate deploy
```

### Health Monitoring

```bash
# Check application status
pm2 status

# View logs
pm2 logs monito-web

# Monitor resources
pm2 monit
```

## 📊 Performance Optimization

### AI Processing Optimization
- **Parallel Processing**: Multiple pages processed simultaneously
- **Smart Batching**: Optimal batch sizes for AI API calls
- **Rate Limiting**: Intelligent API rate limit management
- **Caching**: Processed data caching for repeated requests

### Database Optimization
- **Indexing**: Optimized database indexes for fast queries
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Optimized Prisma queries with proper relations

### Frontend Optimization
- **Code Splitting**: Optimized bundle sizes with Next.js
- **Image Optimization**: Automatic image optimization and lazy loading
- **Caching Strategy**: Efficient client-side and server-side caching

## 🔒 Security

### Data Protection
- **Input Validation**: Comprehensive input sanitization
- **File Validation**: Secure file upload with type checking
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **XSS Protection**: React's built-in XSS protection

### Authentication & Authorization
- **Secure Sessions**: NextAuth.js with secure session management
- **Role-based Access**: Admin-only routes with proper authorization
- **API Security**: Protected API endpoints with authentication middleware

### Infrastructure Security
- **HTTPS**: SSL/TLS encryption for all communications
- **Environment Variables**: Secure configuration management
- **Regular Updates**: Dependency updates and security patches

## 🐛 Troubleshooting

### Common Issues

#### Upload Processing Stuck
```bash
# Check processing status
curl http://your-domain:3000/api/admin/uploads/status/{uploadId}

# Reprocess stuck upload
curl -X POST http://your-domain:3000/api/admin/uploads/reprocess \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "your-upload-id"}'
```

#### AI Vision Not Working
```bash
# Verify environment variables
echo $AI_VISION_ENABLED
echo $OPENAI_API_KEY

# Check Python dependencies
python3 -c "import fitz, PIL, aiohttp; print('Dependencies OK')"

# Test AI Vision script
python3 scripts/async_pdf_image_extractor.py test.pdf
```

#### Database Connection Issues
```bash
# Test database connection
npx prisma db push

# Check connection string
echo $DATABASE_URL

# Verify migrations
npx prisma migrate status
```

### Performance Issues

#### High AI Processing Costs
- Adjust `AI_VISION_MAX_PAGES` to limit pages processed
- Use `gpt-4o-mini` for cost optimization
- Implement preprocessing to filter relevant pages

#### Slow Upload Processing
- Increase concurrent processing limits
- Optimize image compression settings
- Monitor and adjust rate limiting parameters

## 📈 Monitoring and Analytics

### System Metrics
- Processing success rates and error rates
- AI API usage and costs tracking
- Database performance metrics
- Server resource utilization

### Business Metrics
- Upload volume and processing times
- Data quality scores and completeness
- Supplier activity and engagement
- Cost per processed item

## 🤝 Contributing

### Development Workflow

1. **Fork Repository**
2. **Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

3. **Make Changes**
4. **Run Tests**
```bash
npm run test
npm run lint
```

5. **Submit Pull Request**

### Code Standards
- TypeScript for type safety
- ESLint and Prettier for code formatting
- Comprehensive test coverage
- Clear documentation and comments

## 📝 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🆘 Support

For technical support, bug reports, or feature requests:

1. **GitHub Issues**: Create detailed issue reports
2. **Documentation**: Check the comprehensive docs in `/docs` folder
3. **Code Examples**: Review examples in `/examples` folder

## 🙏 Acknowledgments

- OpenAI for GPT-4o Vision API
- Vercel for Next.js framework
- Neon for PostgreSQL hosting
- PyMuPDF for PDF processing capabilities

---

**Built with ❤️ for efficient price monitoring and supplier management**