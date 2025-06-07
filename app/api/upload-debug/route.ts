import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID(),
    environment: {
      hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasDatabase: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    }
  };

  console.log('🚀 Upload Debug Started:', debugInfo);

  try {
    // Check environment variables
    if (!process.env.DATABASE_URL) {
      console.error('❌ Missing DATABASE_URL');
      return NextResponse.json({
        error: 'Database not configured',
        debug: debugInfo
      }, { status: 500 });
    }

    // Test database connection
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return NextResponse.json({
        error: 'Database connection failed',
        debug: { ...debugInfo, dbError: dbError instanceof Error ? dbError.message : 'Unknown' }
      }, { status: 500 });
    }

    // Parse form data
    let formData;
    try {
      formData = await request.formData();
      console.log('✅ Form data parsed successfully');
    } catch (parseError) {
      console.error('❌ Form data parsing failed:', parseError);
      return NextResponse.json({
        error: 'Failed to parse form data',
        debug: { ...debugInfo, parseError: parseError instanceof Error ? parseError.message : 'Unknown' }
      }, { status: 400 });
    }

    const files = formData.getAll('files') as File[];
    const supplierId = formData.get('supplierId') as string;

    console.log('📋 Upload details:', {
      fileCount: files.length,
      fileNames: files.map(f => f.name),
      fileSizes: files.map(f => f.size),
      mimeTypes: files.map(f => f.type),
      supplierId: supplierId || 'auto-detect'
    });

    if (!files || files.length === 0) {
      console.error('❌ No files provided');
      return NextResponse.json({
        error: 'No files uploaded',
        debug: debugInfo
      }, { status: 400 });
    }

    // Check file sizes and types
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'image/png', 'image/jpeg'];
    
    for (const file of files) {
      if (file.size > maxSize) {
        console.error(`❌ File too large: ${file.name} (${file.size} bytes)`);
        return NextResponse.json({
          error: `File ${file.name} is too large. Maximum size is 10MB.`,
          debug: debugInfo
        }, { status: 400 });
      }
      
      if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
        console.warn(`⚠️ Unsupported file type: ${file.name} (${file.type})`);
      }
    }

    // Create/find supplier
    let finalSupplierId = supplierId;
    if (!supplierId) {
      try {
        const tempSupplier = await prisma.supplier.upsert({
          where: { name: 'Temporary Processing' },
          update: {},
          create: {
            name: 'Temporary Processing',
            email: 'temp@processing.com'
          }
        });
        finalSupplierId = tempSupplier.id;
        console.log('✅ Temporary supplier created/found:', tempSupplier.id);
      } catch (supplierError) {
        console.error('❌ Failed to create temporary supplier:', supplierError);
        return NextResponse.json({
          error: 'Failed to create supplier',
          debug: { ...debugInfo, supplierError: supplierError instanceof Error ? supplierError.message : 'Unknown' }
        }, { status: 500 });
      }
    } else {
      // Verify supplier exists
      try {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId }
        });
        if (!supplier) {
          console.error('❌ Supplier not found:', supplierId);
          return NextResponse.json({
            error: 'Supplier not found',
            debug: debugInfo
          }, { status: 400 });
        }
        console.log('✅ Supplier verified:', supplier.name);
      } catch (supplierError) {
        console.error('❌ Failed to verify supplier:', supplierError);
        return NextResponse.json({
          error: 'Failed to verify supplier',
          debug: { ...debugInfo, supplierError: supplierError instanceof Error ? supplierError.message : 'Unknown' }
        }, { status: 500 });
      }
    }

    const uploadResults = [];

    for (const file of files) {
      console.log(`📄 Processing file: ${file.name}`);
      
      try {
        // For now, simulate file upload without Vercel Blob
        let fileUrl = `https://mock-storage.com/${Date.now()}-${file.name}`;
        
        // If Blob token is available, try real upload
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          try {
            const { put } = await import('@vercel/blob');
            const blob = await put(file.name, file, {
              access: 'public',
            });
            fileUrl = blob.url;
            console.log('✅ File uploaded to Blob storage:', fileUrl);
          } catch (blobError) {
            console.error('❌ Blob storage upload failed:', blobError);
            // Continue with mock URL
            console.log('⚠️ Using mock URL instead');
          }
        } else {
          console.log('⚠️ Blob storage not configured, using mock URL');
        }

        // Create upload record
        const upload = await prisma.upload.create({
          data: {
            filename: fileUrl,
            originalName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            supplierId: finalSupplierId,
            status: 'pending'
          }
        });

        console.log('✅ Upload record created:', upload.id);

        uploadResults.push({
          id: upload.id,
          filename: file.name,
          status: 'uploaded',
          url: fileUrl
        });

        // Simulate processing without OpenAI for now
        if (process.env.OPENAI_API_KEY) {
          console.log('🧠 Starting AI processing...');
          processFileInBackground(upload.id);
        } else {
          console.log('⚠️ OpenAI not configured, creating mock data...');
          createMockData(upload.id);
        }

      } catch (fileError) {
        console.error(`❌ Error processing file ${file.name}:`, fileError);
        uploadResults.push({
          filename: file.name,
          status: 'error',
          error: fileError instanceof Error ? fileError.message : 'Unknown error'
        });
      }
    }

    console.log('🎉 Upload completed:', {
      successful: uploadResults.filter(r => r.status === 'uploaded').length,
      failed: uploadResults.filter(r => r.status === 'error').length
    });

    return NextResponse.json({
      message: 'Upload process completed',
      results: uploadResults,
      debug: debugInfo
    });

  } catch (error) {
    console.error('💥 Fatal upload error:', error);
    return NextResponse.json({
      error: 'Upload failed',
      debug: { 
        ...debugInfo, 
        fatalError: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

async function processFileInBackground(uploadId: string) {
  try {
    console.log(`🔄 Background processing started for: ${uploadId}`);
    
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'processing' }
    });

    // Import and run file processor
    const { processFile } = await import('../../services/fileProcessor');
    await processFile(uploadId);
    
    console.log(`✅ Background processing completed for: ${uploadId}`);
  } catch (error) {
    console.error(`❌ Background processing failed for ${uploadId}:`, error);
    
    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

async function createMockData(uploadId: string) {
  try {
    console.log(`🎭 Creating mock data for: ${uploadId}`);
    
    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: 'completed',
        extractedData: {
          products: [
            { name: 'Sample Product 1', price: 10.99, unit: 'kg', category: 'Test' },
            { name: 'Sample Product 2', price: 15.50, unit: 'kg', category: 'Test' }
          ]
        }
      }
    });
    
    console.log(`✅ Mock data created for: ${uploadId}`);
  } catch (error) {
    console.error(`❌ Mock data creation failed for ${uploadId}:`, error);
  }
}