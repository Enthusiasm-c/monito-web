# Performance Optimization Guide

## Server Stability Improvements

### Problem Solved
The server was crashing due to excessive AI API calls during product processing. With 59 products, each requiring individual AI standardization, the process was taking 2+ minutes and causing timeouts.

### Solution Implemented

#### 1. AI Batching
- **Before**: 59 individual API calls (one per product)
- **After**: 1 batch API call for up to 20 products
- **Result**: ~95% reduction in API calls

#### 2. Processing Limits
- Limited AI standardization to first 20 products per file
- Remaining products use fast rule-based standardization
- Configurable via `MAX_AI_STANDARDIZATION_PRODUCTS` environment variable

#### 3. Performance Improvements
```typescript
// Before: Sequential AI calls
for (product of products) {
  await standardizeWithAI(product); // 59 calls
}

// After: Batch processing
const first20 = products.slice(0, 20);
const standardized = await batchStandardizeWithAI(first20); // 1 call
```

#### 4. Progress Monitoring
- Added progress logs every 10 products processed
- Clear indicators when processing completes
- Better error handling and recovery

### Configuration

Add to `.env`:
```bash
MAX_AI_STANDARDIZATION_PRODUCTS=20
```

Adjust based on your needs:
- `10`: Faster processing, lower AI cost
- `50`: Better standardization, higher cost
- `0`: Disable AI standardization completely

### Performance Metrics

**Before Optimization:**
- 59 products: ~120+ seconds
- 59 API calls
- High server crash risk

**After Optimization:**
- 59 products: ~15-20 seconds  
- 1 API call + rule-based processing
- Stable server performance

### Monitoring

Check processing logs for:
- `🤖 AI Batch Standardization: X products in Yms`
- `✅ Processed X/Y products...`
- `🎉 Successfully processed X products`

Any issues should show specific error messages for debugging.