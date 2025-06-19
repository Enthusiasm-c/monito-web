import { prisma } from 'lib/prisma';

const { PrismaClient } = require('@prisma/client');

async function debugProcessing() {
  
  
  try {
    console.log('🔍 DEBUGGING FILE PROCESSING ISSUES');
    console.log('===================================\n');
    
    // Check all uploads
    console.log('📋 ALL UPLOADS IN DATABASE:');
    const uploads = await prisma.upload.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        supplier: true,
        _count: {
          select: { prices: true }
        }
      }
    });
    
    console.log(`Found ${uploads.length} uploads:\n`);
    
    uploads.forEach((upload, index) => {
      console.log(`${index + 1}. ${upload.originalName}`);
      console.log(`   ID: ${upload.id}`);
      console.log(`   Status: ${upload.status}`);
      console.log(`   Approval: ${upload.approvalStatus}`);
      console.log(`   Created: ${upload.createdAt}`);
      console.log(`   Updated: ${upload.updatedAt}`);
      console.log(`   Products: ${upload._count.prices} prices created`);
      console.log(`   Processing time: ${upload.processingTimeMs || 'null'}ms`);
      console.log(`   Error: ${upload.errorMessage || 'none'}`);
      console.log(`   ExtractedData: ${upload.extractedData ? 'present' : 'null'}`);
      console.log('');
    });
    
    // Check for any widi wiguna specifically
    console.log('🔍 SEARCHING FOR WIDI WIGUNA FILES:');
    const widiUploads = await prisma.upload.findMany({
      where: {
        OR: [
          { originalName: { contains: 'widi' } },
          { originalName: { contains: 'wiguna' } },
          { fileName: { contains: 'widi' } },
          { fileName: { contains: 'wiguna' } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        _count: {
          select: { prices: true }
        }
      }
    });
    
    console.log(`Found ${widiUploads.length} widi wiguna uploads:\n`);
    
    widiUploads.forEach((upload, index) => {
      console.log(`${index + 1}. ${upload.originalName || upload.fileName}`);
      console.log(`   Status: ${upload.status}`);
      console.log(`   Products: ${upload._count.prices}`);
      console.log(`   Created: ${upload.createdAt}`);
      console.log(`   Processing time: ${upload.processingTimeMs}ms`);
      
      if (upload.extractedData) {
        const data = typeof upload.extractedData === 'string' 
          ? JSON.parse(upload.extractedData) 
          : upload.extractedData;
        console.log(`   Extracted products: ${Array.isArray(data) ? data.length : 'unknown format'}`);
      }
      console.log('');
    });
    
    // Check recent processing activity
    console.log('⏱️  RECENT PROCESSING ACTIVITY:');
    const recentUploads = await prisma.upload.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`${recentUploads.length} uploads in the last hour:\n`);
    
    recentUploads.forEach(upload => {
      console.log(`- ${upload.originalName}: ${upload.status} (${upload.approvalStatus})`);
    });
    
    // Check for any products/prices created
    console.log('\n📦 PRODUCTS AND PRICES:');
    const productCount = await prisma.product.count();
    const priceCount = await prisma.price.count();
    const supplierCount = await prisma.supplier.count();
    
    console.log(`Products: ${productCount}`);
    console.log(`Prices: ${priceCount}`);
    console.log(`Suppliers: ${supplierCount}`);
    
    if (priceCount > 0) {
      console.log('\n💰 RECENT PRICES:');
      const recentPrices = await prisma.price.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          supplier: true,
          upload: true
        }
      });
      
      recentPrices.forEach(price => {
        console.log(`- ${price.product.name}: ${price.amount} per ${price.unit} (from ${price.upload?.originalName || 'unknown'})`);
      });
    }
    
    // Check processing configuration
    console.log('\n⚙️  PROCESSING CONFIGURATION:');
    console.log('Environment variables:');
    console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'set' : 'missing'}`);
    console.log(`- GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? 'set' : 'missing'}`);
    console.log(`- ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'missing'}`);
    console.log(`- AI_STANDARDIZATION_ENABLED: ${process.env.AI_STANDARDIZATION_ENABLED}`);
    console.log(`- MAX_AI_STANDARDIZATION_PRODUCTS: ${process.env.MAX_AI_STANDARDIZATION_PRODUCTS}`);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

require('dotenv').config();
debugProcessing();