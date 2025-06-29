# Monito Web Database Backup

## 📁 Backup Files

- **production-backup-20250627-130117.json** - Full production database backup (12.9 MB)
- **restore-production-backup.js** - Restoration script
- **verify-backup.js** - Backup verification script

## 📊 Backup Contents

- **18 suppliers** with complete contact information
- **2,043 products** with categories, units, and pricing
- **2,819 price history records** 
- **29 upload records** with processing metadata
- **2 admin users** (admin and manager accounts)

## 🔧 Usage Instructions

### 1. Verify Backup Integrity
```bash
node verify-backup.js production-backup-20250627-130117.json
```

### 2. Restore to Database
```bash
# Make sure DATABASE_URL is set in .env file
node restore-production-backup.js production-backup-20250627-130117.json
```

### 3. Alternative Restore
```bash
# Use custom backup file
node restore-production-backup.js path/to/your/backup.json
```

## ⚠️ Important Notes

1. **Database Clearing**: The restoration script will **DELETE ALL EXISTING DATA** before importing the backup
2. **Environment**: Ensure the target database URL is configured in `.env` 
3. **Dependencies**: Run `npm install` to ensure all required packages are installed
4. **Backup Source**: This backup was created from the Neon production database on 2025-06-27

## 📈 Data Structure

### Suppliers
- Pricelist - Global (121 prices)
- Sri_vegetables (230 prices) 
- Bali_seafood (96 prices)
- Island Organics Bali (412 prices)
- Widi Wiguna (410 prices)
- And 13 more suppliers...

### Products by Category
- **Grains**: Ciabatta, Baguette, Bagel, Sourdough, etc.
- **Meat**: Beef Pepperoni, Chicken products, etc.
- **Vegetables**: Various fresh produce
- **Dairy**: Cheese, milk products
- **Seafood**: Fish and marine products
- **Fruits**: Fresh fruits and produce

### Price Range
- Minimum: Rp 7
- Maximum: Rp 4,500,000,000
- Average prices across multiple suppliers

## 🚀 Post-Restoration

After successful restoration:
1. Start the application: `npm run dev`
2. Access admin panel: `http://localhost:3000/admin`
3. Login with: admin@monito-web.com / admin123
4. Verify all data is properly loaded

## 📞 Support

If you encounter issues with restoration:
1. Check that Prisma schema matches the backup data structure
2. Ensure database connection is working
3. Verify all required environment variables are set
4. Check that the backup file is not corrupted

## 🎯 Backup Creation Date
**2025-06-27 04:58:42 UTC** - Production Neon Database