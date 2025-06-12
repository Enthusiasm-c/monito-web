# Telegram Bot API Endpoints

These endpoints are specifically designed for the Monito Telegram Bot integration.

## Authentication

All bot endpoints require authentication using an API key in the request header:

```
X-Bot-API-Key: your-bot-api-key
```

Set the `BOT_API_KEY` environment variable in your `.env` file.

## Endpoints

### 1. Product Search

**GET** `/api/bot/products/search`

Search for products by name with fuzzy matching.

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Maximum results to return (default: 10)

**Response:**
```json
{
  "products": [
    {
      "id": "123",
      "name": "Beras Premium",
      "standardized_name": "beras premium",
      "unit": "kg",
      "category": "Groceries",
      "prices": [
        {
          "supplier_id": "456",
          "supplier_name": "Toko ABC",
          "amount": 65000,
          "currency": "IDR"
        }
      ],
      "price_range": {
        "min": 65000,
        "max": 75000,
        "supplier_count": 3
      }
    }
  ],
  "count": 1,
  "query": "beras"
}
```

### 2. Supplier Search

**GET** `/api/bot/suppliers/search`

Find supplier by name.

**Query Parameters:**
- `name` (required): Supplier name to search

**Response:**
```json
{
  "supplier": {
    "id": "456",
    "name": "Toko Sembako Jaya"
  },
  "suggestions": []
}
```

If multiple matches are found:
```json
{
  "supplier": null,
  "suggestions": [
    {"id": "456", "name": "Toko Sembako Jaya"},
    {"id": "789", "name": "Toko Sembako Makmur"}
  ]
}
```

### 3. Bulk Price Comparison

**POST** `/api/bot/prices/compare`

Compare multiple scanned prices against database prices.

**Request Body:**
```json
{
  "items": [
    {
      "product_name": "Beras Premium",
      "supplier_id": "456",  // optional
      "scanned_price": 70000
    },
    {
      "product_name": "Minyak Goreng",
      "scanned_price": 35000
    }
  ]
}
```

**Response:**
```json
{
  "comparisons": [
    {
      "product_name": "Beras Premium",
      "scanned_price": 70000,
      "status": "normal",  // "normal", "above_average", "overpriced", "below_average", "suspiciously_low", "not_found"
      "matched_product": {
        "id": "123",
        "name": "Beras Premium",
        "unit": "kg"
      },
      "price_analysis": {
        "min_price": 65000,
        "max_price": 75000,
        "avg_price": 70000,
        "supplier_price": 68000,  // if supplier_id provided
        "deviation_percent": 0,
        "supplier_count": 3,
        "suppliers": [
          {"id": "456", "name": "Toko ABC", "price": 65000},
          {"id": "789", "name": "Toko XYZ", "price": 70000}
        ]
      }
    }
  ],
  "summary": {
    "total_items": 2,
    "found_items": 2,
    "overpriced_items": 0,
    "good_deals": 0
  }
}
```

## Status Codes

- `200` - Success
- `400` - Bad Request (missing required parameters)
- `401` - Unauthorized (invalid or missing API key)
- `500` - Internal Server Error

## Usage Example

```typescript
// In the Telegram bot
const response = await fetch('https://monito-web.com/api/bot/products/search?q=beras', {
  headers: {
    'X-Bot-API-Key': process.env.BOT_API_KEY
  }
});

const data = await response.json();
```

## Rate Limiting

Currently no rate limiting is implemented, but it's recommended to:
- Cache frequently requested data
- Batch requests when possible
- Implement exponential backoff on errors