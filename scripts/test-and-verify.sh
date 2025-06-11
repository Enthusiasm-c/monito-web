#!/bin/bash

# Test specific files and verify extraction accuracy

echo "🔍 Testing and Verifying Price List Extraction"
echo "=============================================="

# Function to test single file
test_file() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    
    echo -e "\n📁 Testing: $file_name"
    echo "----------------------------------------"
    
    # Upload file
    response=$(curl -s -X POST "http://localhost:3000/api/upload-smart" \
        -F "files=@$file_path" \
        -H "Accept: application/json")
    
    upload_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$upload_id" ]; then
        echo "❌ Upload failed for $file_name"
        return
    fi
    
    echo "✅ Upload ID: $upload_id"
    
    # Wait for processing
    echo "⏳ Processing..."
    sleep 10
    
    # Get detailed results
    result=$(curl -s "http://localhost:3000/api/uploads/status" | \
        jq ".[] | select(.id == \"$upload_id\")")
    
    status=$(echo "$result" | jq -r '.status')
    supplier=$(echo "$result" | jq -r '.supplier.name')
    total_rows=$(echo "$result" | jq -r '.totalRowsDetected')
    processed_rows=$(echo "$result" | jq -r '.totalRowsProcessed')
    error=$(echo "$result" | jq -r '.errorMessage // "none"')
    
    echo "📊 Results:"
    echo "  Status: $status"
    echo "  Supplier: $supplier"
    echo "  Rows: $processed_rows / $total_rows"
    echo "  Error: $error"
    
    # Show sample products
    echo "  Sample products:"
    echo "$result" | jq -r '.extractedData.products[:5] | .[] | "    - \(.name): \(.price) \(.unit)"' 2>/dev/null || echo "    No products extracted"
    
    # Count products by price range
    if [ "$processed_rows" != "0" ] && [ "$processed_rows" != "null" ]; then
        echo "  Price distribution:"
        echo "$result" | jq '.extractedData.products | group_by(.price < 1000) | map({range: (if .[0].price < 1000 then "< 1000" else ">= 1000" end), count: length})' 2>/dev/null || echo "    Unable to analyze"
    fi
}

# Test specific files
echo "🧪 Testing EGGSTRA CAFE quotation..."
test_file "/Users/denisdomashenko/Downloads/aibuyer/PRICE QUOTATATION FOR EGGSTRA CAFE.pdf"

echo -e "\n🧪 Testing PT. Global Anugrah Pasifik..."
test_file "/Users/denisdomashenko/Downloads/aibuyer/PT. Global Anugrah Pasifik (groceries item).pdf"

echo -e "\n🧪 Testing VALENTA cheese..."
test_file "/Users/denisdomashenko/Downloads/aibuyer/VALENTA cheese supplier.pdf"

echo -e "\n🧪 Testing Bali Sustainable Seafood..."
test_file "/Users/denisdomashenko/Downloads/aibuyer/bali sustainable seafood.pdf"

echo -e "\n🧪 Testing Excel files..."
test_file "/Users/denisdomashenko/Downloads/aibuyer/sai fresh.xlsx"
test_file "/Users/denisdomashenko/Downloads/aibuyer/sri 2 vegetables supplier.xlsx"

# Final summary
echo -e "\n📈 Final System Statistics:"
curl -s http://localhost:3000/api/stats | jq .

echo -e "\n✅ Testing complete!"