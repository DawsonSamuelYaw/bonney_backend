
// src/models/InventoryAlert.js
const mongoose = require('mongoose');

const inventoryAlertSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  alertType: {
    type: String,
    required: [true, 'Alert type is required'],
    enum: {
      values: ['low_stock', 'out_of_stock', 'restock_needed'],
      message: 'Invalid alert type'
    }
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: [0, 'Current stock cannot be negative']
  },
  threshold: {
    type: Number,
    required: [true, 'Threshold is required'],
    min: [0, 'Threshold cannot be negative']
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  notificationSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
inventoryAlertSchema.index({ productId: 1, isResolved: 1 });
inventoryAlertSchema.index({ alertType: 1 });
inventoryAlertSchema.index({ createdAt: -1 });

// Transform output
inventoryAlertSchema.methods.toJSON = function() {
  const alertObject = this.toObject();
  delete alertObject.__v;
  return alertObject;
};

module.exports = mongoose.model('InventoryAlert', inventoryAlertSchema);




