// scripts/resetAdminPasswordDirect.js
// Direct database update to bypass validation

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Database connection
const DB_CONNECTION = 'mongodb://localhost:27017/big_bonney';

async function resetAdminPasswordDirect() {
  try {
    // Connect to database
    await mongoose.connect(DB_CONNECTION);
    console.log('Connected to database');

    // Hash the new password
    const newPassword = 'Admin@123';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    console.log('Generated new password hash:', hashedPassword);

    // Update password directly in database using updateOne (bypasses validation)
    const result = await mongoose.connection.db.collection('users').updateOne(
      { 
        email: 'bbstore@company.com',
        role: 'admin'
      },
      { 
        $set: { 
          password: hashedPassword 
        }
      }
    );

    console.log('Update result:', result);

    if (result.matchedCount === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    if (result.modifiedCount === 1) {
      console.log('✅ Admin password reset successfully!');
      console.log('New credentials:');
      console.log('Email: bbstore@company.com');
      console.log('Password:', newPassword);

      // Test the new password
      const admin = await mongoose.connection.db.collection('users').findOne({
        email: 'bbstore@company.com',
        role: 'admin'
      });

      if (admin) {
        const isValidPassword = await bcrypt.compare(newPassword, admin.password);
        console.log('Password verification test:', isValidPassword ? '✅ PASS' : '❌ FAIL');
      }
    } else {
      console.log('⚠️ Password was not updated (may already be correct)');
    }

  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run the script
resetAdminPasswordDirect();