const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function compareUploadsWithFolder() {
  try {
    // Get all uploads from database
    const allUploads = await prisma.upload.findMany({
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        _count: {
          select: { prices: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('=== DATABASE UPLOADS ===');
    console.log(`Total uploads in database: ${allUploads.length}`);
    console.log('');
    
    // Filter for July 2025 files (files that contain date patterns like 03_07, 04_07, etc.)
    const julyUploads = allUploads.filter(upload => {
      const fileName = upload.fileName.toLowerCase();
      // Match patterns like 03_07, 04_07, 05_07, 06_07, 07_07 for July 2025
      return fileName.includes('03_07') || fileName.includes('04_07') || 
             fileName.includes('05_07') || fileName.includes('06_07') || 
             fileName.includes('07_07');
    });
    
    console.log('=== JULY 2025 UPLOADS IN DATABASE ===');
    console.log(`July 2025 uploads: ${julyUploads.length}`);
    julyUploads.forEach(upload => {
      console.log(`- ${upload.fileName} (Status: ${upload.status}, Prices: ${upload._count.prices})`);
    });
    console.log('');
    
    // Complete list of files from folder (as provided by user)
    const folderFiles = [
      '0z britts 1 04_07.pdf',
      'AF Seafood 03_07.pdf',
      'Bali diary 05_07 .pdf',
      'Benoa fish market 03_07.pdf',
      'Berkah laut 03_07.jpg',
      'CV alam Sari 05_07 .pdf',
      'Cheese work  04_07.pdf',
      'Cheese+Boutique+Menu+2025-compressed.pdf',
      'GS meat supplier 03_07.docx',
      'Gloria seafood Bali 03_07.pdf',
      'Happy farm bali 03_07.pdf',
      'Meat Mart 2 03_07.pdf',
      'Meat mart 1 03_07.pdf',
      'Milk up 04_07.pdf',
      'Oz britts 04_07.pdf',
      'PT Gioa cheese 04_07.pdf',
      'PT Raja boga 04_07.pdf',
      'PT pangan lestari 04_07.pdf',
      'PT puri pangan utama 03_07.pdf',
      'PT.Bali boga sejati 03_07.pdf',
      'PT.Global Anugrah Pasifik 06_07.pdf',
      'PT.Pasti enak 03_07.pdf',
      'Putra mandiri Seafood 04_07.pdf',
      'Rosalie cheese .pdf',
      'SAI FRESH 03_07.pdf',
      'Siap Bali 03_07.pdf',
      'Sri sedana 06_07 .pdf',
      'Sumber laut 05_07.pdf',
      'The meat emporium 03_07.txt',
      'UD okas.pdf',
      'Widi Wiguna 03_07.xlsx',
      'local parts butcher shop 03_07.jpg',
      'oz britts 2 04_07.pdf',
      'plaga farm 06_07.pdf',
      'seven choice_PT satria pangan sejati 04_07.pdf',
      'shy cow 04_07.pdf',
      'sutarsea seafood 07_07.pdf'
    ];
    
    console.log('=== FOLDER CONTENTS ===');
    console.log(`Total files in folder: ${folderFiles.length}`);
    folderFiles.forEach(file => {
      console.log(`- ${file}`);
    });
    console.log('');
    
    // Extract uploaded file names for comparison
    const uploadedFileNames = julyUploads.map(upload => upload.fileName);
    
    // Find files that exist in folder but not in database
    const missingFiles = folderFiles.filter(folderFile => {
      // Check for exact match first
      if (uploadedFileNames.includes(folderFile)) {
        return false;
      }
      
      // Check for case-insensitive match
      const folderFileLower = folderFile.toLowerCase();
      const hasMatch = uploadedFileNames.some(uploadedFile => 
        uploadedFile.toLowerCase() === folderFileLower
      );
      
      return !hasMatch;
    });
    
    // Find files that are in database but not in folder
    const extraFiles = uploadedFileNames.filter(uploadedFile => {
      // Check for exact match first
      if (folderFiles.includes(uploadedFile)) {
        return false;
      }
      
      // Check for case-insensitive match
      const uploadedFileLower = uploadedFile.toLowerCase();
      const hasMatch = folderFiles.some(folderFile => 
        folderFile.toLowerCase() === uploadedFileLower
      );
      
      return !hasMatch;
    });
    
    console.log('=== COMPARISON RESULTS ===');
    console.log(`Files in folder: ${folderFiles.length}`);
    console.log(`Files uploaded to database: ${julyUploads.length}`);
    console.log(`Files missing from database: ${missingFiles.length}`);
    console.log(`Extra files in database (not in folder): ${extraFiles.length}`);
    console.log('');
    
    if (missingFiles.length > 0) {
      console.log('=== FILES NOT YET UPLOADED ===');
      missingFiles.forEach(file => {
        console.log(`❌ ${file}`);
      });
      console.log('');
    }
    
    if (extraFiles.length > 0) {
      console.log('=== EXTRA FILES IN DATABASE ===');
      extraFiles.forEach(file => {
        console.log(`➕ ${file}`);
      });
      console.log('');
    }
    
    // Show successful uploads
    const successfulUploads = julyUploads.filter(upload => upload.status === 'approved');
    const failedUploads = julyUploads.filter(upload => upload.status === 'failed');
    const pendingUploads = julyUploads.filter(upload => upload.status === 'pending_review');
    
    console.log('=== UPLOAD STATUS SUMMARY ===');
    console.log(`✅ Approved: ${successfulUploads.length}`);
    console.log(`❌ Failed: ${failedUploads.length}`);
    console.log(`⏳ Pending Review: ${pendingUploads.length}`);
    console.log('');
    
    if (failedUploads.length > 0) {
      console.log('=== FAILED UPLOADS ===');
      failedUploads.forEach(upload => {
        console.log(`❌ ${upload.fileName}`);
      });
      console.log('');
    }
    
    if (pendingUploads.length > 0) {
      console.log('=== PENDING REVIEW UPLOADS ===');
      pendingUploads.forEach(upload => {
        console.log(`⏳ ${upload.fileName} (${upload._count.prices} prices)`);
      });
      console.log('');
    }
    
    // Summary for next steps
    console.log('=== SUMMARY FOR NEXT STEPS ===');
    console.log(`Total files to process: ${missingFiles.length}`);
    console.log(`Files ready for upload:`);
    missingFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

compareUploadsWithFolder();