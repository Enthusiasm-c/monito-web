/**
 * Debug script to check database connectivity and admin user existence
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function debugDatabaseAuth() {
  try {
    console.log('=== DATABASE AUTHENTICATION DEBUG ===');
    
    // Test database connection
    console.log('\n1. Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Check all users
    console.log('\n2. Checking existing users...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log(`✅ Found ${users.length} users:`);
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.role}) - Active: ${user.isActive}`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Name: ${user.name}`);
        console.log(`      Created: ${user.createdAt}`);
        console.log('');
      });
    }
    
    // Check specifically for admin@monito-web.com
    console.log('3. Checking for admin@monito-web.com...');
    const adminUser = await prisma.user.findUnique({
      where: { 
        email: 'admin@monito-web.com' 
      }
    });
    
    if (!adminUser) {
      console.log('❌ admin@monito-web.com not found');
      
      // Create admin user
      console.log('\n4. Creating admin user...');
      try {
        const hashedPassword = await bcrypt.hash('admin123', 12);
        const newAdmin = await prisma.user.create({
          data: {
            email: 'admin@monito-web.com',
            name: 'Admin User',
            password: hashedPassword,
            role: 'admin',
            isActive: true
          }
        });
        console.log('✅ Admin user created successfully');
        console.log(`   ID: ${newAdmin.id}`);
        console.log(`   Email: ${newAdmin.email}`);
        console.log(`   Role: ${newAdmin.role}`);
      } catch (createError) {
        console.log('❌ Failed to create admin user:', createError.message);
      }
    } else {
      console.log('✅ admin@monito-web.com found:');
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Name: ${adminUser.name}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Active: ${adminUser.isActive}`);
      console.log(`   Created: ${adminUser.createdAt}`);
      
      // Test password verification
      console.log('\n5. Testing password verification...');
      try {
        const isPasswordValid = await bcrypt.compare('admin123', adminUser.password);
        if (isPasswordValid) {
          console.log('✅ Password verification successful');
        } else {
          console.log('❌ Password verification failed');
          
          // Update password
          console.log('   Updating password...');
          const newHashedPassword = await bcrypt.hash('admin123', 12);
          await prisma.user.update({
            where: { id: adminUser.id },
            data: { password: newHashedPassword }
          });
          console.log('✅ Password updated successfully');
        }
      } catch (passwordError) {
        console.log('❌ Password verification error:', passwordError.message);
      }
    }
    
    // Test authentication flow
    console.log('\n6. Testing authentication flow...');
    try {
      const testUser = await prisma.user.findUnique({
        where: { 
          email: 'admin@monito-web.com',
          isActive: true 
        }
      });
      
      if (testUser) {
        const isPasswordValid = await bcrypt.compare('admin123', testUser.password);
        if (isPasswordValid) {
          console.log('✅ Full authentication flow test successful');
          console.log(`   User authenticated: ${testUser.email}`);
          console.log(`   Role: ${testUser.role}`);
          console.log(`   Active: ${testUser.isActive}`);
        } else {
          console.log('❌ Authentication flow failed - password mismatch');
        }
      } else {
        console.log('❌ Authentication flow failed - user not found or inactive');
      }
    } catch (authError) {
      console.log('❌ Authentication flow error:', authError.message);
    }
    
    // Check database schema
    console.log('\n7. Checking database schema...');
    try {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'User' 
        ORDER BY ordinal_position;
      `;
      console.log('✅ User table schema:');
      console.table(result);
    } catch (schemaError) {
      console.log('❌ Could not check schema:', schemaError.message);
    }

    // Test environment variables
    console.log('\n8. Checking environment variables...');
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
    console.log(`   NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? 'Set' : 'Not set'}`);
    console.log(`   NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'Not set'}`);
    
  } catch (error) {
    console.error('❌ Database debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
debugDatabaseAuth();