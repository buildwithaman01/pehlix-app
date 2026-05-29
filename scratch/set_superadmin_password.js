import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/utils/db.js';
import User from '../src/modules/staff/user.model.js';
import { calculateBlindIndex } from '../src/utils/crypto.js';

async function setSuperAdminPassword() {
  const email = 'admin@pehlix.in';
  const rawPassword = 'PehlixAdmin#2026'; // Temporary password

  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log(`Locating superAdmin user with email: ${email}...`);
    // Find directly by role to bypass blind index checks
    const superAdmin = await User.findOne({ role: 'superAdmin' });

    if (!superAdmin) {
      console.error('❌ Error: No user with role "superAdmin" found in the database.');
      return;
    }

    console.log('Hashing new password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    console.log('Updating superAdmin user in database...');
    superAdmin.email = email;
    superAdmin.phone = '9999999999';
    superAdmin.passwordHash = hashedPassword;
    superAdmin.isOtpOnly = false;
    superAdmin.isActive = true;
    
    // Explicitly compute and store blind indexes
    superAdmin.emailBlindIndex = calculateBlindIndex(email, 'email');
    superAdmin.phoneBlindIndex = calculateBlindIndex('9999999999', 'phone');
    
    await superAdmin.save();
    console.log('✔ Successfully updated superAdmin credentials!');
    console.log('--------------------------------------------------');
    console.log(`Email: ${email}`);
    console.log(`Password: ${rawPassword}`);
    console.log('--------------------------------------------------');
    console.log('You can now log in using the "Password Login" tab on app.pehlix.in/login');

  } catch (error) {
    console.error('❌ Error setting superAdmin password:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

setSuperAdminPassword();
