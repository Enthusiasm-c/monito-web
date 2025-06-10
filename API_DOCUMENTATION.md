# 📡 API Documentation

## Overview

This document provides comprehensive information about the Monito-Web API endpoints, their functionality, request/response formats, and usage examples.

## 🏗️ Base Configuration

- **Base URL**: `http://localhost:3001/api` (development) or `https://your-domain.com/api` (production)
- **Content-Type**: `application/json` for JSON endpoints, `multipart/form-data` for file uploads
- **Authentication**: Currently no authentication required (internal system)

## 📊 Core API Endpoints

### 1. Products API

#### `GET /api/products`
Retrieve products with price comparison data and search functionality.

**Query Parameters:**
- `category` (string, optional): Filter by product category ('All Categories', 'Vegetables', 'Meat', 'Seafood', 'Grains', 'Dairy', 'Other')
- `search` (string, optional): Search by product name, standardized name, category, or supplier name
- `page` (integer, default: 1): Page number for pagination
- `limit` (integer, default: 50): Number of items per page (50, 100, 200, 500, 1000)
- `sortBy` (string, default: 'name'): Sort field ('name', 'category', 'unit', 'price', 'suppliers', 'savings')
- `sortOrder` (string, default: 'asc'): Sort direction ('asc', 'desc')

**Response:**
```json
{
  "products": [
    {
      "id": "product_id",
      "name": "Original Product Name",
      "standardizedName": "standardized product name",
      "category": "Meat",
      "unit": "kg",
      "priceComparison": {
        "bestPrice": {
          "amount": 150000,
          "supplier": "Supplier Name",
          "supplierId": "supplier_id"
        },
        "highestPrice": {
          "amount": 200000,
          "supplier": "Another Supplier",
          "supplierId": "supplier_id_2"
        },
        "supplierCount": 3,
        "savings": 25.0,
        "priceRange": {
          "min": 150000,
          "max": 200000
        }
      },
      "prices": [
        {
          "id": "price_id",
          "amount": 150000,
          "currency": "IDR",
          "unit": "kg",
          "supplier": {
            "id": "supplier_id",
            "name": "Supplier Name"
          },
          "createdAt": "2024-01-01T00:00:00Z",
          "updatedAt": "2024-01-01T00:00:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 697,
    "pages": 14
  }
}
```

**Example Requests:**
```bash
# Get all products
GET /api/products

# Search for beef products
GET /api/products?search=beef

# Filter by seafood category
GET /api/products?category=Seafood

# Get products from specific supplier
GET /api/products?search=HANDLINE%20TUNA

# Paginated results with sorting
GET /api/products?page=2&limit=100&sortBy=price&sortOrder=asc
```

#### `POST /api/products`
Create a new product manually.

**Request Body:**
```json
{
  "name": "Product Name",
  "category": "Meat",
  "unit": "kg",
  "description": "Optional description"
}
```

**Response:**
```json
{
  "id": "new_product_id",
  "name": "Product Name",
  "standardizedName": "product name",
  "category": "Meat",
  "unit": "kg",
  "standardizedUnit": "kg",
  "description": "Optional description",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### 2. Suppliers API

#### `GET /api/suppliers`
Retrieve all suppliers in the system.

**Response:**
```json
[
  {
    "id": "supplier_id",
    "name": "Supplier Name",
    "email": "supplier@example.com",
    "phone": "+62123456789",
    "address": "Supplier Address",
    "createdAt": "2024-01-01T00:00:00Z",
    "_count": {
      "products": 25,
      "uploads": 3
    }
  }
]
```

#### `POST /api/suppliers`
Create a new supplier.

**Request Body:**
```json
{
  "name": "New Supplier Name",
  "email": "contact@newsupplier.com",
  "phone": "+62987654321",
  "address": "New Supplier Address"
}
```

**Response:**
```json
{
  "id": "new_supplier_id",
  "name": "New Supplier Name",
  "email": "contact@newsupplier.com",
  "phone": "+62987654321",
  "address": "New Supplier Address",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### `GET /api/suppliers/[id]`
Get specific supplier details with products and pricing.

**Response:**
```json
{
  "id": "supplier_id",
  "name": "Supplier Name",
  "email": "supplier@example.com",
  "products": [
    {
      "id": "product_id",
      "name": "Product Name",
      "standardizedName": "standardized name",
      "category": "Meat",
      "currentPrice": {
        "amount": 150000,
        "currency": "IDR",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    }
  ],
  "uploads": [
    {
      "id": "upload_id",
      "originalName": "price_list.pdf",
      "status": "completed",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 3. Upload APIs

#### `POST /api/upload`
Manual file upload with pre-selected supplier.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `files`: File(s) to upload (PDF, Excel, CSV, images)
- `supplierId`: ID of the supplier to assign files to

**Response:**
```json
{
  "message": "Files uploaded successfully",
  "uploadIds": ["upload_id_1", "upload_id_2"],
  "processedFiles": 2,
  "supplierId": "supplier_id"
}
```

#### `POST /api/upload-smart`
AI-powered smart upload with automatic supplier detection.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `files`: File(s) to upload

**Response:**
```json
{
  "message": "Files uploaded and processing started",
  "uploadIds": ["upload_id_1", "upload_id_2"],
  "processedFiles": 2,
  "detectedSuppliers": [
    {
      "fileName": "supplier_price_list.pdf",
      "detectedSupplier": "Detected Supplier Name",
      "confidence": 0.95
    }
  ]
}
```

#### `GET /api/uploads/status`
Get upload processing status.

**Query Parameters:**
- `limit` (integer, default: 10): Number of recent uploads to retrieve

**Response:**
```json
[
  {
    "id": "upload_id",
    "originalName": "price_list.pdf",
    "status": "completed",
    "supplier": {
      "id": "supplier_id",
      "name": "Supplier Name"
    },
    "_count": {
      "prices": 25
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "processingLogs": [
      {
        "step": "extraction",
        "status": "completed",
        "message": "Successfully extracted 25 products",
        "timestamp": "2024-01-01T00:01:00Z"
      }
    ]
  }
]
```

### 4. Statistics API

#### `GET /api/stats`
Get dashboard statistics and metrics.

**Response:**
```json
{
  "products": 697,
  "suppliers": 14,
  "avgSavings": 28.4,
  "lastUpdate": "1m ago",
  "uploads": 38,
  "totalPrices": 1250,
  "categories": {
    "Meat": 150,
    "Seafood": 120,
    "Vegetables": 200,
    "Dairy": 80,
    "Other": 147
  },
  "recentActivity": {
    "uploadsToday": 5,
    "newProducts": 25,
    "updatedPrices": 100
  }
}
```

### 5. Export API

#### `GET /api/export`
Export price comparison data.

**Query Parameters:**
- `format` (string, default: 'excel'): Export format ('excel', 'csv')
- `category` (string, optional): Filter by category
- `search` (string, optional): Search filter

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (Excel)
- Content-Type: `text/csv` (CSV)
- File download with comparison data

### 6. Utility APIs

#### `POST /api/seed`
Seed database with sample data (development only).

**Response:**
```json
{
  "message": "Database seeded successfully",
  "suppliers": 5,
  "products": 50,
  "prices": 150
}
```

#### `GET /api/test-smart-detection`
Test smart supplier detection functionality.

**Response:**
```json
{
  "message": "Smart detection test completed",
  "results": [
    {
      "fileName": "test_file.pdf",
      "detectedSupplier": "Test Supplier",
      "confidence": 0.89,
      "extractedProducts": 15
    }
  ]
}
```

## 🚀 Processing Workflow

### Smart Upload Process
1. **File Upload** → Files stored in Vercel Blob Storage
2. **Content Extraction** → Text/data extracted from documents
3. **Supplier Detection** → AI analyzes content for supplier information
4. **Data Parsing** → Structured data extraction from content
5. **Product Normalization** → Standardization using DataNormalizer
6. **AI Standardization** → GPT-4 product name standardization
7. **Database Storage** → Products and prices saved to database
8. **Status Update** → Upload status updated to 'completed'

### Error Handling
All APIs include comprehensive error handling:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific error details",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

## 🔧 Development Examples

### Search Implementation
```javascript
// Debounced search implementation
const [searchQuery, setSearchQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

// API call
const fetchProducts = async () => {
  const response = await fetch(
    `/api/products?search=${encodeURIComponent(debouncedQuery)}&page=${page}&limit=${limit}`
  );
  const data = await response.json();
  return data;
};
```

### File Upload with Progress
```javascript
const uploadFiles = async (files, supplierId = null) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  
  if (supplierId) {
    formData.append('supplierId', supplierId);
  }
  
  const endpoint = supplierId ? '/api/upload' : '/api/upload-smart';
  
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};
```

## 📊 Performance Considerations

### Pagination
- Large datasets are paginated by default
- Maximum 1000 items per request
- Use `page` and `limit` parameters for navigation

### Search Optimization
- Search queries are debounced (300ms delay)
- Database queries use indexes on `standardizedName`
- Complex searches may take 1-2 seconds

### Rate Limiting
- No explicit rate limiting currently implemented
- AI API calls are internally throttled
- File uploads limited to 10MB per file

---

This API documentation covers all current endpoints and functionality. For additional features or customization, refer to the source code in the `/app/api/` directory.