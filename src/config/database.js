// src/config/database.js
const mongoose = require('mongoose');

const connectDatabase = async () => {
  try {
    const connectionString = process.env.MONGODB_URI || 
      `mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME || 'big_bonney'}`;

    const options = {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(connectionString, options);
    console.log('✅ MongoDB connection established successfully');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
   
  } catch (error) {
    console.error('❌ Unable to connect to MongoDB:', error);
    throw error;
  }
};

module.exports = {
  connectDatabase,
  mongoose
};