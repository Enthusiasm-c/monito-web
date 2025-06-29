# Quick Start Guide - Monito Web

🚀 **Get up and running with Monito Web in 10 minutes**

## What is Monito Web?

Monito Web is an AI-powered system that automatically extracts product information from supplier price lists (PDF, Excel, images) and helps you manage pricing data efficiently. Think of it as a smart assistant that can read any price list and turn it into structured data.

## 🎯 Quick Demo

1. **Upload a price list** (PDF, Excel, or image)
2. **AI automatically extracts** products, prices, and units
3. **Review and approve** the data in a user-friendly interface
4. **Products are saved** to your database for analysis

## 🏃‍♂️ 5-Minute Setup (Development)

### Prerequisites
```bash
# Check you have these installed
node --version    # Should be 20+
npm --version     # Should be 9+
python3 --version # Should be 3.12+
```

### Quick Installation

1. **Clone and Install**
```bash
git clone <your-repo-url>
cd monito-web
npm install
```

2. **Setup Environment**
```bash
cp .env.example .env
# Edit .env with your API keys (see configuration below)
```

3. **Database Setup**
```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed  # Optional: adds sample data
```

4. **Start Development**
```bash
npm run dev
```

Visit `http://localhost:3000` - you're ready to go! 🎉

## ⚙️ Essential Configuration

### Minimum Required Setup

Add these to your `.env` file:

```env
# Database (use your own or try Neon free tier)
DATABASE_URL="postgresql://user:pass@host/db"

# OpenAI for AI processing (required)
OPENAI_API_KEY="sk-proj-your-key-here"

# Basic auth (change these!)
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Enable AI Vision (this is the magic!)
AI_VISION_ENABLED=true
PRIORITIZE_AI_VISION=true
```

### Get Your API Keys

**OpenAI API Key** (Required):
1. Go to [OpenAI API](https://platform.openai.com/api-keys)
2. Create account and add payment method
3. Generate new API key
4. Add to `.env` as `OPENAI_API_KEY`

**Database** (Required):
- **Easy option**: [Neon](https://neon.tech) - free tier available
- **Local option**: Install PostgreSQL locally

## 📖 How to Use

### For Suppliers (Upload Interface)

1. **Access Upload Page**
   - Go to `http://localhost:3000`
   - Select your supplier from dropdown
   - If your supplier isn't listed, you'll need admin access to add them

2. **Upload Your Price List**
   ```
   Supported formats:
   📄 PDF price lists
   📊 Excel spreadsheets (.xlsx, .xls, .csv)
   🖼️ Images (JPG, PNG) of menus or price lists
   ```

3. **Monitor Processing**
   - Upload starts automatically
   - Progress shown in real-time
   - Usually completes in 15-60 seconds

### For Administrators (Admin Panel)

1. **Access Admin Panel**
   - Go to `http://localhost:3000/admin/login`
   - Default credentials: `admin` / `admin123` (change these!)

2. **Review Uploads**
   - Navigate to "Upload Management"
   - See all pending uploads waiting for review

3. **Use Preview Mode**
   - Click "Preview" on any upload
   - **Left side**: Original file viewer
   - **Right side**: Extracted data with quality indicators
   - ✅ Green = good data, 🟡 Yellow = warnings, 🔴 Red = issues

4. **Approve or Reject**
   - **Approve**: Creates products in your database
   - **Reject**: Archives the upload
   - **Reprocess**: Try extraction again if it failed

## 🎨 Interface Overview

### Upload Dashboard
```
┌─────────────────────────────────────────┐
│  📊 Upload Statistics                   │
│  Pending: 3 | Processed: 15 | Cost: $2 │
├─────────────────────────────────────────┤
│  📋 Recent Uploads                      │
│  • Bali Organics.pdf - Processing...   │
│  • Jakarta Market.xlsx - Completed ✅  │
│  • Menu Items.jpg - Needs Review 📋    │
└─────────────────────────────────────────┘
```

### Admin Preview Mode
```
┌─────────────────────┬─────────────────────┐
│   📄 Original File   │  📊 Extracted Data  │
├─────────────────────┼─────────────────────┤
│                     │  Product Name | Price│
│   [PDF Viewer]      │  ✅ Rice 1kg  │ $2.50│
│   [Page 1 of 3]     │  🟡 Sugar     │ $1.20│
│                     │  🔴 (empty)   │ $0.00│
│                     │                     │
│   📄 📄 📄          │  [Approve] [Reject] │
└─────────────────────┴─────────────────────┘
```

## 🧪 Test the System

### Sample Test Files

Create these test files to try the system:

**sample_pricelist.csv**:
```csv
Product Name,Price,Unit
Rice Premium,2.50,kg
Sugar White,1.20,kg
Cooking Oil,3.00,liter
```

**Or use these test scenarios**:
1. **PDF**: Any restaurant menu or price list PDF
2. **Excel**: Any spreadsheet with products and prices
3. **Image**: Photo of a menu or handwritten price list

### Expected Results

After uploading, you should see:
- ✅ **Processing Status**: Upload progresses from "Queued" → "Processing" → "Completed"
- ✅ **Data Extraction**: Products appear in preview with prices and units
- ✅ **Quality Indicators**: Color-coded quality scores for each item

## 🚨 Common Issues & Solutions

### "Upload Stuck in Processing"
```bash
# Check if AI Vision is enabled
echo $AI_VISION_ENABLED  # Should be "true"

# Reprocess the upload via admin panel
# Or use API: POST /api/admin/uploads/reprocess
```

### "No Products Extracted"
- ✅ Check file format (PDF/Excel/Image)
- ✅ Ensure file contains clear product information
- ✅ Try reprocessing with different file format
- ✅ Check OpenAI API key is valid

### "AI Vision Not Working"
```bash
# Install Python dependencies
pip3 install PyMuPDF Pillow aiohttp

# Check environment variables
echo $OPENAI_API_KEY
echo $AI_VISION_ENABLED
echo $PRIORITIZE_AI_VISION
```

### "Admin Login Not Working"
- Default credentials: `admin` / `admin123`
- Check `NEXTAUTH_SECRET` is set in `.env`
- Try clearing browser cookies

## 📱 Mobile Usage

The system works on mobile browsers:
- ✅ **Upload**: Mobile photo upload works
- ✅ **Review**: Responsive admin interface
- ✅ **Processing**: All features available on mobile

## 🔧 Production Deployment

### Quick Production Setup

1. **Get a Server** (Ubuntu 20.04+ recommended)
2. **Install Dependencies**
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 for process management
sudo npm install -g pm2

# Python dependencies
pip3 install PyMuPDF Pillow aiohttp
```

3. **Deploy Application**
```bash
# Clone your repo
git clone <your-repo> /opt/monito-web
cd /opt/monito-web

# Install and build
npm install
npm run build

# Start with PM2
pm2 start npm --name "monito-web" -- start
pm2 save
pm2 startup
```

4. **Configure Environment**
```bash
# Copy production environment
cp .env.example .env
# Edit with production values

# Run database migrations
npx prisma migrate deploy
```

## 📊 Understanding Costs

### AI Processing Costs

**Typical costs per upload**:
- **PDF (5 pages)**: $0.02 - $0.05
- **Excel (100 products)**: $0.01 - $0.02
- **Image**: $0.01 - $0.03

**Monthly estimates**:
- **Small business** (50 uploads/month): $1-3
- **Medium business** (200 uploads/month): $5-15
- **Large business** (1000 uploads/month): $20-50

### Optimization Tips

- Use `AI_VISION_MAX_PAGES=5` to limit PDF pages processed
- Set `PRIORITIZE_AI_VISION=false` for Excel-heavy workflows
- Monitor costs in admin dashboard

## 🎯 Next Steps

### Once You're Running

1. **Add Your Suppliers**
   - Go to Admin → Suppliers
   - Add your actual supplier information

2. **Upload Real Data**
   - Start with your most common price lists
   - Review and approve to build your database

3. **Explore Analytics**
   - Check price history tracking
   - Monitor processing statistics
   - Review data quality metrics

4. **Customize Settings**
   - Adjust AI processing parameters
   - Configure approval workflows
   - Set up quality thresholds

### Integration Options

- **API Access**: Full REST API for integration
- **Webhooks**: Get notified when uploads complete
- **Data Export**: Export processed data in various formats
- **Bulk Operations**: Batch processing capabilities

## 🆘 Getting Help

### Documentation
- **Complete Guide**: `/docs/AI_VISION_PROCESSING_GUIDE.md`
- **System Overview**: `/docs/SYSTEM_OVERVIEW.md`
- **API Reference**: Built-in Swagger docs at `/api/docs`

### Support Channels
- **GitHub Issues**: For bugs and feature requests
- **Documentation**: Comprehensive guides in `/docs` folder
- **Code Examples**: Check `/examples` directory

### Common Resources
- **Sample Files**: Use for testing different formats
- **Configuration Examples**: Pre-built environment configs
- **Troubleshooting Scripts**: Automated diagnostic tools

---

🎉 **You're ready to start processing price lists with AI!**

The system is designed to be intuitive - most users can start extracting data within minutes of setup. The AI handles the complex work of reading and understanding your price lists, while you focus on reviewing and managing your product data.