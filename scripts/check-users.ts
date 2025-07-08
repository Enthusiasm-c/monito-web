/**
 * Script to check existing users and their roles
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📋 Checking existing users...\n');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  if (users.length === 0) {
    console.log('❌ No users found in the database!');
    console.log('\nCreating default admin user...');
    
    // Create default admin
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@monito-web.com',
        name: 'Admin User',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      }
    });
    
    console.log('✅ Admin user created:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Password: admin123`);
  } else {
    console.log(`Found ${users.length} users:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.name || 'Not set'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      console.log('');
    });
    
    // Check if any admin exists
    const adminExists = users.some(u => u.role === 'admin');
    if (!adminExists) {
      console.log('⚠️  No admin user found!');
      console.log('\nDo you want to update the first user to admin role? Run:');
      console.log(`npm run ts-node scripts/update-user-role.ts ${users[0].id} admin`);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });