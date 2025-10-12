
// src/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['form', 'checker', 'tool'],
      message: 'Category must be form, checker, or tool'
    }
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    trim: true
  },
  features: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true
  }],
  // Inventory fields
  stockQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Stock quantity cannot be negative']
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: [0, 'Low stock threshold cannot be negative']
  },
  isLowStock: {
    type: Boolean,
    default: false
  },
  lastRestocked: {
    type: Date
  },
  supplier: {
    type: String,
    trim: true
  },
  supplierContact: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Virtual for available stock (will be calculated from SerialPin model)
productSchema.virtual('availableStock', {
  ref: 'SerialPin',
  localField: '_id',
  foreignField: 'productId',
  count: true,
  match: { isUsed: false, orderId: null }
});

// Indexes for better performance
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ isLowStock: 1 });

// Transform output
productSchema.methods.toJSON = function() {
  const productObject = this.toObject();
  delete productObject.__v;
  return productObject;
};

module.exports = mongoose.model('Product', productSchema);
