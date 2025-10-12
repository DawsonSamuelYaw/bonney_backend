// src/models/SerialPin.js - UPDATED VERSION
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
  status: {  // ADDED - needed for order processing
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
serialPinSchema.index({ productId: 1, isUsed: 1, orderId: 1 });
serialPinSchema.index({ productId: 1, status: 1 });  // ADDED - for status queries
serialPinSchema.index({ serialNumber: 1 });
serialPinSchema.index({ orderId: 1 });

// Transform output
serialPinSchema.methods.toJSON = function() {
  const serialObject = this.toObject();
  delete serialObject.__v;
  return serialObject;
};

module.exports = mongoose.model('SerialPin', serialPinSchema);