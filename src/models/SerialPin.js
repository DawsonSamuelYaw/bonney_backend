// src/models/SerialPin.js - Make sure it looks like this
const mongoose = require('mongoose');

const serialPinSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    required: [true, 'Serial number is required'],
    trim: true,
    unique: true
  },
  pin: {
    type: String,
    trim: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'sold'],
    default: 'available'
  },
  usedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
serialPinSchema.index({ productId: 1, isUsed: 1, orderId: 1 });
serialPinSchema.index({ productId: 1, status: 1 });
serialPinSchema.index({ serialNumber: 1 });
serialPinSchema.index({ orderId: 1 });

module.exports = mongoose.model('SerialPin', serialPinSchema);