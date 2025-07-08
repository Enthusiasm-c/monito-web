/**
 * Script to validate data quality and generate report
 * Shows what needs to be fixed in the database
 */

import { PrismaClient } from '@prisma/client';
import { standardizeUnit } from '../app/services/standardization';

const prisma = new PrismaClient();

interface ValidationReport {
  totalProducts: number;
  totalPrices: number;
  issues: {
    indonesianNames: Array<{ id: string; name: string }>;
    nullPrices: Array<{ id: string; productName: string }>;
    invalidUnits: Array<{ id: string; unit: string; standardizedUnit: string | null }>;
    missingUnitPrices: Array<{ id: string; amount: number }>;
    duplicateProducts: Array<{ name: string; unit: string; count: number }>;
    outOfRangePrices: Array<{ id: string; amount: number; productName: string }>;
  };
  summary: {
    indonesianNamesCount: number;
    nullPricesCount: number;
    invalidUnitsCount: number;
    missingUnitPricesCount: number;
    duplicateProductsCount: number;
    outOfRangePricesCount: number;
    percentageWithIssues: number;
  };
}

async function validateData(): Promise<ValidationReport> {
  console.log('🔍 Validating data quality...\n');

  const report: ValidationReport = {
    totalProducts: 0,
    totalPrices: 0,
    issues: {
      indonesianNames: [],
      nullPrices: [],
      invalidUnits: [],
      missingUnitPrices: [],
      duplicateProducts: [],
      outOfRangePrices: []
    },
    summary: {
      indonesianNamesCount: 0,
      nullPricesCount: 0,
      invalidUnitsCount: 0,
      missingUnitPricesCount: 0,
      duplicateProductsCount: 0,
      outOfRangePricesCount: 0,
      percentageWithIssues: 0
    }
  };

  // 1. Check for Indonesian names
  console.log('1️⃣ Checking for Indonesian product names...');
  const indonesianWords = ['apel', 'wortel', 'tomat', 'bawang', 'kentang', 'ayam', 'sapi', 'ikan', 'sayur', 'buah', 'daging', 'telur', 'gula', 'garam', 'minyak', 'tepung', 'beras'];
  
  const productsWithIndonesian = await prisma.product.findMany({
    where: {
      OR: indonesianWords.map(word => ({
        standardizedName: {
          contains: word,
          mode: 'insensitive'
        }
      }))
    },
    select: {
      id: true,
      standardizedName: true
    }
  });

  report.issues.indonesianNames = productsWithIndonesian.map(p => ({
    id: p.id,
    name: p.standardizedName
  }));
  report.summary.indonesianNamesCount = productsWithIndonesian.length;

  // 2. Check for null prices
  console.log('2️⃣ Checking for null/zero prices...');
  const pricesWithIssues = await prisma.price.findMany({
    where: {
      amount: 0
    },
    include: {
      product: {
        select: {
          name: true
        }
      }
    }
  });

  report.issues.nullPrices = pricesWithIssues.map(p => ({
    id: p.id,
    productName: p.product.name
  }));
  report.summary.nullPricesCount = pricesWithIssues.length;

  // 3. Check for invalid units
  console.log('3️⃣ Checking for invalid standardized units...');
  const validUnits = new Set(['kg', 'g', 'mg', 'lb', 'oz', 'L', 'mL', 'pcs', 'sheet', 'pack', 'box', 'carton', 'bottle', 'can', 'bag', 'bunch', 'bundle', '1000', 'dozen', 'score', 'gross', 'ream']);
  
  const products = await prisma.product.findMany({
    select: {
      id: true,
      unit: true,
      standardizedUnit: true
    }
  });

  for (const product of products) {
    const expectedUnit = standardizeUnit(product.unit);
    if (!validUnits.has(product.standardizedUnit || '') || product.standardizedUnit !== expectedUnit) {
      report.issues.invalidUnits.push({
        id: product.id,
        unit: product.unit,
        standardizedUnit: product.standardizedUnit
      });
    }
  }
  report.summary.invalidUnitsCount = report.issues.invalidUnits.length;

  // 4. Check for missing unit prices
  console.log('4️⃣ Checking for missing unit prices...');
  const pricesWithoutUnitPrice = await prisma.price.findMany({
    where: {
      OR: [
        { unitPrice: null },
        { unitPrice: 0 }
      ]
    },
    select: {
      id: true,
      amount: true
    }
  });

  report.issues.missingUnitPrices = pricesWithoutUnitPrice.map(p => ({
    id: p.id,
    amount: p.amount.toNumber()
  }));
  report.summary.missingUnitPricesCount = pricesWithoutUnitPrice.length;

  // 5. Check for duplicate products
  console.log('5️⃣ Checking for duplicate products...');
  const duplicates = await prisma.$queryRaw<Array<{
    standardizedName: string;
    standardizedUnit: string;
    count: bigint;
  }>>`
    SELECT "standardizedName", "standardizedUnit", COUNT(*) as count
    FROM products
    WHERE "standardizedName" IS NOT NULL AND "standardizedUnit" IS NOT NULL
    GROUP BY "standardizedName", "standardizedUnit"
    HAVING COUNT(*) > 1
  `;

  report.issues.duplicateProducts = duplicates.map(d => ({
    name: d.standardizedName,
    unit: d.standardizedUnit,
    count: Number(d.count)
  }));
  report.summary.duplicateProductsCount = duplicates.reduce((sum, d) => sum + Number(d.count) - 1, 0);

  // 6. Check for out-of-range prices
  console.log('6️⃣ Checking for out-of-range prices...');
  const outOfRangePrices = await prisma.price.findMany({
    where: {
      OR: [
        { amount: { lt: 100 } },
        { amount: { gt: 10000000 } }
      ]
    },
    include: {
      product: {
        select: {
          name: true
        }
      }
    }
  });

  report.issues.outOfRangePrices = outOfRangePrices.map(p => ({
    id: p.id,
    amount: p.amount.toNumber(),
    productName: p.product.name
  }));
  report.summary.outOfRangePricesCount = outOfRangePrices.length;

  // Calculate totals
  report.totalProducts = await prisma.product.count();
  report.totalPrices = await prisma.price.count();

  const totalIssues = 
    report.summary.indonesianNamesCount +
    report.summary.invalidUnitsCount +
    report.summary.duplicateProductsCount;

  report.summary.percentageWithIssues = report.totalProducts > 0
    ? (totalIssues / report.totalProducts) * 100
    : 0;

  return report;
}

async function main() {
  const report = await validateData();

  // Print summary
  console.log('\n📊 Data Quality Report');
  console.log('======================\n');

  console.log(`Total Products: ${report.totalProducts}`);
  console.log(`Total Prices: ${report.totalPrices}\n`);

  console.log('Issues Found:');
  console.log(`❌ Indonesian names: ${report.summary.indonesianNamesCount}`);
  console.log(`❌ Null/zero prices: ${report.summary.nullPricesCount}`);
  console.log(`❌ Invalid units: ${report.summary.invalidUnitsCount}`);
  console.log(`❌ Missing unit prices: ${report.summary.missingUnitPricesCount}`);
  console.log(`❌ Duplicate products: ${report.summary.duplicateProductsCount}`);
  console.log(`❌ Out-of-range prices: ${report.summary.outOfRangePricesCount}`);

  console.log(`\n📈 ${report.summary.percentageWithIssues.toFixed(1)}% of products have issues\n`);

  // Show samples
  if (report.issues.indonesianNames.length > 0) {
    console.log('\nSample Indonesian names:');
    report.issues.indonesianNames.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name}`);
    });
  }

  if (report.issues.invalidUnits.length > 0) {
    console.log('\nSample invalid units:');
    report.issues.invalidUnits.slice(0, 5).forEach(p => {
      console.log(`  - "${p.unit}" → "${p.standardizedUnit}" (should be "${standardizeUnit(p.unit)}")`);
    });
  }

  if (report.issues.duplicateProducts.length > 0) {
    console.log('\nSample duplicate products:');
    report.issues.duplicateProducts.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name} (${p.unit}): ${p.count} copies`);
    });
  }

  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (report.summary.indonesianNamesCount > 0) {
    console.log('1. Run: npm run fix:indonesian');
  }
  
  if (report.summary.invalidUnitsCount > 0 || report.summary.missingUnitPricesCount > 0) {
    console.log('2. Run: npm run fix:data');
  }
  
  if (report.summary.duplicateProductsCount > 0) {
    console.log('3. Run: npm run fix:duplicates');
  }

  if (report.summary.percentageWithIssues > 20) {
    console.log('\n⚠️ High percentage of issues detected. Consider re-uploading data with the fixed pipeline.');
  }

  // Save detailed report
  const fs = await import('fs/promises');
  const reportPath = 'data-quality-report.json';
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });