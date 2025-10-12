// scripts/migrate-database.js
// Run this script once to update your existing data
const mongoose = require('mongoose');
const SerialPin = require('../src/models/SerialPin');
const Order = require('../src/models/Order');

async function migrateDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your_database');
    console.log('Connected to MongoDB');

    // 1. Update SerialPin records to add status field
    console.log('Updating SerialPin records...');
    const serialPinUpdateResult = await SerialPin.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'available' } }
    );
    console.log(`Updated ${serialPinUpdateResult.modifiedCount} SerialPin records with status field`);

    // 2. Update SerialPin records that are already used
    const usedPinsUpdateResult = await SerialPin.updateMany(
      { isUsed: true, status: 'available' },
      { $set: { status: 'sold' } }
    );
    console.log(`Updated ${usedPinsUpdateResult.modifiedCount} used SerialPin records to 'sold' status`);

    // 3. Update SerialPin records that have orderId but aren't marked as used
    const reservedPinsUpdateResult = await SerialPin.updateMany(
      { orderId: { $ne: null }, isUsed: false, status: 'available' },
      { $set: { status: 'reserved' } }
    );
    console.log(`Updated ${reservedPinsUpdateResult.modifiedCount} reserved SerialPin records`);

    // 4. Add productCategory to existing orders based on their products
    console.log('Updating Order items with productCategory...');
    const orders = await Order.find({
      'items.productCategory': { $exists: false }
    }).populate('items.productId');

    for (const order of orders) {
      let updated = false;
      
      for (const item of order.items) {
        if (!item.productCategory && item.productId) {
          item.productCategory = item.productId.category;
          updated = true;
        }
      }
      
      if (updated) {
        await order.save();
        console.log(`Updated order ${order.orderNumber} with product categories`);
      }
    }

    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateDatabase();
}

module.exports = migrateDatabase;