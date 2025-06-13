const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStandardizationIssues() {
  try {
    // Find products with potential spelling issues
    const problematicProducts = await prisma.product.findMany({
      where: {
        OR: [
          { rawName: { contains: 'poteto', mode: 'insensitive' } },
          { rawName: { contains: 'kepok', mode: 'insensitive' } },
          { name: { contains: 'poteto', mode: 'insensitive' } },
          { name: { contains: 'kepok', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        rawName: true,
        name: true,
        standardizedName: true,
        unit: true,
        standardizedUnit: true,
        category: true
      }
    });

    console.log('Found products with potential standardization issues:');
    console.log(JSON.stringify(problematicProducts, null, 2));

    // Check if standardization is working correctly
    console.log('\n\nChecking standardization patterns:');
    
    // Find products where rawName differs significantly from standardizedName
    const allProducts = await prisma.product.findMany({
      where: {
        standardizedName: { not: null }
      },
      take: 50,
      select: {
        rawName: true,
        standardizedName: true,
        standardizedUnit: true
      }
    });

    // Group by patterns
    const patterns = {
      indonesianToEnglish: [],
      misspellings: [],
      unitConversions: []
    };

    allProducts.forEach(product => {
      if (product.rawName && product.standardizedName) {
        const raw = product.rawName.toLowerCase();
        const std = product.standardizedName.toLowerCase();
        
        // Check for Indonesian words
        if (raw.includes('pisang') && std.includes('banana')) {
          patterns.indonesianToEnglish.push(product);
        } else if (raw.includes('kentang') && std.includes('potato')) {
          patterns.indonesianToEnglish.push(product);
        }
        
        // Check for potential misspellings
        if (raw.includes('poteto') || raw.includes('brocoly')) {
          patterns.misspellings.push(product);
        }
      }
    });

    console.log('\nIndonesian to English translations:', patterns.indonesianToEnglish.length);
    console.log('Potential misspellings:', patterns.misspellings.length);
    
    if (patterns.misspellings.length > 0) {
      console.log('\nMisspelling examples:');
      patterns.misspellings.forEach(p => {
        console.log(`  "${p.rawName}" -> "${p.standardizedName}"`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStandardizationIssues();