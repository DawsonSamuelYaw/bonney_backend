// scripts/seedAdmin.js
const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: 'admin@company.com',
      role: 'admin' 
    });

    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Create default admin user
    const adminUser = new User({
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@company.com',
      phone: '+1234567890',
      password: 'Admin@123', // This will be hashed automatically
      role: 'admin',
      isActive: true,
      emailVerified: true,
      phoneVerified: true
    });

    await adminUser.save();
    console.log('Default admin user created successfully!');
    console.log('Email: admin@company.com');
    console.log('Password: Admin@123');
    
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the seeder
seedAdmin();