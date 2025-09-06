import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function seedAuth() {
  console.log('🌱 Seeding authentication data...');

  try {
    // Check if admin user already exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@anton.app';
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      // Create admin user
      const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'changeme123';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: 'Admin',
          role: 'admin',
          isActive: true
        }
      });

      console.log('✅ Admin user created:');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Password: ${adminPassword} (Please change immediately!)`);
      console.log(`   Role: ${admin.role}`);
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create a demo user
    const demoEmail = 'demo@anton.app';
    const existingDemo = await prisma.user.findUnique({
      where: { email: demoEmail }
    });

    if (!existingDemo) {
      const demoPassword = 'demo123';
      const hashedPassword = await bcrypt.hash(demoPassword, 10);

      const demo = await prisma.user.create({
        data: {
          email: demoEmail,
          password: hashedPassword,
          name: 'Demo User',
          role: 'user',
          isActive: true
        }
      });

      console.log('✅ Demo user created:');
      console.log(`   Email: ${demo.email}`);
      console.log(`   Password: ${demoPassword}`);
      console.log(`   Role: ${demo.role}`);
    } else {
      console.log('ℹ️  Demo user already exists');
    }

    console.log('');
    console.log('🎉 Authentication seed completed!');
    console.log('');
    console.log('You can now test the authentication with:');
    console.log('');
    console.log('1. Register a new user:');
    console.log(`   curl -X POST http://localhost:3002/api/auth/register \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}'`);
    console.log('');
    console.log('2. Login as admin:');
    console.log(`   curl -X POST http://localhost:3002/api/auth/login \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"email":"${adminEmail}","password":"${process.env.ADMIN_INITIAL_PASSWORD || 'changeme123'}"}'`);
    console.log('');
    console.log('3. Login as demo user:');
    console.log(`   curl -X POST http://localhost:3002/api/auth/login \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"email":"demo@anton.app","password":"demo123"}'`);
    console.log('');

  } catch (error) {
    console.error('❌ Error seeding authentication data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedAuth().catch((error) => {
  console.error(error);
  process.exit(1);
});