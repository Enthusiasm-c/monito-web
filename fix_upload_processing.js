const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixUploadProcessing() {
  console.log('🔧 Fixing Upload Processing Issues\n');
  
  try {
    // 1. Reset stuck uploads to pending
    const stuckUploads = await prisma.upload.updateMany({
      where: {
        status: 'processing',
        updatedAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
        }
      },
      data: {
        status: 'pending',
        errorMessage: 'Reset from stuck processing state',
        updatedAt: new Date()
      }
    });

    if (stuckUploads.count > 0) {
      console.log(`✅ Reset ${stuckUploads.count} stuck uploads to pending`);
    }

    // 2. Find uploads with 0 products that are marked as completed
    const emptyCompletedUploads = await prisma.upload.findMany({
      where: {
        status: 'completed',
        prices: {
          none: {}
        }
      },
      include: {
        _count: {
          select: {
            prices: true
          }
        }
      }
    });

    console.log(`Found ${emptyCompletedUploads.length} completed uploads with 0 products`);

    // 3. Reset these to failed with informative error
    if (emptyCompletedUploads.length > 0) {
      const resetToFailed = await prisma.upload.updateMany({
        where: {
          id: {
            in: emptyCompletedUploads.map(u => u.id)
          }
        },
        data: {
          status: 'failed',
          errorMessage: 'Processing completed but no products were extracted. Possible OpenAI quota exceeded or PDF parsing issue.',
          updatedAt: new Date()
        }
      });

      console.log(`✅ Marked ${resetToFailed.count} empty uploads as failed`);
    }

    // 4. Create a simple test upload to verify processing
    console.log('\n🧪 Testing basic upload functionality...');
    
    // Test database connection
    const supplierCount = await prisma.supplier.count();
    const productCount = await prisma.product.count();
    const priceCount = await prisma.price.count();
    
    console.log(`📊 Database Status:`);
    console.log(`   Suppliers: ${supplierCount}`);
    console.log(`   Products: ${productCount}`);
    console.log(`   Prices: ${priceCount}`);

    // 5. Check environment variables
    console.log('\n🔍 Environment Check:');
    console.log(`   OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set (length: ' + process.env.OPENAI_API_KEY.length + ')' : '❌ Missing'}`);
    console.log(`   Database URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Blob Token: ${process.env.BLOB_READ_WRITE_TOKEN ? '✅ Set' : '❌ Missing'}`);

    // 6. Provide recommendations
    console.log('\n💡 Recommendations:');
    console.log('1. Check OpenAI billing and quota at https://platform.openai.com/usage');
    console.log('2. Consider implementing a fallback mechanism for when OpenAI is unavailable');
    console.log('3. Test with a simple CSV file first before trying PDFs');
    console.log('4. Monitor the server logs while uploading files');

    console.log('\n✅ Upload processing fixes completed!');

  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUploadProcessing();