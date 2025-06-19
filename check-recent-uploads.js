import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');


async function checkRecentUploads() {
  try {
    const recentUploads = await prisma.upload.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: {
          select: { prices: true }
        }
      }
    });
    
    console.log('Recent uploads (last 24 hours):');
    console.log('================================');
    
    recentUploads.forEach(upload => {
      console.log(`ID: ${upload.id}`);
      console.log(`File: ${upload.fileName}`);
      console.log(`Status: ${upload.status}`);
      console.log(`Prices: ${upload._count.prices}`);
      console.log(`Created: ${upload.createdAt}`);
      console.log('---');
    });
    
    const stuckUploads = await prisma.upload.findMany({
      where: {
        status: 'processing',
        createdAt: {
          lte: new Date(Date.now() - 10 * 60 * 1000) // Older than 10 minutes
        }
      }
    });
    
    if (stuckUploads.length > 0) {
      console.log('\nStuck uploads (processing > 10 minutes):');
      console.log('========================================');
      stuckUploads.forEach(upload => {
        console.log(`ID: ${upload.id} - ${upload.fileName} - Created: ${upload.createdAt}`);
      });
    } else {
      console.log('\nNo stuck uploads found.');
    }
    
    // Check pending approval uploads
    const pendingApproval = await prisma.upload.findMany({
      where: {
        status: 'pending_review'
      },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    
    if (pendingApproval.length > 0) {
      console.log('\nUploads pending approval:');
      console.log('========================');
      pendingApproval.forEach(upload => {
        console.log(`ID: ${upload.id} - ${upload.fileName} - Prices: ${upload._count.prices}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentUploads();