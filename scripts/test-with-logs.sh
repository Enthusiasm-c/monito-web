#!/bin/bash

# Test single file and capture server logs

echo "🔬 Testing with detailed logging..."

# First, clear any old uploads to reduce noise
echo "🧹 Checking recent uploads..."
recent=$(curl -s http://localhost:3000/api/uploads/status | jq 'length')
echo "Found $recent uploads in system"

# Upload the file
FILE="$1"
echo "📤 Uploading: $FILE"

response=$(curl -s -X POST "http://localhost:3000/api/upload-smart" \
    -F "files=@$FILE" \
    -H "Accept: application/json")

upload_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$upload_id" ]; then
    echo "❌ Upload failed"
    echo "$response"
    exit 1
fi

echo "✅ Upload ID: $upload_id"
echo "⏳ Waiting for processing..."

# Monitor for 30 seconds
for i in {1..15}; do
    sleep 2
    
    # Get detailed status
    status_full=$(curl -s "http://localhost:3000/api/uploads/status" | \
        jq ".[] | select(.id == \"$upload_id\")")
    
    if [ -n "$status_full" ]; then
        status=$(echo "$status_full" | jq -r '.status')
        echo "[$i] Status: $status"
        
        if [ "$status" != "processing" ] && [ "$status" != "pending" ]; then
            echo "🏁 Final status:"
            echo "$status_full" | jq '{
                status,
                totalRowsDetected,
                totalRowsProcessed,
                completenessRatio,
                processingTimeMs,
                errorMessage,
                supplier: .supplier.name,
                products: (.extractedData.products | length)
            }'
            
            # Show extraction details
            echo "📋 Extraction details:"
            echo "$status_full" | jq '.extractedData | {
                totalRowsDetected,
                totalRowsProcessed,
                sheets: .sheets,
                errors: .errors[:3]
            }'
            
            break
        fi
    fi
done

echo "
💡 Check server console for detailed logs about:
   - Sheet structure detection
   - Column mapping
   - Product extraction
"