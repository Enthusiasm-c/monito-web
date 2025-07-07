# Monito Web - Production Deployment Guide

## 🚀 Current Production Status

### Live Environment
- **Server**: 209.38.85.196:3000 ✅ **ONLINE**
- **Process Manager**: PM2 (auto-restart enabled)
- **Database**: Neon PostgreSQL (3,183 products, 31 suppliers)
- **Last Deployment**: July 7, 2025
- **Version**: 2.0.0 (Production Ready)

### Key Features Deployed
- ✅ **Price Analytics API** - Public access (authentication removed)
- ✅ **Interactive Charts** - 6-month price history visualization
- ✅ **July 2025 Data** - Complete supplier integration
- ✅ **Database Cleanup** - Failed uploads and duplicates removed
- ✅ **Auto-restart** - PM2 configured with system startup

## 📋 System Requirements

### Server Specifications
- **OS**: Ubuntu 24.04 LTS
- **Node.js**: 18.x or higher
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 20GB minimum
- **Network**: Public IP with port 3000 accessible

### Required Software
```bash
# Essential packages
- Node.js 18+
- npm 8+
- PM2 (process manager)
- Git (for deployments)
- PostgreSQL client tools
```

## 🔧 Environment Configuration

### Required Environment Variables
```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:xxx@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Authentication
NEXTAUTH_SECRET=super-secret-key-for-monito-web-production-environment-12345
NEXTAUTH_URL=http://209.38.85.196:3000

# AI Services
GEMINI_API_KEY=your-gemini-api-key-here

# Optional: Bot Integration
BOT_API_KEY=test-bot-api-key-123456
```

### Admin Access
```bash
# Default Production Credentials
Email: admin@example.com
Password: admin123

Email: manager@example.com
Password: manager123
```

## 🏗️ Deployment Process

### 1. Fresh Installation
```bash
# Clone repository
git clone https://github.com/Enthusiasm-c/monito-web.git
cd monito-web

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Configure .env with production values

# Database setup
npx prisma generate
npx prisma migrate deploy

# Build application
npm run build

# Start with PM2
pm2 start "npm start" --name monito-web
pm2 save
pm2 startup
```

### 2. Update Existing Deployment
```bash
# Navigate to application directory
cd /root/monito-web

# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Build application
npm run build

# Restart PM2 process
pm2 restart monito-web

# Verify status
pm2 list
```

### 3. Quick Deployment Commands
```bash
# One-line deployment update
cd /root/monito-web && git pull && npm install && npm run build && pm2 restart monito-web

# Health check after deployment
curl -I http://209.38.85.196:3000/api/products?limit=1
curl -I http://209.38.85.196:3000/api/admin/analytics/prices?type=market&limit=1
```

## 📊 Database Management

### Current Database Status
```bash
# Database Statistics (July 2025)
Products: 3,183 active products
Suppliers: 31 verified suppliers  
Price History: Complete 6-month tracking
Categories: Fruits, Vegetables, Dairy, Meat, Seafood
```

### Database Operations
```bash
# Check database health
npx prisma db pull

# Apply migrations
npx prisma migrate deploy

# Reset database (emergency only)
npx prisma migrate reset --force

# View database in browser
npx prisma studio
```

### Key Database Queries
```bash
# Count all records
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([
  prisma.product.count(),
  prisma.supplier.count(),
  prisma.price.count({ where: { validTo: null } })
]).then(([products, suppliers, prices]) => {
  console.log('Products:', products);
  console.log('Suppliers:', suppliers);
  console.log('Active Prices:', prices);
}).finally(() => prisma.\$disconnect());
"
```

## 🔄 PM2 Process Management

### Essential PM2 Commands
```bash
# Check application status
pm2 list

# View real-time logs
pm2 logs monito-web --follow

# View last 50 log lines
pm2 logs monito-web --lines 50

# Restart application
pm2 restart monito-web

# Stop application
pm2 stop monito-web

# Monitor performance
pm2 monit

# Save configuration
pm2 save
```

### PM2 Auto-Start Setup
```bash
# Generate startup script
pm2 startup

# Save current processes
pm2 save

# Test auto-start (reboot server)
sudo reboot
```

## 📈 Monitoring & Health Checks

### Application Health Checks
```bash
# Basic connectivity
curl -f http://209.38.85.196:3000 || echo "Application down"

# API endpoints
curl -f http://209.38.85.196:3000/api/products?limit=1
curl -f http://209.38.85.196:3000/api/admin/analytics/prices?type=market&limit=1

# Database connectivity
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.product.count()
  .then(count => console.log('Database OK:', count, 'products'))
  .catch(err => console.error('Database Error:', err.message))
  .finally(() => prisma.\$disconnect());
"
```

### System Monitoring
```bash
# Check system resources
free -h                    # Memory usage
df -h                      # Disk usage
top                        # CPU usage
ss -tlnp | grep :3000     # Port usage

# PM2 specific monitoring
pm2 monit                  # Real-time monitoring
pm2 info monito-web       # Detailed process info
```

## 🐛 Troubleshooting

### Common Issues & Solutions

#### 1. Application Won't Start
```bash
# Check logs for errors
pm2 logs monito-web --err

# Common causes:
# - Missing .env file
# - Database connection issues
# - Port already in use
# - Node.js version incompatibility

# Solutions:
pm2 delete monito-web
cd /root/monito-web
npm install
npm run build
pm2 start "npm start" --name monito-web
```

#### 2. Price Analytics API Issues
```bash
# Test analytics API
curl "http://209.38.85.196:3000/api/admin/analytics/prices?type=product&productId=product_1751872952666_8p4t7qhb9"

# Expected response: {"success":true,"data":{...}}
# If error: Check database connection and Prisma client
```

#### 3. Database Connection Problems
```bash
# Test database connection
npx prisma db pull

# Check environment variables
cat .env | grep DATABASE_URL

# Restart application with fresh connection
pm2 restart monito-web
```

#### 4. Memory Issues
```bash
# Check memory usage
free -h
pm2 info monito-web

# Restart if high memory usage
pm2 restart monito-web

# Monitor for memory leaks
pm2 monit
```

### Emergency Recovery
```bash
# Complete application restart
pm2 stop monito-web
pm2 delete monito-web
cd /root/monito-web
git pull origin main
npm install
npm run build
pm2 start "npm start" --name monito-web
pm2 save
```

## 🔐 Security & Maintenance

### Security Best Practices
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Check for Node.js updates
node --version
npm --version

# Review PM2 logs for suspicious activity
pm2 logs monito-web --lines 100 | grep -i error
```

### Regular Maintenance Tasks

#### Daily
- Check PM2 status: `pm2 list`
- Monitor application logs: `pm2 logs monito-web --lines 20`
- Verify API endpoints are responding

#### Weekly
- Check disk space: `df -h`
- Review error logs: `pm2 logs monito-web --err --lines 100`
- Test backup/restore procedures

#### Monthly
- Update dependencies: `npm audit fix`
- Check database performance
- Review and rotate logs

## 📊 Performance Optimization

### Current Performance Metrics
- **API Response Time**: <200ms average
- **Database Queries**: Optimized with Prisma
- **Memory Usage**: ~150MB stable
- **CPU Usage**: <5% average load

### Optimization Commands
```bash
# Clear PM2 logs to free space
pm2 flush

# Optimize Node.js memory usage
pm2 restart monito-web --node-args="--max-old-space-size=2048"

# Enable cluster mode (if needed)
pm2 start ecosystem.config.js
```

## 📞 Support & Contacts

### Production Environment Details
- **Server IP**: 209.38.85.196
- **Application Port**: 3000
- **Process Name**: monito-web (PM2)
- **Database**: Neon PostgreSQL (ap-southeast-1)
- **Log Location**: `/root/.pm2/logs/monito-web-*`

### Quick Reference Commands
```bash
# Application status
ssh root@209.38.85.196 "pm2 list"

# View logs remotely
ssh root@209.38.85.196 "pm2 logs monito-web --lines 20"

# Restart application remotely
ssh root@209.38.85.196 "pm2 restart monito-web"

# Check API health remotely
curl http://209.38.85.196:3000/api/products?limit=1
```

## ✅ Recent Updates & Fixes

### July 2025 Deployment
- **Price Analytics Fix**: Removed authentication requirement
- **Apple Fuji Error**: Resolved "Failed to load price analytics"
- **Database Cleanup**: 18 failed suppliers removed
- **Data Integration**: 3,183 products from 31 suppliers
- **Interactive Charts**: Added timeline and comparison views

### Key API Changes
```bash
# Public access enabled for price analytics
GET /api/admin/analytics/prices?type=product&productId=xxx    # ✅ Public
GET /api/admin/analytics/prices?type=market&limit=10          # ✅ Public
GET /api/admin/analytics/prices?type=comparison&productId=xxx # ✅ Public
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Code tested locally
- [ ] Environment variables configured
- [ ] Database migrations prepared
- [ ] Dependencies updated

### Deployment
- [ ] Code pulled from repository
- [ ] Dependencies installed (`npm install`)
- [ ] Application built (`npm run build`)
- [ ] PM2 process restarted
- [ ] Health checks passing

### Post-Deployment
- [ ] Application responding on port 3000
- [ ] API endpoints functional
- [ ] Database queries working
- [ ] Price analytics accessible
- [ ] Monitoring active
- [ ] Logs reviewed

**Current Status**: ✅ **PRODUCTION READY & DEPLOYED**

**Last Updated**: July 7, 2025  
**Deployment Version**: 2.0.0  
**Next Review**: July 14, 2025