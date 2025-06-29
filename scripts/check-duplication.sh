#!/bin/bash

# 🔍 Code Duplication Checker for Monito Web
# MANDATORY: Run before any commit to prevent duplication

echo "🔍 CHECKING FOR CODE DUPLICATION..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check 1: Singleton duplication
echo -n "1. Checking singleton patterns... "
SINGLETONS=$(grep -r "static getInstance" app/services/ 2>/dev/null | grep -v "BaseProcessor" | wc -l)
if [ $SINGLETONS -gt 0 ]; then
  echo -e "${RED}FAILED${NC}"
  echo "   ❌ Found $SINGLETONS custom singleton patterns"
  echo "   🔧 Fix: Use 'class YourClass extends BaseProcessor'"
  grep -r "static getInstance" app/services/ | grep -v "BaseProcessor"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}PASSED${NC}"
fi

# Check 2: Try-catch duplication in API routes
echo -n "2. Checking API error handling... "
TRYCATCH=$(grep -r "try {" app/api/ 2>/dev/null | wc -l)
if [ $TRYCATCH -gt 0 ]; then
  echo -e "${RED}FAILED${NC}"
  echo "   ❌ Found $TRYCATCH try-catch blocks in API routes"
  echo "   🔧 Fix: Use 'export const GET = asyncHandler(async () => {})'"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}PASSED${NC}"
fi

# Check 3: Direct Prisma in API routes
echo -n "3. Checking database access patterns... "
PRISMA=$(grep -r "prisma\." app/api/ 2>/dev/null | wc -l)
if [ $PRISMA -gt 0 ]; then
  echo -e "${RED}FAILED${NC}"
  echo "   ❌ Found $PRISMA direct Prisma calls in API routes"
  echo "   🔧 Fix: Use 'databaseService.method()'"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}PASSED${NC}"
fi

# Check 4: Unit conversion duplication
echo -n "4. Checking unit conversion functions... "
UNITS=$(grep -r "calcUnitPrice\|calculateUnitPrice" app/ --exclude-dir=node_modules --exclude="unified-unit-converter.ts" 2>/dev/null | grep -v "import" | wc -l)
if [ $UNITS -gt 0 ]; then
  echo -e "${RED}FAILED${NC}"
  echo "   ❌ Found $UNITS duplicate unit conversion functions"
  echo "   🔧 Fix: Use 'import { calculateUnitPrice } from unified-unit-converter'"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}PASSED${NC}"
fi

# Check 5: Documentation duplication
echo -n "5. Checking documentation files... "
DOCS=$(find docs/ -name "*.md" 2>/dev/null | wc -l)
if [ $DOCS -gt 4 ]; then
  echo -e "${RED}FAILED${NC}"
  echo "   ❌ Found $DOCS documentation files (max 4 allowed)"
  echo "   📁 Expected: ARCHITECTURE.md, REFACTORING_GUIDE.md, DEVELOPER_GUIDE.md, README.md"
  echo "   🔧 Fix: Update existing files instead of creating new ones"
  echo "   📂 Current files:"
  find docs/ -name "*.md" | sed 's/^/      /'
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}PASSED${NC}"
fi

# Check 6: Duplicate API endpoints
echo -n "6. Checking for duplicate API routes... "
ROUTES=$(find app/api -name "route.ts" -exec basename $(dirname {}) \; 2>/dev/null | sort | uniq -d | wc -l)
if [ $ROUTES -gt 0 ]; then
  echo -e "${YELLOW}WARNING${NC}"
  echo "   ⚠️  Found potential duplicate API routes"
  find app/api -name "route.ts" -exec basename $(dirname {}) \; | sort | uniq -d
else
  echo -e "${GREEN}PASSED${NC}"
fi

# Check 7: Import duplication
echo -n "7. Checking for import statement patterns... "
OLD_IMPORTS=$(grep -r "from.*product-normalizer.*calcUnitPrice" app/ 2>/dev/null | wc -l)
if [ $OLD_IMPORTS -gt 0 ]; then
  echo -e "${RED}FAILED${NC}"
  echo "   ❌ Found $OLD_IMPORTS old unit converter imports"
  echo "   🔧 Fix: Use 'from unified-unit-converter'"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}PASSED${NC}"
fi

# Check 8: Error handling imports
echo -n "8. Checking error handling imports... "
MISSING_ASYNC=$(grep -r "export.*async function" app/api/ 2>/dev/null | wc -l)
if [ $MISSING_ASYNC -gt 0 ]; then
  echo -e "${RED}FAILED${NC}"
  echo "   ❌ Found $MISSING_ASYNC old-style async function exports"
  echo "   🔧 Fix: Use 'export const GET = asyncHandler(...)'"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}PASSED${NC}"
fi

echo "=================================="

# Final result
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
  echo "✨ No code duplication detected. You're good to commit!"
  exit 0
else
  echo -e "${RED}❌ $ERRORS CHECKS FAILED${NC}"
  echo ""
  echo "🚨 COMMIT BLOCKED: Fix duplication issues before committing"
  echo ""
  echo "📖 Quick fixes:"
  echo "   • Extend BaseProcessor instead of custom singletons"
  echo "   • Use asyncHandler instead of try-catch in API routes"
  echo "   • Use databaseService instead of direct Prisma"
  echo "   • Use unified-unit-converter for all unit operations"
  echo "   • Update existing docs instead of creating new files"
  echo ""
  echo "📚 See docs/REFACTORING_GUIDE.md for detailed patterns"
  exit 1
fi