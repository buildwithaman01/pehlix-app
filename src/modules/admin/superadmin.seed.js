import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../../utils/db.js';
import User from '../staff/user.model.js';
import jwt from 'jsonwebtoken';

async function seedSuperAdmin() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully.');

    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@pehlix.in';
    const phone = process.env.SUPER_ADMIN_PHONE || '9999999999';
    const secret = process.env.JWT_SUPER_ADMIN_SECRET;

    if (!secret || secret.includes('PLACEHOLDER')) {
      console.warn('WARNING: JWT_SUPER_ADMIN_SECRET is missing or using placeholder. Signing might fail/be insecure.');
    }

    // Check if superAdmin user already exists
    let user = await User.findOne({ role: 'superAdmin' });

    if (user) {
      console.log(`Super Admin user already exists: ${user.name} (${user.email})`);
    } else {
      console.log('Creating Super Admin user...');
      user = await User.create({
        name: 'Aman',
        role: 'superAdmin',
        phone,
        email,
        isActive: true,
        isSuspended: false,
        labId: null
      });
      console.log('Super Admin user created successfully.');
    }

    // Generate JWT token
    const tokenSecret = secret || 'default_super_admin_secret_key';
    const tokenPayload = {
      userId: user._id.toString(),
      role: 'superAdmin',
      permissions: ['*'],
      isImpersonation: false
    };

    const token = jwt.sign(tokenPayload, tokenSecret, { expiresIn: '365d' });

    console.log('\n==================================================');
    console.log('SUPER ADMIN INITIALIZATION SUCCESS');
    console.log('==================================================');
    console.log(`User ID: ${user._id}`);
    console.log(`Name:    ${user.name}`);
    console.log(`Email:   ${user.email}`);
    console.log(`Phone:   ${user.phone}`);
    console.log('\nUse the following JWT token for Bearer Authorization:');
    console.log(`Bearer ${token}`);
    console.log('==================================================\n');

  } catch (error) {
    console.error('Error seeding Super Admin:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

seedSuperAdmin();
