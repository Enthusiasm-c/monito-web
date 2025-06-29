# Monito Web - Deployment Guide

## 🚀 Production Deployment Information

### Current Production Environment
- **Server IP**: 209.38.85.196
- **Port**: 3000
- **URL**: http://209.38.85.196:3000
- **Process Manager**: PM2 (Process ID: 0)
- **Database**: Neon PostgreSQL

## 📋 Pre-Deployment Requirements

### System Requirements
- **Node.js**: 18.x or higher
- **npm**: 8.x or higher
- **PM2**: Latest version for process management
- **Git**: For code deployment
- **PostgreSQL**: Database access (Neon)

### Required Environment Variables
```env
# Database Configuration
DATABASE_URL=postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# NextAuth Configuration
NEXTAUTH_SECRET=super-secret-key-for-monito-web-production-environment-12345
NEXTAUTH_URL=http://209.38.85.196:3000

# API Keys
OPENAI_API_KEY=your-openai-api-key-here
GOOGLE_API_KEY=your-google-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_CdC1W79sSc4kG6XH_0rwrKGEkY1DR2hOzVosHMJe1zRZzE0

# Bot API
BOT_API_KEY=test-bot-api-key-123456
```

## 🏗️ Initial Server Setup

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo apt install git -y
```

### 2. Application Deployment
```bash
# Navigate to deployment directory
cd /opt

# Clone repository
sudo git clone <repository-url> monito-web
cd monito-web

# Set permissions
sudo chown -R $USER:$USER /opt/monito-web

# Install dependencies
npm install --production

# Set up environment variables
cp .env.example .env
# Edit .env with production values

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy
```

### 3. Build Application
```bash
# Build production version
npm run build

# Test the build
npm start
# Verify at http://server-ip:3000
```

## 🔄 PM2 Process Management

### Start Application with PM2
```bash
# Start the application
pm2 start npm --name "monito-web" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions to set up auto-start
```

### PM2 Management Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs monito-web

# Restart application
pm2 restart monito-web

# Stop application
pm2 stop monito-web

# Monitor in real-time
pm2 monit

# View detailed info
pm2 show monito-web
```

## 🗃️ Database Setup

### Neon PostgreSQL Configuration
```bash
# Database URL format
postgresql://username:password@host:port/database?sslmode=require

# Current production database
postgresql://neondb_owner:npg_h6GaENYK1qSs@ep-summer-shape-a1r1yz39-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

### Database Migrations
```bash
# Apply migrations
npx prisma migrate deploy

# Reset database (if needed)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate

# View database
npx prisma studio
```

### Creating Admin Users
```bash
# Run admin user creation script
node scripts/update-admin-password.js

# This creates:
# - admin@monito-web.com / admin123
# - manager@monito-web.com / manager123
```

## 🔐 Security Configuration

### Firewall Setup
```bash
# Allow SSH (if needed)
sudo ufw allow 22

# Allow HTTP
sudo ufw allow 3000

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### SSL/HTTPS Setup (Optional)
```bash
# Install Certbot
sudo apt install certbot

# Generate SSL certificate (requires domain)
sudo certbot certonly --standalone -d your-domain.com

# Update NEXTAUTH_URL in .env
NEXTAUTH_URL=https://your-domain.com
```

## 📊 Monitoring & Logging

### PM2 Monitoring
```bash
# Real-time monitoring
pm2 monit

# Log rotation setup
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Application Logs
```bash
# View application logs
pm2 logs monito-web --lines 100

# View error logs only
pm2 logs monito-web --err

# Follow logs in real-time
pm2 logs monito-web --follow
```

### System Monitoring
```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check PM2 process
pm2 status
```

## 🔄 Deployment Updates

### Code Updates
```bash
# Navigate to application directory
cd /opt/monito-web

# Pull latest changes
git pull origin main

# Install new dependencies
npm install --production

# Rebuild application
npm run build

# Restart PM2 process
pm2 restart monito-web

# Check status
pm2 status
```

### Database Updates
```bash
# Apply new migrations
npx prisma migrate deploy

# Generate updated Prisma client
npx prisma generate

# Restart application
pm2 restart monito-web
```

## 💾 Backup Procedures

### Automated Database Backup
```bash
# Create backup script
cat > /opt/monito-web/backup-database.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function createBackup() {
  const prisma = new PrismaClient();
  // ... backup logic
  await prisma.$disconnect();
}

createBackup().catch(console.error);
EOF

# Make executable
chmod +x /opt/monito-web/backup-database.js

# Run backup
node /opt/monito-web/backup-database.js
```

### Scheduled Backups (Cron)
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /opt/monito-web && node backup-database.js

# Add weekly full backup
0 3 * * 0 cd /opt/monito-web && node restore-production-backup.js
```

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
pm2 logs monito-web

# Check environment variables
cat /opt/monito-web/.env

# Verify database connection
cd /opt/monito-web && npx prisma db pull
```

#### Database Connection Issues
```bash
# Test database connection
cd /opt/monito-web
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.supplier.count().then(console.log).catch(console.error).finally(() => prisma.\$disconnect());
"
```

#### Memory Issues
```bash
# Check memory usage
free -h

# Restart PM2 process
pm2 restart monito-web

# Clear PM2 logs
pm2 flush
```

### Performance Optimization
```bash
# Enable PM2 cluster mode
pm2 start ecosystem.config.js

# Monitor performance
pm2 monit

# Optimize Node.js memory
pm2 start npm --name "monito-web" -- start --node-args="--max-old-space-size=2048"
```

## 📋 Health Checks

### Application Health
```bash
# Check if application is responding
curl http://209.38.85.196:3000

# Check API endpoints
curl http://209.38.85.196:3000/api/health

# Check admin panel
curl http://209.38.85.196:3000/admin
```

### Database Health
```bash
# Check database connection
cd /opt/monito-web
npx prisma db pull

# Count records
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([
  prisma.supplier.count(),
  prisma.product.count(),
  prisma.price.count()
]).then(([suppliers, products, prices]) => {
  console.log('Suppliers:', suppliers);
  console.log('Products:', products);
  console.log('Prices:', prices);
}).finally(() => prisma.\$disconnect());
"
```

## 📞 Support Contacts

### Production Environment
- **Server**: 209.38.85.196:3000
- **Database**: Neon PostgreSQL
- **Process**: PM2 (monito-web)
- **Logs**: `/root/.pm2/logs/`

### Emergency Procedures
1. **Application Down**: `pm2 restart monito-web`
2. **Database Issues**: Check Neon console
3. **High Memory Usage**: `pm2 restart monito-web`
4. **SSL Issues**: Check certificate expiration

---

## ✅ Deployment Checklist

- [ ] Server preparation complete
- [ ] Environment variables configured
- [ ] Database connection verified
- [ ] Application built successfully
- [ ] PM2 process started
- [ ] Admin users created
- [ ] Health checks passing
- [ ] Backup procedures implemented
- [ ] Monitoring configured
- [ ] SSL/Security configured (if needed)

**Production Status**: ✅ **DEPLOYED AND OPERATIONAL**