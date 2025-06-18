# Monito Web Development Rules & Guidelines

## 🎯 Core Development Principles

### **MVP Philosophy**
- **80/20 Rule**: Solve 80% of problems with 20% effort
- **Iterate Fast**: Implement core functionality first, optimize later
- **Measure Impact**: Focus on features that deliver measurable value
- **Avoid Over-Engineering**: Resist the temptation to build complex solutions for simple problems

### **Code Quality Standards**
- **Single Responsibility**: Each function/class should have one clear purpose
- **DRY Principle**: Don't Repeat Yourself - centralize common logic
- **Error Handling**: Always handle edge cases and failure scenarios
- **Documentation**: Code should be self-documenting with clear naming

## 📋 Technical Rules

### **Database Operations**

#### **CRITICAL: Single Bot Instance Rule**
```bash
# ❌ STRICTLY FORBIDDEN - Multiple bot processes
# ✅ REQUIRED - Single instance only
ps aux | grep '__main__.py' | grep -v grep | wc -l  # Must return 1
```

**Enforcement:**
- Bot manager is **DISABLED** (renamed to `bot-manager.py.disabled`)
- Use direct execution: `venv/bin/python __main__.py`
- PID file management for startup scripts
- Kill all existing processes before starting new instance

#### **Price Management Rules**
1. **Unit Price Calculation**: Always calculate `unitPrice` when creating Price records
2. **Validity Periods**: Use `validFrom` and `validTo` for price history
3. **Stale Price Filtering**: Exclude prices older than 30 days from recommendations
4. **Supplier Exclusion**: Never recommend same supplier in price comparisons

#### **Product Matching Rules**
1. **Modifier Awareness**: Distinguish between exclusive vs descriptive modifiers
2. **Core Word Validation**: Essential product words must match
3. **Similarity Threshold**: Minimum similarity score for valid matches
4. **Unit Compatibility**: Prioritize products with matching canonical units

### **Error Prevention**

#### **None-Safe Operations**
```python
# ❌ Wrong - Can cause format errors
f"Price: {amount}"

# ✅ Correct - Handle None values
def format_price(amount, currency: str = "IDR") -> str:
    if amount is None:
        return "N/A"
    return f"{amount:,.0f} {currency}"
```

#### **Variable Declaration**
```typescript
// ❌ Wrong - Undefined variable usage
can_optimize = has_better_deals && !is_best_price;

// ✅ Correct - Extract from data structure
can_optimize = has_better_deals && !analysis.get("is_best_price", false);
```

### **AI Integration Guidelines**

#### **API Response Handling**
1. **Always validate** AI API responses before processing
2. **Implement fallbacks** for API failures
3. **Handle rate limits** gracefully with retry logic
4. **Monitor token usage** and costs

#### **Product Similarity Algorithm**
```typescript
// Scoring Priority (High to Low):
1. Exclusive modifier compatibility check → Reject if incompatible
2. Exact normalized match → 100 points
3. Sorted word match → 95 points  
4. Core words validation → Required
5. Word overlap calculation → Weighted scoring
```

## 🔧 Implementation Standards

### **API Development**

#### **Bot API Authentication**
```typescript
// Required for all bot endpoints
const authError = authenticateBot(request);
if (authError) return authError;
```

#### **Response Format Standards**
```typescript
// Success Response
{
  success: true,
  data: {...},
  message?: string
}

// Error Response  
{
  error: string,
  details?: any
}
```

### **Database Schema Rules**

#### **Required Fields**
- **Products**: `name`, `standardizedName`, `unit` are mandatory
- **Prices**: `amount`, `supplierId`, `productId` are mandatory
- **Suppliers**: `name` is mandatory

#### **Validation Rules**
```typescript
// Product validation
if (!productData.name || productData.name.trim().length === 0) {
  throw new Error('Product name is required');
}

// Price validation
if (!priceData.amount || priceData.amount <= 0) {
  throw new Error('Price amount must be greater than 0');
}
```

### **Telegram Bot Rules**

#### **Message Formatting**
1. **Use markdown** for structured responses
2. **Handle long messages** with pagination
3. **Include status indicators** for processing states
4. **Provide clear error messages** for user actions

#### **Error Recovery**
```python
# Always wrap API calls in try-catch
try:
    response = await api_call()
except Exception as e:
    logger.error(f"API call failed: {e}")
    await message.reply("❌ An error occurred. Please try again.")
```

## 🚀 Deployment Rules

### **Environment Management**

#### **Required Environment Variables**
```env
# Database (Production)
DATABASE_URL=postgresql://...

# AI Services (Required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# Bot Authentication (Required)
BOT_API_KEY=...

# Configuration (Optional with defaults)
MIN_SAVING_PCT=5
FRESH_DAYS=7
```

#### **Dependency Management**
```bash
# Web Application
npm install --production

# Telegram Bot
pip install -r requirements.txt
```

### **Server Configuration**

#### **PostgreSQL Requirements**
```sql
-- Required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_prices_valid ON prices(validTo) WHERE validTo IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(name gin_trgm_ops);
```

#### **Bot Server Setup**
```bash
# Single instance enforcement
pkill -f '__main__.py'  # Kill existing processes
cd /opt/telegram-bot
nohup venv/bin/python __main__.py > bot_single.log 2>&1 &
```

## 🔒 Security Rules

### **Data Protection**
1. **Never log sensitive data** (API keys, user personal info)
2. **Validate all inputs** before processing
3. **Use parameterized queries** for database operations
4. **Sanitize file uploads** before processing

### **API Security**
1. **Authenticate all bot endpoints** with API key
2. **Rate limit requests** to prevent abuse
3. **Validate request payloads** for expected structure
4. **Use HTTPS** for all external communications

## 📊 Monitoring & Debugging

### **Logging Standards**
```python
# Use structured logging
logger.info(f"Processing item {index}: {product_name} - Price: {price}")
logger.error(f"Error processing invoice: {error}")
```

### **Performance Monitoring**
1. **Track API response times** for all external calls
2. **Monitor database query performance**
3. **Log processing statistics** for analysis
4. **Alert on error rate thresholds**

### **Debugging Guidelines**
1. **Include request IDs** for tracing
2. **Log at appropriate levels** (DEBUG, INFO, WARNING, ERROR)
3. **Preserve error context** in exception handling
4. **Use meaningful error messages**

## 🧪 Testing Requirements

### **Unit Testing**
- **Price calculator functions** must have >90% coverage
- **Product similarity algorithm** must be validated with test cases
- **API endpoints** must have integration tests

### **Manual Testing Checklist**
- [ ] Bot responds to invoice uploads
- [ ] Price comparisons return accurate results
- [ ] Product matching handles edge cases
- [ ] Error messages are user-friendly
- [ ] Single bot instance enforcement works

## 📈 Performance Guidelines

### **Database Optimization**
1. **Use indexes** for frequently queried columns
2. **Limit result sets** with appropriate LIMIT clauses
3. **Use connection pooling** for better resource management
4. **Clean up stale data** regularly

### **API Performance**
1. **Cache expensive operations** when possible
2. **Use batch operations** for multiple updates
3. **Implement pagination** for large result sets
4. **Optimize query complexity** with proper joins

## 🔄 Maintenance Rules

### **Regular Tasks**
1. **Weekly**: Review error logs and fix recurring issues
2. **Monthly**: Clean up orphaned data and optimize database
3. **Quarterly**: Review and update dependencies
4. **Annually**: Architecture review and refactoring

### **Code Maintenance**
1. **Remove dead code** immediately when identified
2. **Update documentation** with each significant change
3. **Refactor complex functions** that exceed 50 lines
4. **Keep dependencies current** with security patches

## ⚠️ Critical Warnings

### **Absolutely Forbidden**
- ❌ **Multiple bot instances** - Will cause data corruption
- ❌ **Hardcoded credentials** - Use environment variables only
- ❌ **Direct database modifications** - Use proper APIs
- ❌ **Ignoring error handling** - Always handle exceptions

### **Best Practices**
- ✅ **Single responsibility functions**
- ✅ **Comprehensive error handling**
- ✅ **Clear variable naming**
- ✅ **Regular code reviews**
- ✅ **Performance monitoring**

---

*These rules are enforced to maintain system stability, performance, and security.*
*Last Updated: 2025-06-18*
*Version: 2.0*