import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');



async function debugUploadIssues() {
  console.log('🔍 Debugging Upload Issues\n');
  
  try {
    // Check recent uploads
    const recentUploads = await prisma.upload.findMany({
      include: {
        supplier: true,
        _count: {
          select: {
            prices: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log('📊 Recent Uploads Analysis:');
    console.log('=====================================');
    
    recentUploads.forEach((upload, index) => {
      console.log(`\n${index + 1}. File: ${upload.fileName}`);
      console.log(`   Status: ${upload.status}`);
      console.log(`   Supplier: ${upload.supplier?.name || 'Unknown'}`);
      console.log(`   Products Found: ${upload._count.prices}`);
      console.log(`   Created: ${upload.createdAt.toLocaleString()}`);
      console.log(`   Updated: ${upload.updatedAt.toLocaleString()}`);
      
      if (upload.errorMessage) {
        console.log(`   ❌ Error: ${upload.errorMessage}`);
      }
      
      if (upload.processingDetails) {
        console.log(`   📝 Processing Details: ${upload.processingDetails}`);
      }
    });

    // Check for stuck uploads
    const stuckUploads = await prisma.upload.findMany({
      where: {
        status: 'processing',
        updatedAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
        }
      }
    });

    if (stuckUploads.length > 0) {
      console.log(`\n⚠️  Found ${stuckUploads.length} stuck uploads (processing for >10 min)`);
      stuckUploads.forEach(upload => {
        console.log(`   - ${upload.fileName} (since ${upload.updatedAt.toLocaleString()})`);
      });
    }

    // Check environment configuration
    console.log('\n🔧 Environment Configuration:');
    console.log('=====================================');
    console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`Database URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
    console.log(`Blob Token: ${process.env.BLOB_READ_WRITE_TOKEN ? '✅ Set' : '❌ Missing'}`);

    // Check for recent failed uploads
    const failedUploads = await prisma.upload.findMany({
      where: {
        status: 'failed',
        createdAt: {
          gt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    if (failedUploads.length > 0) {
      console.log(`\n❌ Recent Failed Uploads (last 24h): ${failedUploads.length}`);
      failedUploads.forEach(upload => {
        console.log(`   - ${upload.fileName}: ${upload.errorMessage}`);
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('=====================================');
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ Set OPENAI_API_KEY in your .env file');
    } else if (recentUploads.some(u => u.errorMessage?.includes('quota'))) {
      console.log('💰 Check OpenAI billing and increase quota limits');
      console.log('🔗 https://platform.openai.com/usage');
    }
    
    if (recentUploads.some(u => u.errorMessage?.includes('DOMMatrix'))) {
      console.log('🔧 PDF parsing needs Node.js environment fix');
      console.log('   Consider using serverless-friendly PDF parser');
    }
    
    if (stuckUploads.length > 0) {
      console.log('🔄 Reset stuck uploads to pending status');
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUploadIssues();