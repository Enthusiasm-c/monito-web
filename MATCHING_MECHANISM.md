# Product Matching Mechanism Documentation

## Overview

This document describes the sophisticated product matching mechanism used in the Monito Web system to match products from user-uploaded invoices with products in the database. The system handles various challenges including OCR errors, language variations, unit differences, and product modifiers.

## Table of Contents

1. [Invoice Processing Flow](#invoice-processing-flow)
2. [OCR and Data Extraction](#ocr-and-data-extraction)
3. [Product Search Strategy](#product-search-strategy)
4. [Similarity Scoring Algorithm](#similarity-scoring-algorithm)
5. [Modifier Classification System](#modifier-classification-system)
6. [Unit Matching and Normalization](#unit-matching-and-normalization)
7. [Price Comparison Logic](#price-comparison-logic)
8. [Better Deals Detection](#better-deals-detection)
9. [Common Challenges and Solutions](#common-challenges-and-solutions)
10. [Examples and Test Cases](#examples-and-test-cases)

## Invoice Processing Flow

### 1. User Uploads Invoice Photo
```
User → Telegram Bot → Photo Message → OCR Processing
```

### 2. OCR Data Extraction
```python
# Bot extracts structured data using OpenAI Vision API
extracted_data = {
    "supplier": "Supplier Name",
    "date": "2025-06-18",
    "items": [
        {
            "product_name": "Tomato",
            "quantity": 5,
            "unit": "kg",
            "unit_price": 20000,
            "total_price": 100000
        }
    ]
}
```

### 3. API Call for Price Comparison
```python
# Bot sends extracted items to comparison API
POST /api/bot/prices/compare
{
    "items": [
        {
            "product_name": "tomato",
            "scanned_price": 20000,
            "unit": "kg",
            "quantity": 1,
            "supplier_id": "optional_id"
        }
    ]
}
```

## OCR and Data Extraction

### OpenAI Vision API Configuration

The system uses GPT-4o-mini model for invoice OCR with specific prompts optimized for Indonesian invoices:

```python
# From telegram-bot/app/utils/ocr.py
INVOICE_OCR_PROMPT = """
Analyze this invoice and extract:
1. Supplier name and invoice date
2. For each item: product name, quantity, unit, unit price, total price
Handle Indonesian number formats (dots as thousand separators)
"""
```

### Data Validation
- Validates price calculations (quantity × unit_price = total_price)
- Handles Indonesian number formats (1.000.000 = 1,000,000)
- Falls back to manual parsing if JSON extraction fails

## Product Search Strategy

### Multi-Field Search

The system searches across multiple fields to maximize matching chances:

```typescript
// From app/api/bot/prices/compare/route.ts
const products = await prisma.product.findMany({
  where: {
    OR: [
      { name: { contains: item.product_name, mode: 'insensitive' } },
      { standardizedName: { contains: item.product_name, mode: 'insensitive' } },
      { rawName: { contains: item.product_name, mode: 'insensitive' } }
    ]
  },
  include: {
    prices: {
      where: { validTo: null },
      include: { supplier: true }
    }
  },
  take: 20
});
```

### Fallback Search for OCR Errors

If no products found, the system tries common OCR mistake corrections:

```typescript
const variations = [
  item.product_name,
  item.product_name.replace(/z/gi, 'zz'),     // mozarella → mozzarella
  item.product_name.replace(/zz/gi, 'z'),     // mozzarella → mozarella
  item.product_name.replace(/l{2}/gi, 'll'),  // mayonaise → mayonnaise
  item.product_name.replace(/n{2}/gi, 'n'),   // mayonnaise → mayonaise
];
```

## Similarity Scoring Algorithm

### calculateProductSimilarity Function

The core matching logic uses a sophisticated scoring system:

```typescript
function calculateProductSimilarity(query: string, productName: string): number {
  // 1. Exclusive Modifier Check (0 score if incompatible)
  if (hasExclusiveModifierMismatch(query, productName)) {
    return 0;
  }
  
  // 2. Exact Match (100 score)
  if (normalizeProductName(query) === normalizeProductName(productName)) {
    return 100;
  }
  
  // 3. Sorted Words Match (95 score)
  // "english spinach" = "spinach english"
  
  // 4. Core Words Validation
  // All non-modifier words must match
  
  // 5. Word Overlap Scoring
  // Percentage of matching words
  
  // 6. Modifiers and Penalties
  // Bonus for descriptive modifiers
  // Penalty for extra words
  
  return finalScore; // 0-100
}
```

### Scoring Components

1. **Exact Match**: 100 points
2. **Reordered Match**: 95 points (same words, different order)
3. **Word Overlap**: Up to 80 points based on matching percentage
4. **Exact Word Bonus**: +30% for exact word matches
5. **Descriptive Modifier Bonus**: +10% for products with only descriptive modifiers
6. **Extra Words Penalty**: -5% per extra word in product name

## Modifier Classification System

### Exclusive Modifiers

Words that fundamentally change the product nature:

```typescript
exclusive: [
  // Colors
  'black', 'white', 'red', 'green', 'yellow', 'purple',
  
  // Processing states
  'dried', 'frozen', 'canned', 'pickled', 'smoked',
  
  // Origins
  'japanese', 'chinese', 'indian', 'thai', 'korean',
  'imported', 'organic', 'conventional',
  
  // Product variants
  'sweet', 'wild', 'sea', 'mountain', 'water', 'bitter',
  'baby', 'young', 'old', 'mature'
]
```

### Descriptive Modifiers

Words that describe size/quality but don't change core product:

```typescript
descriptive: [
  // Size descriptors
  'big', 'large', 'huge', 'giant', 'jumbo',
  'small', 'mini', 'tiny', 'little',
  'medium', 'regular', 'standard',
  
  // Quality descriptors
  'fresh', 'new', 'premium', 'grade', 'quality',
  
  // Form descriptors
  'whole', 'half', 'piece', 'slice',
  
  // Origin (non-exclusive)
  'local'
]
```

### Modifier Mismatch Logic

```typescript
function hasExclusiveModifierMismatch(query: string, productName: string): boolean {
  const queryExclusives = getExclusiveModifiers(query);
  const productExclusives = getExclusiveModifiers(productName);
  
  // Allow partial queries (no exclusive modifiers) to match any product
  if (queryExclusives.length === 0) {
    return false;
  }
  
  // Check for conflicts when query has exclusive modifiers
  const hasConflicts = queryExclusives.some(mod => !productExclusives.includes(mod))
                    || productExclusives.some(mod => !queryExclusives.includes(mod));
  
  return hasConflicts;
}
```

## Unit Matching and Normalization

### Canonical Units System

The system normalizes units to canonical forms for comparison:

```typescript
const CANONICAL_UNITS = {
  // Weight units → kg
  'kg': 'kg',
  'kilogram': 'kg',
  'kilo': 'kg',
  'g': 'kg',
  'gram': 'kg',
  'gr': 'kg',
  
  // Volume units → ltr
  'l': 'ltr',
  'liter': 'ltr',
  'litre': 'ltr',
  'ltr': 'ltr',
  'ml': 'ltr',
  
  // Count units → pcs
  'pcs': 'pcs',
  'piece': 'pcs',
  'pieces': 'pcs',
  'unit': 'pcs',
  'pack': 'pack',
  'box': 'box'
};
```

### Unit Price Calculation

```typescript
function calculateUnitPrice(amount: number, quantity: number, unit: string): number {
  const canonicalUnit = getCanonicalUnit(unit);
  
  // Convert to base unit (kg, ltr, pcs)
  switch (canonicalUnit) {
    case 'kg':
      if (unit === 'g' || unit === 'gr') {
        return (amount / quantity) * 1000; // Convert g to kg
      }
      break;
    case 'ltr':
      if (unit === 'ml') {
        return (amount / quantity) * 1000; // Convert ml to ltr
      }
      break;
  }
  
  return amount / quantity;
}
```

## Price Comparison Logic

### Best Match Selection

The system prioritizes matches based on:

1. **Similarity Score**: Products with 0 similarity are excluded
2. **Unit Match**: Products with matching canonical units are preferred
3. **Price**: Among compatible products, sorted by price

```typescript
// Find best matching product
let bestMatch = products.reduce((best, current) => {
  const bestScore = calculateProductSimilarity(query, best.name);
  const currentScore = calculateProductSimilarity(query, current.name);
  
  // Exclude incompatible products
  if (currentScore === 0) return best;
  if (bestScore === 0) return current;
  
  // Prioritize unit match
  if (currentUnitMatch && !bestUnitMatch) return current;
  if (!currentUnitMatch && bestUnitMatch) return best;
  
  // Use similarity score
  return currentScore > bestScore ? current : best;
}, products[0]);
```

### Price Analysis

For each matched product, the system analyzes:

1. **Price Range**: min, max, average across all suppliers
2. **Supplier Count**: Number of suppliers offering the product
3. **Price Status**: 
   - `suspiciously_low`: < 70% of minimum price
   - `overpriced`: > 115% of maximum price
   - `above_average`: > 105% of average price
   - `below_average`: < 95% of average price
   - `normal`: Within expected range

## Better Deals Detection

### Filtering Criteria

Better deals must meet ALL criteria:

1. **Different Supplier**: Not from the same supplier as scanned price
2. **Fresh Price**: Not older than 30 days
3. **Minimum Savings**: At least 5% cheaper (configurable)
4. **Unit Compatibility**: Same canonical unit for accurate comparison

```typescript
const betterDeals = allPrices.filter(entry => {
  // Skip same supplier
  if (item.supplier_id && entry.supplierId === item.supplier_id) {
    return false;
  }
  
  // Skip stale prices
  const priceAge = Date.now() - entry.createdAt.getTime();
  if (priceAge > 30 * 24 * 60 * 60 * 1000) {
    return false;
  }
  
  // Check minimum savings threshold
  const savingsPct = ((scannedPrice - entry.price) / scannedPrice) * 100;
  return savingsPct >= MIN_SAVING_PCT;
});
```

### Deduplication and Limiting

```typescript
// Remove duplicate suppliers
const uniqueBetterDeals = removeDuplicates(betterDeals);

// Limit to top 3 alternatives
const topBetterDeals = uniqueBetterDeals
  .sort((a, b) => a.price - b.price)
  .slice(0, 3);
```

## Common Challenges and Solutions

### 1. OCR Errors

**Challenge**: OCR might read "tornato" instead of "tomato"

**Solution**: Fuzzy search with common OCR mistake patterns:
- Single/double letter variations (z/zz, n/nn)
- Common suffix mistakes (-naise/-nnaise)

### 2. Language Variations

**Challenge**: Same product in different languages
- "Tomato" vs "Tomat"
- "Carrot" vs "Wortel"

**Solution**: 
- Standardized names in database
- Multi-field search (name, standardizedName, rawName)

### 3. Unit Mismatches

**Challenge**: Same product listed with different units
- "Tomato" in kg vs "Tomato Local" in g
- Price comparison becomes inaccurate

**Solution**:
- Canonical unit system
- Unit conversion for price comparison
- Unit match prioritization in selection

### 4. Product Variants

**Challenge**: Distinguishing between similar products
- "Tomato" vs "Tomato Green" vs "Tomato Cherry"

**Solution**:
- Exclusive modifier system
- Similarity scoring with modifier awareness
- Core word validation

### 5. Partial Matches

**Challenge**: Invoice might say "romana" but database has "Lettuce Romana Baby"

**Solution**:
- Allow partial queries without exclusive modifiers
- Core word matching system
- Flexible similarity scoring

## Examples and Test Cases

### Example 1: Simple Match
```
Query: "tomato"
Database: "Tomato", "Tomato Local", "Tomato Green"

Results:
1. "Tomato" - Score: 100 (exact match)
2. "Tomato Local" - Score: ~70 (has descriptive modifier)
3. "Tomato Green" - Score: 0 (exclusive modifier mismatch)
```

### Example 2: Reordered Words
```
Query: "spinach english"
Database: "English Spinach"

Result: Score: 95 (sorted word match)
```

### Example 3: Partial Query
```
Query: "romana"
Database: "Lettuce Romana Baby"

Result: Score: ~60 (partial match allowed, core word matches)
```

### Example 4: OCR Error
```
Query: "mozarella"
Database: "Mozzarella"

Process:
1. First search: No results
2. Fallback search with "mozzarella" variation
3. Result: Match found
```

### Example 5: Unit Conversion
```
Query: "tomato local" - 15 IDR/g
Database: "Tomato" - 20,000 IDR/kg

Comparison:
- Tomato Local: 15,000 IDR/kg (converted)
- Tomato: 20,000 IDR/kg
- Better deal found: 25% savings
```

## Configuration

### Environment Variables
```env
MIN_SAVING_PCT=5          # Minimum savings percentage for better deals
FRESH_DAYS=30            # Maximum age for price data
MAX_ALTERNATIVES=3       # Maximum better deals to show per product
```

### API Response Format
```json
{
  "product_name": "tomato",
  "scanned_price": 20000,
  "status": "normal",
  "matched_product": {
    "id": "product_id",
    "name": "Tomato",
    "unit": "kg"
  },
  "price_analysis": {
    "min_price": 15000,
    "max_price": 30000,
    "avg_price": 22500,
    "supplier_count": 4,
    "better_deals": [
      {
        "supplier": "Island Organics Bali",
        "price": 15000,
        "product_name": "Tomato Local",
        "unit": "kg",
        "savings": 5000,
        "savings_percent": 25
      }
    ],
    "has_better_deals": true,
    "is_best_price": false
  }
}
```

## Performance Considerations

1. **Database Queries**: Limited to 20 products per search
2. **Price Entries**: Maximum 10 suppliers shown in analysis
3. **Better Deals**: Maximum 3 alternatives per product
4. **Caching**: OCR results cached for 15 minutes
5. **Timeout**: 30 seconds for OCR processing

## Future Improvements

1. **Machine Learning**: Train model on successful matches
2. **Synonym Dictionary**: Build product synonym database
3. **Supplier Patterns**: Learn supplier-specific naming conventions
4. **Multi-language Support**: Expand beyond Indonesian/English
5. **Barcode Integration**: Add barcode scanning for exact matches

---

*Last Updated: 2025-06-18*
*Version: 1.0*