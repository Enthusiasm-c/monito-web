/**
 * Create test data for admin panel testing
 */

const { PrismaClient } = require('@prisma/client');

const testSuppliers = [
  {
    name: "Fresh Market Indonesia",
    contactInfo: "Jakarta Branch",
    email: "orders@freshmarket.id",
    phone: "+62-21-123-4567",
    address: "Jl. Raya Kemang No. 15, Jakarta Selatan"
  },
  {
    name: "Green Valley Suppliers",
    contactInfo: "Bandung Office", 
    email: "supply@greenvalley.co.id",
    phone: "+62-22-987-6543",
    address: "Jl. Asia Afrika No. 88, Bandung"
  },
  {
    name: "Metro Wholesale",
    contactInfo: "Surabaya Hub",
    email: "wholesale@metro.id", 
    phone: "+62-31-555-7890",
    address: "Jl. Basuki Rahmat No. 225, Surabaya"
  },
  {
    name: "Organic Farm Direct",
    contactInfo: "Bogor Farm",
    email: "farm@organic.id",
    phone: "+62-251-444-3333",
    address: "Jl. Raya Bogor KM 25, Bogor"
  },
  {
    name: "Asian Spice Trading",
    contactInfo: "Medan Branch",
    email: "spices@asiantrading.id",
    phone: "+62-61-777-8888",
    address: "Jl. Gatot Subroto No. 45, Medan"
  }
];

const testProducts = [
  // Vegetables
  { rawName: "wortel", name: "Carrot", standardizedName: "carrot", category: "vegetables", unit: "kg", standardizedUnit: "kg" },
  { rawName: "bayam", name: "Spinach", standardizedName: "spinach", category: "vegetables", unit: "bunch", standardizedUnit: "bunch" },
  { rawName: "tomat", name: "Tomato", standardizedName: "tomato", category: "vegetables", unit: "kg", standardizedUnit: "kg" },
  { rawName: "bawang merah", name: "Shallot", standardizedName: "shallot", category: "vegetables", unit: "kg", standardizedUnit: "kg" },
  { rawName: "bawang putih", name: "Garlic", standardizedName: "garlic", category: "vegetables", unit: "kg", standardizedUnit: "kg" },
  { rawName: "kentang", name: "Potato", standardizedName: "potato", category: "vegetables", unit: "kg", standardizedUnit: "kg" },
  { rawName: "kubis", name: "Cabbage", standardizedName: "cabbage", category: "vegetables", unit: "pcs", standardizedUnit: "pcs" },
  { rawName: "terong", name: "Eggplant", standardizedName: "eggplant", category: "vegetables", unit: "kg", standardizedUnit: "kg" },
  
  // Fruits  
  { rawName: "pisang", name: "Banana", standardizedName: "banana", category: "fruits", unit: "kg", standardizedUnit: "kg" },
  { rawName: "apel", name: "Apple", standardizedName: "apple", category: "fruits", unit: "kg", standardizedUnit: "kg" },
  { rawName: "jeruk", name: "Orange", standardizedName: "orange", category: "fruits", unit: "kg", standardizedUnit: "kg" },
  { rawName: "mangga", name: "Mango", standardizedName: "mango", category: "fruits", unit: "pcs", standardizedUnit: "pcs" },
  { rawName: "pepaya", name: "Papaya", standardizedName: "papaya", category: "fruits", unit: "pcs", standardizedUnit: "pcs" },
  
  // Meat & Seafood
  { rawName: "ayam", name: "Chicken", standardizedName: "chicken", category: "meat", unit: "kg", standardizedUnit: "kg" },
  { rawName: "sapi", name: "Beef", standardizedName: "beef", category: "meat", unit: "kg", standardizedUnit: "kg" },
  { rawName: "ikan bandeng", name: "Milkfish", standardizedName: "milkfish", category: "seafood", unit: "kg", standardizedUnit: "kg" },
  { rawName: "udang", name: "Shrimp", standardizedName: "shrimp", category: "seafood", unit: "kg", standardizedUnit: "kg" },
  
  // Rice & Grains
  { rawName: "beras", name: "Rice", standardizedName: "rice", category: "grains", unit: "kg", standardizedUnit: "kg" },
  { rawName: "tepung terigu", name: "Wheat Flour", standardizedName: "wheat_flour", category: "grains", unit: "kg", standardizedUnit: "kg" },
  
  // Dairy & Eggs
  { rawName: "telur ayam", name: "Chicken Eggs", standardizedName: "chicken_eggs", category: "dairy", unit: "kg", standardizedUnit: "kg" },
  { rawName: "susu segar", name: "Fresh Milk", standardizedName: "fresh_milk", category: "dairy", unit: "liter", standardizedUnit: "L" }
];

async function createTestData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Creating test data...');
    
    // Create suppliers
    console.log('📦 Creating suppliers...');
    for (const supplierData of testSuppliers) {
      await prisma.supplier.create({
        data: supplierData
      });
      console.log('   ✅', supplierData.name);
    }
    
    // Create products  
    console.log('🥬 Creating products...');
    for (const productData of testProducts) {
      await prisma.product.create({
        data: productData
      });
      console.log('   ✅', productData.name);
    }
    
    const suppliersCount = await prisma.supplier.count();
    const productsCount = await prisma.product.count();
    
    console.log('\\n🎉 Test data created successfully!');
    console.log('📊 Summary:');
    console.log('   Suppliers:', suppliersCount);
    console.log('   Products:', productsCount);
    console.log('\\n💡 Ready for admin panel testing!');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createTestData().catch(console.error);
}

module.exports = { createTestData, testSuppliers, testProducts };