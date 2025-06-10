# System Configuration Guide

## Environment Variables Reference

### Core Database & API Settings

```env
# Database Connection (Required)
DATABASE_URL='postgresql://user:pass@host/db?sslmode=require'

# OpenAI API Access (Required)
OPENAI_API_KEY=sk-proj-...

# File Storage (Required)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

### AI Processing Controls

```env
# Master AI Controls
LLM_FALLBACK_ENABLED=false              # Enable AI Vision fallback for PDFs
AI_VISION_ENABLED=false                 # Enable PDF-to-image AI processing
AI_STANDARDIZATION_ENABLED=false        # Enable AI product name standardization
AI_VALIDATION_ENABLED=false             # Enable AI product data validation

# AI Model Configuration
LLM_MODEL=gpt-4o                        # Primary AI model for standardization
AI_VALIDATION_MODEL=gpt-4o-mini         # Cost-effective model for validation
```

### Quality & Performance Thresholds

```env
# PDF Processing Quality Controls
COMPLETENESS_THRESHOLD_PDF=0.85         # Minimum completeness ratio (85%)
MIN_PRODUCTS_FOR_SUCCESS=50             # Trigger fallback if fewer products
MAX_PRODUCTS_FOR_FALLBACK=150           # Skip fallback if too many products

# File Processing Limits
MAX_FILE_SIZE_MB=10                     # Maximum upload size in MB
AI_VISION_MAX_PAGES=8                   # Maximum pages for AI vision processing

# AI Cost Controls
MAX_AI_STANDARDIZATION_PRODUCTS=100     # Max products for AI standardization per file
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=200 # Skip AI if total products exceed this
AI_VALIDATION_BATCH_SIZE=200            # Products per validation API call
```

### Advanced Processing Settings

```env
# Async Processing (Future Feature)
USE_ASYNC_AI_EXTRACTION=false           # Enable background AI processing

# Debug and Development
DEBUG_MODE=false                        # Enable detailed logging
PROCESSING_TIMEOUT_MS=300000            # 5-minute timeout for processing
```

## Configuration Scenarios

### 1. Production Setup (Cost-Optimized)

**Recommended for live deployment with cost control:**

```env
# AI Features - Conservative
LLM_FALLBACK_ENABLED=true               # Enable fallback for complex files
AI_VISION_ENABLED=true                  # Enable for difficult PDFs only
AI_STANDARDIZATION_ENABLED=false        # Disable expensive standardization
AI_VALIDATION_ENABLED=true              # Enable cheap validation

# Quality Thresholds - Balanced
COMPLETENESS_THRESHOLD_PDF=0.80         # 80% completeness threshold
MIN_PRODUCTS_FOR_SUCCESS=30             # Lower threshold for fallback
MAX_PRODUCTS_FOR_FALLBACK=100           # Conservative fallback limit

# Cost Controls - Strict
MAX_AI_STANDARDIZATION_PRODUCTS=20      # Limit AI standardization
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=100 # Skip AI for large files
AI_VALIDATION_BATCH_SIZE=200            # Efficient batching

# Models - Cost-Effective
LLM_MODEL=gpt-4o-mini                   # Use cheaper model where possible
AI_VALIDATION_MODEL=gpt-4o-mini         # Cheap validation
```

**Expected Cost**: ~$0.01-0.05 per file

### 2. Development Setup (Full Features)

**Recommended for development and testing:**

```env
# AI Features - Full Access
LLM_FALLBACK_ENABLED=true               # Test all fallback scenarios
AI_VISION_ENABLED=true                  # Test image processing
AI_STANDARDIZATION_ENABLED=true         # Test standardization
AI_VALIDATION_ENABLED=true              # Test validation

# Quality Thresholds - Aggressive
COMPLETENESS_THRESHOLD_PDF=0.90         # High quality threshold
MIN_PRODUCTS_FOR_SUCCESS=20             # Trigger fallback easily
MAX_PRODUCTS_FOR_FALLBACK=200           # Allow more AI processing

# Cost Controls - Relaxed
MAX_AI_STANDARDIZATION_PRODUCTS=50      # More AI standardization
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=150 # Allow larger files
AI_VALIDATION_BATCH_SIZE=100            # Smaller batches for testing

# Models - High Quality
LLM_MODEL=gpt-4o                        # Best model for testing
AI_VALIDATION_MODEL=gpt-4o-mini         # Still cost-effective for validation
```

**Expected Cost**: ~$0.05-0.20 per file

### 3. High-Volume Setup (Performance Optimized)

**Recommended for processing many files:**

```env
# AI Features - Selective
LLM_FALLBACK_ENABLED=true               # Only for failed extractions
AI_VISION_ENABLED=false                 # Disable expensive image processing
AI_STANDARDIZATION_ENABLED=false        # Disable for speed
AI_VALIDATION_ENABLED=true              # Keep data quality checks

# Quality Thresholds - Performance Focused
COMPLETENESS_THRESHOLD_PDF=0.75         # Lower threshold for speed
MIN_PRODUCTS_FOR_SUCCESS=50             # Avoid unnecessary fallbacks
MAX_PRODUCTS_FOR_FALLBACK=50            # Strict fallback limits

# Cost Controls - Aggressive
MAX_AI_STANDARDIZATION_PRODUCTS=0       # Disable AI standardization
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=50  # Very conservative
AI_VALIDATION_BATCH_SIZE=500            # Large batches for efficiency

# Processing Limits - High Volume
MAX_FILE_SIZE_MB=20                     # Allow larger files
PROCESSING_TIMEOUT_MS=600000            # 10-minute timeout
```

**Expected Cost**: ~$0.001-0.01 per file

### 4. Budget Setup (Minimal AI)

**Recommended for cost-sensitive deployments:**

```env
# AI Features - Minimal
LLM_FALLBACK_ENABLED=false              # Disable expensive fallbacks
AI_VISION_ENABLED=false                 # No image processing
AI_STANDARDIZATION_ENABLED=false        # No AI standardization
AI_VALIDATION_ENABLED=false             # No AI validation

# Quality Thresholds - Basic
COMPLETENESS_THRESHOLD_PDF=0.70         # Accept lower quality
MIN_PRODUCTS_FOR_SUCCESS=10             # Basic success criteria
MAX_PRODUCTS_FOR_FALLBACK=0             # No fallbacks

# Cost Controls - Zero AI
MAX_AI_STANDARDIZATION_PRODUCTS=0       # No AI standardization
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=0   # No AI processing
AI_VALIDATION_BATCH_SIZE=1              # Minimal batching

# Processing - Basic Only
MAX_FILE_SIZE_MB=5                      # Smaller files only
```

**Expected Cost**: $0.00 per file (no AI usage)

## Configuration Impact Analysis

### PDF Extraction Performance

| Setting | Impact on Extraction | Cost Impact | Recommended Value |
|---------|---------------------|-------------|-------------------|
| `COMPLETENESS_THRESHOLD_PDF` | Higher = More AI usage | High | 0.80-0.85 |
| `MIN_PRODUCTS_FOR_SUCCESS` | Lower = More AI usage | High | 30-50 |
| `AI_VISION_ENABLED` | Enable = Better complex PDFs | Very High | true (production) |
| `LLM_FALLBACK_ENABLED` | Enable = Better fallbacks | High | true |

### Cost Control Effectiveness

| Setting | Cost Reduction | Quality Impact | Notes |
|---------|---------------|----------------|-------|
| `AI_STANDARDIZATION_ENABLED=false` | 70-80% | Low | Simple normalization fallback |
| `AI_VISION_ENABLED=false` | 50-60% | Medium | May miss complex layouts |
| `AI_VALIDATION_ENABLED=false` | 20-30% | Medium | Manual validation needed |
| `MAX_AI_STANDARDIZATION_PRODUCTS=20` | 40-50% | Low | Hybrid approach |

### Processing Speed Optimization

| Setting | Speed Improvement | Quality Impact | Trade-off |
|---------|------------------|----------------|-----------|
| `AI_STANDARDIZATION_ENABLED=false` | 60-70% faster | Minimal | Good |
| `AI_VALIDATION_ENABLED=false` | 30-40% faster | Some quality loss | Acceptable |
| `COMPLETENESS_THRESHOLD_PDF=0.70` | 20-30% faster | More fallbacks | Marginal |
| `MAX_FILE_SIZE_MB=5` | 40-50% faster | Limits file scope | Depends on use case |

## Feature Flags Explanation

### AI Vision Processing (`AI_VISION_ENABLED`)

**When Enabled**:
- PDFs converted to images for complex layout analysis
- GPT-4o Vision API processes images
- Can extract from catalogs, complex tables, multi-column layouts
- High cost per page (~$0.01-0.05 per page)

**When Disabled**:
- Only traditional PDF extraction (Camelot, PDFPlumber)
- Cannot handle complex visual layouts
- Much faster processing
- Zero AI vision costs

### AI Standardization (`AI_STANDARDIZATION_ENABLED`)

**When Enabled**:
- Product names standardized using GPT-4o
- Better matching between suppliers
- Removes brand names, standardizes formats
- Moderate cost per product (~$0.0001-0.001 per product)

**When Disabled**:
- Simple text normalization only
- May have inconsistent product naming
- Faster processing
- Zero standardization costs

### AI Validation (`AI_VALIDATION_ENABLED`)

**When Enabled**:
- Extracted data validated using GPT-4o-mini
- Invalid products filtered out
- Product names cleaned and corrected
- Low cost per product (~$0.00001-0.0001 per product)

**When Disabled**:
- Basic rule-based validation only
- May include invalid products
- Faster processing
- Zero validation costs

## Monitoring and Alerting

### Cost Monitoring

Monitor these metrics to control AI costs:

```typescript
// Daily cost tracking
const dailyCost = await tokenCostMonitor.getDailyCost();
if (dailyCost > DAILY_COST_LIMIT) {
  // Disable expensive AI features
  await disableExpensiveFeatures();
}

// Per-file cost tracking
const fileCost = await calculateFileCost(uploadId);
if (fileCost > FILE_COST_LIMIT) {
  // Alert or skip AI processing
  await alertHighCost(uploadId, fileCost);
}
```

### Performance Monitoring

Track these metrics for performance optimization:

```typescript
// Processing time tracking
const avgProcessingTime = await getAverageProcessingTime();
if (avgProcessingTime > PROCESSING_TIME_LIMIT) {
  // Optimize processing or reduce AI usage
  await optimizeProcessing();
}

// Success rate monitoring
const successRate = await getProcessingSuccessRate();
if (successRate < SUCCESS_RATE_THRESHOLD) {
  // Adjust quality thresholds
  await adjustQualityThresholds();
}
```

### Quality Monitoring

Monitor extraction quality metrics:

```typescript
// Completeness ratio tracking
const avgCompleteness = await getAverageCompleteness();
if (avgCompleteness < COMPLETENESS_THRESHOLD) {
  // Enable more AI fallbacks
  await enableFallbacks();
}

// Product validation rate
const validationRate = await getValidationRate();
if (validationRate < VALIDATION_THRESHOLD) {
  // Enable AI validation
  await enableValidation();
}
```

## Troubleshooting Configuration Issues

### Common Problems

#### 1. High AI Costs

**Symptoms**: Daily costs exceed budget
**Solutions**:
```env
AI_STANDARDIZATION_ENABLED=false        # Biggest cost saver
MAX_AI_STANDARDIZATION_PRODUCTS=10      # Limit AI usage
AI_VISION_ENABLED=false                 # Disable expensive vision
```

#### 2. Poor Extraction Quality

**Symptoms**: Low completeness ratios, missing products
**Solutions**:
```env
LLM_FALLBACK_ENABLED=true               # Enable fallbacks
AI_VISION_ENABLED=true                  # Handle complex layouts
COMPLETENESS_THRESHOLD_PDF=0.70         # Lower threshold
MIN_PRODUCTS_FOR_SUCCESS=20             # Trigger fallbacks sooner
```

#### 3. Slow Processing

**Symptoms**: Files take too long to process
**Solutions**:
```env
AI_STANDARDIZATION_ENABLED=false        # Disable slow AI
AI_VALIDATION_ENABLED=false             # Skip validation
MAX_PRODUCTS_FOR_AI_STANDARDIZATION=50  # Limit AI scope
```

#### 4. Server Crashes

**Symptoms**: Processing fails, server becomes unresponsive
**Solutions**:
```env
MAX_AI_STANDARDIZATION_PRODUCTS=20      # Reduce batch sizes
AI_STANDARDIZATION_ENABLED=false        # Disable heavy processing
MAX_FILE_SIZE_MB=5                      # Smaller files only
PROCESSING_TIMEOUT_MS=180000            # Shorter timeouts
```

### Configuration Validation

Before deploying, validate your configuration:

```bash
# Check required variables
if [ -z "$DATABASE_URL" ]; then echo "ERROR: DATABASE_URL not set"; fi
if [ -z "$OPENAI_API_KEY" ]; then echo "ERROR: OPENAI_API_KEY not set"; fi

# Validate numeric values
if [ "$MAX_FILE_SIZE_MB" -gt 50 ]; then echo "WARNING: Large file size limit"; fi
if [ "$COMPLETENESS_THRESHOLD_PDF" -lt 0.5 ]; then echo "WARNING: Very low quality threshold"; fi

# Check cost controls
if [ "$AI_STANDARDIZATION_ENABLED" = "true" ] && [ "$MAX_AI_STANDARDIZATION_PRODUCTS" -gt 100 ]; then
  echo "WARNING: High AI standardization limit may be expensive"
fi
```

---

*This configuration guide should be reviewed and updated with each deployment. Adjust settings based on your specific cost, quality, and performance requirements.*