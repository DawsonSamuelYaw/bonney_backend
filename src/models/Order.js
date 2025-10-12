// src/models/Order.js - UPDATED VERSION
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productCategory: {  // ADDED - needed for stock management
    type: String,
    enum: ['form', 'checker', 'tool'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: [true, 'Order number is required'],
    unique: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  items: {
    type: [orderItemSchema],
    required: [true, 'Order items are required'],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Order must have at least one item'
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'paid', 'completed', 'failed', 'cancelled', 'refunded'], // UPDATED - added 'paid', 'cancelled'
      message: 'Invalid order status'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['paystack', 'bank_transfer', 'mobile_money'], // ADDED - restrict to valid methods
    required: true,
    trim: true
  },
  paymentReference: {
    type: String,
    trim: true,
    sparse: true
  },
  // ADDED - Payment details object
  paymentDetails: {
    reference: String,
    accessCode: String,
    paidAt: Date,
    paystackResponse: mongoose.Schema.Types.Mixed
  },
  // ADDED - Shipping address
  shippingAddress: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    address: String,
    city: String,
    state: String
  },
  deliveryStatus: {
    type: String,
    enum: {
      values: ['pending', 'delivered', 'failed'],
      message: 'Invalid delivery status'
    },
    default: 'pending'
  },
  deliveredAt: {
    type: Date
  },
  cancelledAt: {  // ADDED - for tracking cancellation time
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for serial pins
orderSchema.virtual('serialPins', {
  ref: 'SerialPin',
  localField: '_id',
  foreignField: 'orderId'
});

// Indexes for better performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentReference: 1 });
orderSchema.index({ 'paymentDetails.reference': 1 });  // ADDED
orderSchema.index({ createdAt: -1 });

// Generate order number before saving
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.orderNumber = `BB${timestamp.slice(-6)}${random}`;
  }
  next();
});

// Transform output
orderSchema.methods.toJSON = function() {
  const orderObject = this.toObject();
  delete orderObject.__v;
  return orderObject;
};

module.exports = mongoose.model('Order', orderSchema);