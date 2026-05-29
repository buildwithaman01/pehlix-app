import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/utils/db.js';
import User from '../src/modules/staff/user.model.js';

async function inspectSuperAdmin() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Querying all users with role: "superAdmin"...');
    const admins = await User.find({ role: 'superAdmin' });

    console.log(`Found ${admins.length} superAdmin users.`);

    for (let i = 0; i < admins.length; i++) {
      const admin = admins[i];
      console.log(`\n--- Admin #${i + 1} ---`);
      console.log(`ID: ${admin._id}`);
      console.log(`Name: ${admin.name}`);
      console.log(`Email (decrypted): ${admin.email}`);
      console.log(`Phone (decrypted): ${admin.phone}`);
      console.log(`emailBlindIndex: ${admin.emailBlindIndex}`);
      console.log(`phoneBlindIndex: ${admin.phoneBlindIndex}`);
      console.log(`Has passwordHash: ${!!admin.passwordHash}`);
      console.log(`passwordHash starts with: ${admin.passwordHash ? admin.passwordHash.slice(0, 15) : 'N/A'}`);
      console.log(`isActive: ${admin.isActive}`);
      console.log(`isSuspended: ${admin.isSuspended}`);
      console.log(`isOtpOnly: ${admin.isOtpOnly}`);
    }

  } catch (error) {
    console.error('Error inspecting superAdmin:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

inspectSuperAdmin();
