#!/bin/bash

echo "🧪 Testing ALL files from aibuyer folder"
echo "========================================"
echo "Date: $(date)"
echo ""

# Create results directory
mkdir -p test-results

# Function to test single file
test_file() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    local test_id=$(date +%s%N)
    
    echo -e "\n📁 Testing: $file_name"
    echo "----------------------------------------"
    
    # Upload file
    response=$(curl -s -X POST "http://localhost:3000/api/upload-smart" \
        -F "files=@$file_path" \
        -H "Accept: application/json")
    
    upload_id=$(echo "$response" | jq -r '.results[0].id // empty')
    
    if [ -z "$upload_id" ]; then
        echo "❌ Upload failed for $file_name"
        echo "$response" > "test-results/failed_${test_id}_${file_name}.json"
        return
    fi
    
    echo "✅ Upload ID: $upload_id"
    
    # Wait for processing
    echo "⏳ Processing..."
    sleep 15
    
    # Get results
    result=$(curl -s "http://localhost:3000/api/uploads/status" | \
        jq ".[] | select(.id == \"$upload_id\")")
    
    # Save full result
    echo "$result" > "test-results/result_${upload_id}.json"
    
    # Extract key metrics
    status=$(echo "$result" | jq -r '.status')
    supplier=$(echo "$result" | jq -r '.supplier.name // "Not detected"')
    total_rows=$(echo "$result" | jq -r '.totalRowsDetected // 0')
    processed_rows=$(echo "$result" | jq -r '.totalRowsProcessed // 0')
    products_count=$(echo "$result" | jq -r '.extractedData.products | length')
    has_errors=$(echo "$result" | jq -r '.errorMessage // empty' | wc -l)
    
    echo "📊 Results:"
    echo "  Status: $status"
    echo "  Supplier: $supplier"
    echo "  Rows: $processed_rows / $total_rows"
    echo "  Products extracted: $products_count"
    
    # Check for price parsing issues
    if [ "$products_count" -gt 0 ]; then
        echo "  Sample prices:"
        echo "$result" | jq -r '.extractedData.products[:3] | .[] | "    - \(.name): \(.price) \(.unit)"' 2>/dev/null
        
        # Check for suspicious prices (likely parsing errors)
        suspicious=$(echo "$result" | jq '[.extractedData.products[].price | select(. < 1000)] | length')
        if [ "$suspicious" -gt 0 ]; then
            echo "  ⚠️  WARNING: $suspicious products with prices < 1000 (possible parsing error)"
        fi
    fi
    
    # Check validation warnings
    if [ "$has_errors" -gt 0 ]; then
        warnings=$(echo "$result" | jq -r '.errorMessage' | grep -c "⚠️" || echo "0")
        echo "  ⚠️  Validation warnings: $warnings"
    fi
    
    # Global stats
    echo "$file_name|$status|$supplier|$products_count|$processed_rows|$total_rows" >> test-results/summary.csv
}

# Initialize summary
echo "FileName|Status|Supplier|Products|ProcessedRows|TotalRows" > test-results/summary.csv

# Test all files
echo "🔍 Finding all files to test..."
files=(
    /Users/denisdomashenko/Downloads/aibuyer/*.pdf
    /Users/denisdomashenko/Downloads/aibuyer/*.xlsx
    /Users/denisdomashenko/Downloads/aibuyer/*.csv
    /Users/denisdomashenko/Downloads/aibuyer/*.jpg
)

total_files=0
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        ((total_files++))
    fi
done

echo "📋 Found $total_files files to test"
echo ""

# Test each file
file_num=0
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        ((file_num++))
        echo "════════════════════════════════════════"
        echo "Testing file $file_num/$total_files"
        test_file "$file"
    fi
done

echo -e "\n\n📈 FINAL SUMMARY"
echo "================"
echo ""

# Summary statistics
echo "📊 Overall Statistics:"
total_tested=$(cat test-results/summary.csv | wc -l | xargs)
((total_tested--)) # Subtract header
successful=$(grep -c "|completed|" test-results/summary.csv || echo "0")
with_errors=$(grep -c "|completed_with_errors|" test-results/summary.csv || echo "0")
failed=$(grep -c "|failed|" test-results/summary.csv || echo "0")
pending=$(grep -c "|processing|" test-results/summary.csv || echo "0")

echo "Total files tested: $total_tested"
echo "✅ Successful: $successful"
echo "⚠️  With errors: $with_errors"
echo "❌ Failed: $failed"
if [ "$pending" -gt 0 ]; then
    echo "⏳ Still processing: $pending"
fi

echo -e "\n📋 Results by file type:"
echo "PDF files:"
grep "\.pdf|" test-results/summary.csv | grep -v "FileName" | awk -F'|' '{print "  " $1 ": " $2 " (" $4 " products)"}'

echo -e "\nExcel files:"
grep "\.xlsx|" test-results/summary.csv | grep -v "FileName" | awk -F'|' '{print "  " $1 ": " $2 " (" $4 " products)"}'

echo -e "\nCSV files:"
grep "\.csv|" test-results/summary.csv | grep -v "FileName" | awk -F'|' '{print "  " $1 ": " $2 " (" $4 " products)"}'

echo -e "\nImage files:"
grep "\.jpg|" test-results/summary.csv | grep -v "FileName" | awk -F'|' '{print "  " $1 ": " $2 " (" $4 " products)"}'

echo -e "\n💾 Detailed results saved in: test-results/"
echo "✅ Testing complete!"