# Operational Guide - Monito-Web

## System Operations & Maintenance

### Daily Operations

#### 1. System Health Check

```bash
# Check server status
curl http://localhost:3000/api/health

# Verify database connectivity
npx prisma migrate status

# Check processing queue
npx prisma studio
# Navigate to uploads table, check for stuck "processing" status

# Monitor recent uploads
curl http://localhost:3000/api/uploads/status?limit=10
```

#### 2. Cost Monitoring

```bash
# Check daily AI costs
curl http://localhost:3000/api/token-usage

# Monitor token usage trends
tail -n 100 logs/processing.log | grep "Cost:"

# Alert if daily costs exceed threshold
DAILY_COST=$(curl -s http://localhost:3000/api/token-usage | jq '.last24Hours.cost')
if (( $(echo "$DAILY_COST > 5.0" | bc -l) )); then
  echo "ALERT: Daily cost $DAILY_COST exceeds $5.00 limit"
fi
```

#### 3. Performance Monitoring

```bash
# Check average processing times
grep "processingTimeMs" logs/processing.log | tail -20

# Monitor success rates
grep "status.*completed" logs/processing.log | wc -l
grep "status.*failed" logs/processing.log | wc -l

# Check for stuck processes
ps aux | grep "enhanced_pdf_processor"
```

### Weekly Operations

#### 1. Database Maintenance

```sql
-- Check database size and growth
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  most_common_vals
FROM pg_stats 
WHERE schemaname = 'public';

-- Cleanup old processing logs (keep last 30 days)
DELETE FROM uploads 
WHERE status = 'failed' 
AND updatedAt < NOW() - INTERVAL '30 days';

-- Analyze frequently queried tables
ANALYZE products, prices, suppliers, uploads;
```

#### 2. System Cleanup

```bash
# Clean temporary files
find /tmp -name "tmp*pdf" -mtime +1 -delete
find /tmp -name "*_page_*.jpg" -mtime +1 -delete

# Rotate processing logs
if [ -f logs/processing.log ]; then
  mv logs/processing.log "logs/processing.$(date +%Y%m%d).log"
  touch logs/processing.log
fi

# Archive old logs (keep last 4 weeks)
find logs/ -name "processing.*.log" -mtime +28 -delete
```

#### 3. Performance Analysis

```bash
# Analyze processing patterns
python3 << EOF
import json
import statistics

# Read processing logs
costs = []
times = []
completeness = []

with open('logs/processing.log', 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            costs.append(data.get('costUsd', 0))
            times.append(data.get('processingTimeMs', 0))
            completeness.append(data.get('completenessRatio', 0))
        except:
            continue

if costs:
    print(f"Weekly Cost Analysis:")
    print(f"  Total Cost: ${sum(costs):.4f}")
    print(f"  Average Cost per File: ${statistics.mean(costs):.4f}")
    print(f"  Max Cost per File: ${max(costs):.4f}")
    
if times:
    print(f"Weekly Performance Analysis:")
    print(f"  Average Processing Time: {statistics.mean(times)/1000:.1f}s")
    print(f"  Max Processing Time: {max(times)/1000:.1f}s")
    
if completeness:
    print(f"Weekly Quality Analysis:")
    print(f"  Average Completeness: {statistics.mean(completeness)*100:.1f}%")
    print(f"  Min Completeness: {min(completeness)*100:.1f}%")
EOF
```

### Monthly Operations

#### 1. Configuration Review

```bash
# Review current configuration
echo "Current AI Configuration:"
echo "LLM_FALLBACK_ENABLED: ${LLM_FALLBACK_ENABLED}"
echo "AI_VISION_ENABLED: ${AI_VISION_ENABLED}"
echo "AI_STANDARDIZATION_ENABLED: ${AI_STANDARDIZATION_ENABLED}"
echo "AI_VALIDATION_ENABLED: ${AI_VALIDATION_ENABLED}"

# Analyze cost vs quality trade-offs
python3 << EOF
# Cost-benefit analysis script
import json
from collections import defaultdict

monthly_stats = defaultdict(list)

# Process monthly logs
with open('logs/processing.log', 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            month = data['timestamp'][:7]  # YYYY-MM
            monthly_stats[month].append(data)
        except:
            continue

for month, records in monthly_stats.items():
    total_cost = sum(r.get('costUsd', 0) for r in records)
    avg_completeness = sum(r.get('completenessRatio', 0) for r in records) / len(records)
    total_files = len(records)
    
    print(f"{month}: ${total_cost:.2f} cost, {avg_completeness*100:.1f}% completeness, {total_files} files")
EOF
```

#### 2. Database Optimization

```sql
-- Monthly database statistics
SELECT 
  'uploads' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  AVG(completenessRatio) as avg_completeness,
  AVG(processingTimeMs) as avg_processing_time_ms
FROM uploads
WHERE createdAt >= DATE_TRUNC('month', CURRENT_DATE)

UNION ALL

SELECT 
  'products' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT category) as categories,
  COUNT(DISTINCT standardizedUnit) as units,
  0 as avg_completeness,
  0 as avg_processing_time_ms
FROM products

UNION ALL

SELECT 
  'prices' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN validTo IS NULL THEN 1 END) as active_prices,
  COUNT(CASE WHEN validTo IS NOT NULL THEN 1 END) as historic_prices,
  0 as avg_completeness,
  0 as avg_processing_time_ms
FROM prices;

-- Clean up old price history (keep last 6 months)
DELETE FROM prices 
WHERE validTo IS NOT NULL 
AND validTo < NOW() - INTERVAL '6 months';

-- Update table statistics
VACUUM ANALYZE;
```

## Troubleshooting Procedures

### Problem: Server Crashes During Processing

#### Symptoms:
- Processing stops at specific point
- Server becomes unresponsive
- Memory usage spikes

#### Diagnosis:
```bash
# Check system resources
free -h
df -h
top -p $(pgrep node)

# Check for memory leaks
ps aux --sort=-%mem | head -10

# Check processing logs for patterns
grep "Processed.*products" logs/processing.log | tail -20
```

#### Resolution:
```bash
# Immediate fix: Restart server
pkill -f "node.*dev"
npm run dev

# Long-term fix: Reduce AI processing
# Edit .env file
AI_STANDARDIZATION_ENABLED=false
MAX_AI_STANDARDIZATION_PRODUCTS=10
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=100

# Clean up stuck uploads
npx prisma studio
# Manually change status from "processing" to "failed" for stuck uploads
```

### Problem: High AI Costs

#### Symptoms:
- Daily costs exceed budget
- Token usage spikes
- Unexpected API charges

#### Diagnosis:
```bash
# Check cost breakdown
curl http://localhost:3000/api/token-usage

# Analyze expensive files
grep "costUsd.*[1-9]" logs/processing.log | tail -10

# Check AI feature usage
grep "AI.*Standardization\|AI.*Vision\|AI.*Validation" logs/processing.log | tail -20
```

#### Resolution:
```bash
# Immediate cost reduction
cat > .env.cost_reduced << EOF
# Disable expensive features
AI_VISION_ENABLED=false
AI_STANDARDIZATION_ENABLED=false
LLM_FALLBACK_ENABLED=false

# Keep only validation (cheap)
AI_VALIDATION_ENABLED=true
AI_VALIDATION_MODEL=gpt-4o-mini

# Strict limits
MAX_AI_STANDARDIZATION_PRODUCTS=0
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=50
EOF

# Apply cost-reduced configuration
cp .env.cost_reduced .env

# Monitor next day's costs
```

### Problem: Poor Extraction Quality

#### Symptoms:
- Low completeness ratios (<50%)
- Many failed extractions
- Missing products from files

#### Diagnosis:
```bash
# Check recent extraction quality
grep "completenessRatio" logs/processing.log | tail -20

# Identify problematic file types
grep "failed\|low completeness" logs/processing.log | grep -o "[^/]*\\.pdf\\|[^/]*\\.xlsx"

# Check extraction methods used
grep "bestMethod\|extractionMethods" logs/processing.log | tail -10
```

#### Resolution:
```bash
# Enable more extraction methods
cat > .env.quality_focused << EOF
# Enable all extraction methods
LLM_FALLBACK_ENABLED=true
AI_VISION_ENABLED=true

# Lower thresholds to trigger fallbacks
COMPLETENESS_THRESHOLD_PDF=0.70
MIN_PRODUCTS_FOR_SUCCESS=20

# Allow more AI processing
MAX_PRODUCTS_FOR_FALLBACK=200
AI_VISION_MAX_PAGES=8
EOF

# Apply quality-focused configuration
cp .env.quality_focused .env

# Reprocess failed files
python3 << EOF
import requests

# Get failed uploads
response = requests.get('http://localhost:3000/api/uploads/status?limit=50')
uploads = response.json()

failed_uploads = [u for u in uploads['uploads'] if u['status'] == 'failed']
print(f"Found {len(failed_uploads)} failed uploads to reprocess")

# Note: Manual reprocessing would require additional API endpoint
EOF
```

### Problem: Slow Processing

#### Symptoms:
- Files take >2 minutes to process
- Processing queue backs up
- Timeouts occur

#### Diagnosis:
```bash
# Check processing times
grep "processingTimeMs" logs/processing.log | tail -20 | awk -F'"processingTimeMs":' '{print $2}' | awk -F',' '{print $1/1000 "s"}'

# Identify slow operations
grep "AI.*Standardization\|AI.*Vision" logs/processing.log | grep -o "[0-9]*ms"

# Check system load
uptime
iostat 1 5
```

#### Resolution:
```bash
# Speed-optimized configuration
cat > .env.speed_focused << EOF
# Disable slow AI features
AI_STANDARDIZATION_ENABLED=false
AI_VISION_ENABLED=false

# Keep fast features only
AI_VALIDATION_ENABLED=true
LLM_FALLBACK_ENABLED=false

# Reduce processing scope
MAX_AI_STANDARDIZATION_PRODUCTS=0
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=0
MAX_FILE_SIZE_MB=5

# Faster timeouts
PROCESSING_TIMEOUT_MS=120000
EOF

# Apply speed-focused configuration
cp .env.speed_focused .env

# Process queue manually if needed
# Check uploads with "processing" status and reset them
```

## Backup and Recovery

### Database Backup

```bash
# Daily database backup
pg_dump $DATABASE_URL > "backups/monito_$(date +%Y%m%d).sql"

# Compress old backups
find backups/ -name "*.sql" -mtime +1 -exec gzip {} \;

# Clean old backups (keep 30 days)
find backups/ -name "*.sql.gz" -mtime +30 -delete

# Weekly full backup with schema
pg_dump --schema-only $DATABASE_URL > "backups/schema_$(date +%Y%m%d).sql"
```

### Configuration Backup

```bash
# Backup current configuration
cp .env "backups/env_$(date +%Y%m%d)"

# Backup processing logs
tar -czf "backups/logs_$(date +%Y%m%d).tar.gz" logs/

# Create system snapshot
cat > "backups/system_snapshot_$(date +%Y%m%d).txt" << EOF
Date: $(date)
Node Version: $(node --version)
NPM Version: $(npm --version)
Python Version: $(python3 --version)
System: $(uname -a)
Disk Usage: $(df -h /)
Memory: $(free -h)
Current Config:
$(cat .env | grep -v "API_KEY\|TOKEN")
EOF
```

### Recovery Procedures

#### Database Recovery
```bash
# Restore from backup
psql $DATABASE_URL < backups/monito_20240115.sql

# Reset database migrations
npx prisma migrate reset --force
npx prisma migrate deploy
npx prisma generate
```

#### Configuration Recovery
```bash
# Restore known good configuration
cp backups/env_20240115 .env

# Restart services
npm run dev

# Verify system health
curl http://localhost:3000/api/health
```

## Performance Optimization

### Database Query Optimization

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_standardized_name 
ON products(standardizedName);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prices_valid_current 
ON prices(productId, supplierId) WHERE validTo IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uploads_status_date 
ON uploads(status, createdAt);

-- Update table statistics
ANALYZE products, prices, suppliers, uploads;
```

### Application Performance Tuning

```javascript
// Optimize Prisma queries
const prisma = new PrismaClient({
  log: ['query', 'slow_query'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=30'
    }
  }
});

// Enable query batching
const products = await prisma.product.findMany({
  include: {
    prices: {
      where: { validTo: null },
      take: 1,
      orderBy: { validFrom: 'desc' }
    }
  },
  take: 50
});
```

### File Processing Optimization

```bash
# Optimize Python dependencies
pip install --upgrade camelot-py[cv] pdfplumber pandas

# Set optimal environment variables
export PYTHONUNBUFFERED=1
export PYTHONDONTWRITEBYTECODE=1

# Enable PDF processing optimizations
export CAMELOT_BACKEND=cv2
export PDF_PROCESSING_THREADS=2
```

## Security Procedures

### API Key Rotation

```bash
# Generate new OpenAI API key
# Update .env file
OPENAI_API_KEY=new-key-here

# Test new key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.openai.com/v1/models

# Restart application
npm run dev
```

### Security Audit

```bash
# Check for exposed secrets
grep -r "sk-" . --exclude-dir=node_modules --exclude-dir=.git || echo "No API keys found in code"

# Audit file permissions
find . -name "*.env*" -ls

# Check dependencies for vulnerabilities
npm audit
pip check

# Review access logs (if available)
tail -100 access.log | grep -E "(POST|PUT|DELETE)"
```

### Access Control

```bash
# Monitor upload patterns
grep "upload-smart" logs/processing.log | awk '{print $1, $2}' | sort | uniq -c

# Check for unusual activity
grep "failed\|error" logs/processing.log | tail -20

# Review file sizes
grep "fileSize" logs/processing.log | awk -F'fileSize":' '{print $2}' | awk -F',' '{print $1}' | sort -n | tail -10
```

## Monitoring Setup

### System Metrics Collection

```bash
# Create monitoring script
cat > monitor.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
MEMORY=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
DISK=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

echo "$TIMESTAMP,CPU:${CPU}%,Memory:${MEMORY}%,Disk:${DISK}%" >> system_metrics.log
EOF

chmod +x monitor.sh

# Run every 5 minutes
echo "*/5 * * * * /path/to/monitor.sh" | crontab -
```

### Application Metrics Collection

```bash
# Create app monitoring script
cat > app_monitor.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Check API health
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

# Count processing uploads
PROCESSING=$(curl -s http://localhost:3000/api/uploads/status?limit=100 | jq '.uploads | map(select(.status == "processing")) | length')

# Get token usage
TOKENS=$(curl -s http://localhost:3000/api/token-usage | jq '.last24Hours.tokens // 0')
COST=$(curl -s http://localhost:3000/api/token-usage | jq '.last24Hours.cost // 0')

echo "$TIMESTAMP,Health:$HEALTH,Processing:$PROCESSING,Tokens:$TOKENS,Cost:$COST" >> app_metrics.log
EOF

chmod +x app_monitor.sh

# Run every minute
echo "* * * * * /path/to/app_monitor.sh" | crontab -
```

---

*This operational guide should be customized based on your specific deployment environment and requirements. Update procedures and thresholds as you gain operational experience.*