import { prisma } from '../lib/prisma';

const { PrismaClient } = require('@prisma/client');



async function cleanupStuckUploads() {
  console.log('🧹 Cleaning up stuck uploads...');
  
  try {
    // Find all uploads stuck in processing status for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const stuckUploads = await prisma.upload.findMany({
      where: {
        status: 'processing',
        updatedAt: {
          lt: tenMinutesAgo
        }
      }
    });
    
    console.log(`Found ${stuckUploads.length} stuck uploads`);
    
    if (stuckUploads.length > 0) {
      // Update stuck uploads to failed status
      const result = await prisma.upload.updateMany({
        where: {
          status: 'processing',
          updatedAt: {
            lt: tenMinutesAgo
          }
        },
        data: {
          status: 'failed',
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Updated ${result.count} stuck uploads to failed status`);
    }
    
    // Also clean up any uploads with "milk up" in the name that are stuck
    const milkUploads = await prisma.upload.findMany({
      where: {
        originalName: {
          contains: 'milk up',
          mode: 'insensitive'
        },
        status: 'processing'
      }
    });
    
    if (milkUploads.length > 0) {
      console.log(`Found ${milkUploads.length} stuck "milk up" uploads`);
      
      const milkResult = await prisma.upload.updateMany({
        where: {
          originalName: {
            contains: 'milk up',
            mode: 'insensitive'
          },
          status: 'processing'
        },
        data: {
          status: 'failed',
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Updated ${milkResult.count} "milk up" uploads to failed status`);
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up uploads:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupStuckUploads();