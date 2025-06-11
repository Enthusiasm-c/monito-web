#!/bin/bash

# Test script for real price list files
# This script tests the improved file processing with real supplier files

echo "🚀 Starting real file upload tests..."
echo "=================================="

API_URL="http://localhost:3000/api/upload-smart"
FILES_DIR="/Users/denisdomashenko/Downloads/aibuyer"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to upload a file and check status
upload_file() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    
    echo -e "\n${YELLOW}📤 Uploading: $file_name${NC}"
    
    # Upload file
    response=$(curl -s -X POST "$API_URL" \
        -F "files=@$file_path" \
        -H "Accept: application/json")
    
    # Extract upload ID from response
    upload_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$upload_id" ]; then
        echo -e "${RED}❌ Failed to upload $file_name${NC}"
        echo "Response: $response"
        return 1
    fi
    
    echo -e "${GREEN}✅ Upload successful! ID: $upload_id${NC}"
    
    # Wait for processing
    echo "⏳ Waiting for processing..."
    sleep 5
    
    # Check status
    status_response=$(curl -s "http://localhost:3000/api/uploads/status")
    
    # Find our upload in the status
    upload_status=$(echo "$status_response" | grep -o "\"id\":\"$upload_id\"[^}]*}" | head -1)
    
    if echo "$upload_status" | grep -q '"status":"completed"'; then
        echo -e "${GREEN}✅ Processing completed successfully!${NC}"
    elif echo "$upload_status" | grep -q '"status":"failed"'; then
        error_msg=$(echo "$upload_status" | grep -o '"errorMessage":"[^"]*"' | cut -d'"' -f4)
        echo -e "${RED}❌ Processing failed: $error_msg${NC}"
    elif echo "$upload_status" | grep -q '"status":"pending_review"'; then
        echo -e "${YELLOW}⏸️  Processing completed, pending review${NC}"
    else
        echo -e "${YELLOW}⚠️  Processing still in progress or unknown status${NC}"
    fi
}

# Test different file types
echo -e "\n${YELLOW}1. Testing PDF files:${NC}"
upload_file "$FILES_DIR/Island Organics Bali.pdf"
upload_file "$FILES_DIR/bali boga.pdf"

echo -e "\n${YELLOW}2. Testing Excel files:${NC}"
upload_file "$FILES_DIR/Oka veg supplier.xlsx"
upload_file "$FILES_DIR/plaga farm bali.xlsx"

echo -e "\n${YELLOW}3. Testing Image files:${NC}"
upload_file "$FILES_DIR/munch bakery.jpg"

echo -e "\n${YELLOW}4. Testing CSV files:${NC}"
upload_file "$FILES_DIR/suppliers list Buyer + - Поставщики FOOD.csv"

# Check final statistics
echo -e "\n${YELLOW}📊 Final Statistics:${NC}"
stats=$(curl -s "http://localhost:3000/api/stats")
echo "Stats: $stats"

# Check suppliers
echo -e "\n${YELLOW}🏢 Suppliers Created:${NC}"
suppliers=$(curl -s "http://localhost:3000/api/suppliers" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
echo "$suppliers"

echo -e "\n${GREEN}✅ Test completed!${NC}"