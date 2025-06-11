#!/bin/bash

# Test a single file upload with detailed output

echo "🧪 Testing single file upload..."

FILE_PATH="$1"
if [ -z "$FILE_PATH" ]; then
    echo "Usage: $0 <file_path>"
    exit 1
fi

FILE_NAME=$(basename "$FILE_PATH")
echo "📁 File: $FILE_NAME"

# Upload file
echo "📤 Uploading..."
response=$(curl -s -X POST "http://localhost:3000/api/upload-smart" \
    -F "files=@$FILE_PATH" \
    -H "Accept: application/json")

echo "Response: $response"

# Extract upload ID
upload_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$upload_id" ]; then
    echo "❌ Upload failed"
    exit 1
fi

echo "✅ Upload ID: $upload_id"

# Check status every 2 seconds
for i in {1..10}; do
    sleep 2
    echo "🔄 Checking status (attempt $i)..."
    
    status_json=$(curl -s "http://localhost:3000/api/uploads/status" | \
        jq ".[] | select(.id == \"$upload_id\")")
    
    if [ -n "$status_json" ]; then
        status=$(echo "$status_json" | jq -r '.status')
        rows=$(echo "$status_json" | jq -r '.totalRowsProcessed')
        supplier=$(echo "$status_json" | jq -r '.supplier.name')
        error=$(echo "$status_json" | jq -r '.errorMessage // "none"')
        
        echo "  Status: $status"
        echo "  Rows processed: $rows"
        echo "  Supplier: $supplier"
        echo "  Error: $error"
        
        if [ "$status" != "processing" ] && [ "$status" != "pending" ]; then
            echo "🏁 Processing complete!"
            
            # Show extracted data sample
            echo "📊 Extracted data sample:"
            echo "$status_json" | jq '.extractedData.products[:3]'
            break
        fi
    fi
done