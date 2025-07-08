/**
 * Quick fix script for Indonesian product names
 * Faster alternative using dictionary-based approach
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const translations: Record<string, string> = {
  // Fruits
  'apel': 'Apple',
  'jeruk': 'Orange',
  'mangga': 'Mango',
  'pisang': 'Banana',
  'anggur': 'Grape',
  'semangka': 'Watermelon',
  'melon': 'Melon',
  'nanas': 'Pineapple',
  'pepaya': 'Papaya',
  'alpukat': 'Avocado',
  'durian': 'Durian',
  'rambutan': 'Rambutan',
  'manggis': 'Mangosteen',
  'jambu': 'Guava',
  'kelapa': 'Coconut',
  'nangka': 'Jackfruit',
  'salak': 'Snake Fruit',
  'duku': 'Duku',
  'lengkeng': 'Longan',
  'leci': 'Lychee',
  
  // Vegetables
  'wortel': 'Carrot',
  'tomat': 'Tomato',
  'kentang': 'Potato',
  'bawang': 'Onion',
  'kubis': 'Cabbage',
  'sawi': 'Mustard Greens',
  'bayam': 'Spinach',
  'kangkung': 'Water Spinach',
  'brokoli': 'Broccoli',
  'kembang kol': 'Cauliflower',
  'terong': 'Eggplant',
  'timun': 'Cucumber',
  'labu': 'Pumpkin',
  'jagung': 'Corn',
  'kacang': 'Bean',
  'kacang panjang': 'Long Bean',
  'buncis': 'Green Bean',
  'pete': 'Stink Bean',
  'jengkol': 'Jengkol',
  'tauge': 'Bean Sprout',
  'selada': 'Lettuce',
  'seledri': 'Celery',
  'daun bawang': 'Scallion',
  'paprika': 'Bell Pepper',
  'cabe': 'Chili',
  'cabai': 'Chili',
  
  // Meat & Protein
  'ayam': 'Chicken',
  'sapi': 'Beef',
  'daging': 'Meat',
  'ikan': 'Fish',
  'udang': 'Shrimp',
  'cumi': 'Squid',
  'kepiting': 'Crab',
  'kambing': 'Goat',
  'bebek': 'Duck',
  'telur': 'Egg',
  'tahu': 'Tofu',
  'tempe': 'Tempeh',
  
  // Grains & Staples
  'beras': 'Rice',
  'gula': 'Sugar',
  'garam': 'Salt',
  'minyak': 'Oil',
  'tepung': 'Flour',
  'mie': 'Noodle',
  'roti': 'Bread',
  'susu': 'Milk',
  'mentega': 'Butter',
  'keju': 'Cheese',
  
  // Descriptors
  'merah': 'Red',
  'hijau': 'Green',
  'putih': 'White',
  'kuning': 'Yellow',
  'hitam': 'Black',
  'biru': 'Blue',
  'ungu': 'Purple',
  'coklat': 'Brown',
  'segar': 'Fresh',
  'kering': 'Dry',
  'basah': 'Wet',
  'manis': 'Sweet',
  'asin': 'Salty',
  'pedas': 'Spicy',
  'pahit': 'Bitter',
  'asam': 'Sour',
  'besar': 'Large',
  'kecil': 'Small',
  'lokal': 'Local',
  'import': 'Imported',
  'organik': 'Organic',
  'kampung': 'Free Range',
  'biasa': 'Regular',
  'super': 'Super',
  'premium': 'Premium'
};

/**
 * Translate Indonesian words in a product name
 */
function translateProductName(name: string): string {
  let translated = name.toLowerCase();
  
  // Replace each Indonesian word with English
  for (const [indo, eng] of Object.entries(translations)) {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${indo}\\b`, 'gi');
    translated = translated.replace(regex, eng.toLowerCase());
  }
  
  // Capitalize first letter of each word
  return translated
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function main() {
  console.log('🚀 Quick fix for Indonesian product names\n');
  
  // Get all products
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      standardizedName: true,
      rawName: true
    }
  });
  
  console.log(`Found ${products.length} products to check\n`);
  
  let fixed = 0;
  const updates: Array<{ id: string; oldName: string; newName: string }> = [];
  
  // Check each product
  for (const product of products) {
    const translated = translateProductName(product.standardizedName);
    
    if (translated !== product.standardizedName) {
      updates.push({
        id: product.id,
        oldName: product.standardizedName,
        newName: translated
      });
    }
  }
  
  console.log(`Found ${updates.length} products to fix\n`);
  
  if (updates.length > 0) {
    // Show preview
    console.log('Preview of changes:');
    updates.slice(0, 10).forEach(u => {
      console.log(`  "${u.oldName}" → "${u.newName}"`);
    });
    
    if (updates.length > 10) {
      console.log(`  ... and ${updates.length - 10} more\n`);
    }
    
    // Apply updates
    console.log('\nApplying updates...');
    
    for (const update of updates) {
      try {
        await prisma.product.update({
          where: { id: update.id },
          data: {
            standardizedName: update.newName,
            name: update.newName // Also update display name
          }
        });
        
        fixed++;
        
        if (fixed % 50 === 0) {
          console.log(`Progress: ${fixed}/${updates.length}`);
        }
      } catch (error) {
        console.error(`Failed to update product ${update.id}:`, error);
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} products!`);
  } else {
    console.log('✅ No Indonesian names found - all products are already in English!');
  }
  
  // Check for remaining Indonesian words
  const remaining = await prisma.product.findMany({
    where: {
      OR: Object.keys(translations).map(word => ({
        standardizedName: {
          contains: word,
          mode: 'insensitive'
        }
      }))
    },
    select: {
      standardizedName: true
    }
  });
  
  if (remaining.length > 0) {
    console.log(`\n⚠️ Still found ${remaining.length} products with Indonesian words:`);
    remaining.slice(0, 5).forEach(p => {
      console.log(`  - ${p.standardizedName}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });