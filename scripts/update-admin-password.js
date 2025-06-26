/**
 * Script to update admin password with proper hashing
 * Run with: node scripts/update-admin-password.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateAdminPassword() {
  console.log('🔒 Updating admin password with proper hashing...');
  
  try {
    // Check if admin user exists
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@monito-web.com' }
    });

    if (!adminUser) {
      console.log('❌ Admin user not found. Creating new admin user...');
      
      // Create new admin user with hashed password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash('admin123', saltRounds);
      
      const newAdmin = await prisma.user.create({
        data: {
          email: 'admin@monito-web.com',
          name: 'System Administrator',
          password: hashedPassword,
          role: 'admin',
          isActive: true
        }
      });
      
      console.log(`✅ Created new admin user: ${newAdmin.email}`);
      console.log('⚠️  Default password: admin123 (change immediately!)');
      return;
    }

    // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (adminUser.password.startsWith('$2')) {
      console.log('✅ Admin password is already properly hashed');
      return;
    }

    // Hash the current plain text password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(adminUser.password, saltRounds);
    
    // Update the password
    await prisma.user.update({
      where: { email: 'admin@monito-web.com' },
      data: { password: hashedPassword }
    });
    
    console.log('✅ Admin password updated with proper hashing');
    console.log('📧 Email: admin@monito-web.com');
    console.log('🔑 Password: admin123');
    console.log('⚠️  Please change the default password after first login');

  } catch (error) {
    console.error('💥 Error updating admin password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Create a manager user for testing
async function createManagerUser() {
  console.log('👤 Creating manager user for testing...');
  
  try {
    const existingManager = await prisma.user.findUnique({
      where: { email: 'manager@monito-web.com' }
    });

    if (existingManager) {
      console.log('✅ Manager user already exists');
      return;
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('manager123', saltRounds);
    
    const manager = await prisma.user.create({
      data: {
        email: 'manager@monito-web.com',
        name: 'Manager User',
        password: hashedPassword,
        role: 'manager',
        isActive: true
      }
    });
    
    console.log(`✅ Created manager user: ${manager.email}`);
    console.log('🔑 Password: manager123');

  } catch (error) {
    console.error('❌ Error creating manager user:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting password update script...\n');
  
  await updateAdminPassword();
  console.log(''); // Empty line
  await createManagerUser();
  
  console.log('\n🏁 Script completed!');
  console.log('\n📋 Available accounts:');
  console.log('  Admin:   admin@monito-web.com   / admin123');
  console.log('  Manager: manager@monito-web.com / manager123');
  console.log('\n🔐 Both accounts have proper password hashing enabled');
}

main().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});