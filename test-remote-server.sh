#!/bin/bash

# Remote server test script
SERVER="http://209.38.85.196:3000"

echo "🧪 Testing Remote Server: $SERVER"
echo "================================================="

# Test 1: Server Health
echo -e "\n1️⃣ Server Health Check:"
curl -s -o /dev/null -w "   Homepage: %{http_code} (Response time: %{time_total}s)\n" $SERVER/
curl -s -o /dev/null -w "   Admin: %{http_code} (Response time: %{time_total}s)\n" $SERVER/admin

# Test 2: API Endpoints
echo -e "\n2️⃣ API Endpoints:"
curl -s -o /dev/null -w "   /api/stats: %{http_code}\n" $SERVER/api/stats
curl -s -o /dev/null -w "   /api/products: %{http_code}\n" "$SERVER/api/products?limit=1"
curl -s -o /dev/null -w "   /api/suppliers: %{http_code}\n" $SERVER/api/suppliers
curl -s -o /dev/null -w "   /api/token-usage: %{http_code}\n" $SERVER/api/token-usage

# Test 3: Enhanced Upload Feature
echo -e "\n3️⃣ Enhanced Upload Feature:"
# Check if Enhanced Upload UI is loaded
ENHANCED_CHECK=$(curl -s $SERVER/ | grep -c "useEnhancedUpload")
if [ $ENHANCED_CHECK -gt 0 ]; then
    echo "   ✅ Enhanced Upload toggle found in UI"
else
    echo "   ❌ Enhanced Upload toggle NOT found"
fi

# Test SSE endpoint
SSE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Accept: text/event-stream" $SERVER/api/admin/uploads/status/test-id/stream)
echo "   SSE endpoint: HTTP $SSE_STATUS"

# Test 4: Database Stats
echo -e "\n4️⃣ Database Statistics:"
STATS=$(curl -s $SERVER/api/stats)
echo "   Products: $(echo $STATS | jq -r .products)"
echo "   Suppliers: $(echo $STATS | jq -r .suppliers)"
echo "   Uploads: $(echo $STATS | jq -r .uploads)"
echo "   Last Update: $(echo $STATS | jq -r .lastUpdate)"

# Test 5: Recent Upload
echo -e "\n5️⃣ Most Recent Upload:"
UPLOAD=$(curl -s "$SERVER/api/admin/uploads/status?limit=1" | jq -r '.[0]')
if [ "$UPLOAD" != "null" ]; then
    echo "   File: $(echo $UPLOAD | jq -r .originalName)"
    echo "   Status: $(echo $UPLOAD | jq -r .status)"
    echo "   Date: $(echo $UPLOAD | jq -r .createdAt | cut -d'T' -f1)"
else
    echo "   No uploads found"
fi

# Test 6: Performance Check
echo -e "\n6️⃣ Performance Metrics:"
# Multiple concurrent requests
echo "   Testing concurrent requests..."
START_TIME=$(date +%s.%N)
for i in {1..5}; do
    curl -s -o /dev/null $SERVER/api/products?limit=10 &
done
wait
END_TIME=$(date +%s.%N)
DURATION=$(echo "$END_TIME - $START_TIME" | bc)
echo "   5 concurrent requests completed in: ${DURATION}s"

echo -e "\n✅ Testing Complete!"
echo "================================================="