import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/utils/db.js';
import User from '../src/modules/staff/user.model.js';
import fs from 'fs';
import path from 'path';

async function updateSuperAdmin() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Updating superAdmin user in database...');
    const result = await User.updateOne(
      { role: 'superAdmin' },
      { 
        $set: { 
          phone: '9999999999',
          email: 'admin@pehlix.in' 
        } 
      }
    );
    console.log('Database update result:', result);

    // Also update .env file
    const envPath = path.resolve('.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/SUPER_ADMIN_PHONE=.*$/m, 'SUPER_ADMIN_PHONE=9999999999');
    envContent = envContent.replace(/SUPER_ADMIN_EMAIL=.*$/m, 'SUPER_ADMIN_EMAIL=admin@pehlix.in');
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('Updated .env file values.');

  } catch (error) {
    console.error('Error updating superAdmin:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

updateSuperAdmin();
