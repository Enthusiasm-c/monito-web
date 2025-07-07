const { PrismaClient } = require('@prisma/client');

async function checkRecentWidiUploads() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking recent Widi Wiguna uploads...');
    
    // Get uploads from the last hour with Widi in filename
    const recentUploads = await prisma.upload.findMany({
      where: {
        fileName: {
          contains: 'Widi',
          mode: 'insensitive'
        },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      },
      include: {
        supplier: true,
        prices: {
          include: {
            product: true
          },
          take: 5
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    if (recentUploads.length === 0) {
      console.log('📭 No recent Widi uploads found in the last hour');
      
      // Check all Widi uploads
      const allWidiUploads = await prisma.upload.findMany({
        where: {
          fileName: {
            contains: 'Widi',
            mode: 'insensitive'
          }
        },
        include: {
          supplier: true,
          prices: {
            include: {
              product: true
            },
            take: 3
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 3
      });
      
      console.log(`📋 Found ${allWidiUploads.length} total Widi uploads:`);
      allWidiUploads.forEach((upload, index) => {
        console.log(`${index + 1}. ${upload.fileName} - ${upload.status} (${upload.createdAt.toISOString()})`);
        console.log(`   Supplier: ${upload.supplier?.name || 'Unknown'}`);
        console.log(`   Products found: ${upload.prices?.length || 0}`);
      });
      
      return;
    }
    
    console.log(`✅ Found ${recentUploads.length} recent Widi uploads:`);
    
    recentUploads.forEach((upload, index) => {
      console.log(`\n${index + 1}. Upload ID: ${upload.id}`);
      console.log(`   File: ${upload.fileName}`);
      console.log(`   Status: ${upload.status}`);
      console.log(`   Created: ${upload.createdAt.toISOString()}`);
      console.log(`   Supplier: ${upload.supplier?.name || 'Unknown'}`);
      console.log(`   🎯 PRODUCTS DETECTED: ${upload.prices?.length || 0}`);
      
      if (upload.prices && upload.prices.length > 0) {
        console.log(`   📋 Sample products:`);
        upload.prices.slice(0, 3).forEach((price, pIndex) => {
          console.log(`      ${pIndex + 1}. ${price.product.name} - ${price.amount} ${price.unit}`);
        });
        
        if (upload.prices.length > 3) {
          console.log(`      ... and ${upload.prices.length - 3} more products`);
        }
      }
      
      if (upload.metadata) {
        try {
          const metadata = JSON.parse(upload.metadata);
          if (metadata.extractionQuality) {
            console.log(`   📊 Extraction Quality: ${metadata.extractionQuality}`);
          }
          if (metadata.processor) {
            console.log(`   🔧 Processor: ${metadata.processor}`);
          }
        } catch (e) {
          // Ignore metadata parsing errors
        }
      }
    });
    
    // Also check products count for Widi Wiguna supplier
    const widiSupplier = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: 'Widi',
          mode: 'insensitive'
        }
      },
      include: {
        prices: {
          where: {
            validTo: null // Current prices only
          },
          include: {
            product: true
          }
        }
      }
    });
    
    if (widiSupplier) {
      console.log(`\n🏪 Supplier: ${widiSupplier.name}`);
      console.log(`📦 Current active products: ${widiSupplier.prices?.length || 0}`);
      
      if (widiSupplier.prices && widiSupplier.prices.length > 0) {
        console.log(`🔄 Latest price updates:`);
        const latestPrices = widiSupplier.prices
          .sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom))
          .slice(0, 5);
          
        latestPrices.forEach((price, index) => {
          console.log(`   ${index + 1}. ${price.product.name} - ${price.amount} ${price.unit} (${price.validFrom.toISOString().split('T')[0]})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking uploads:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentWidiUploads();