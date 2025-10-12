// src/routes/products.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');
const Product = require('../models/Product'); // MISSING IMPORT - THIS WAS THE ISSUE!
const SerialPin = require('../models/SerialPin');

// Get all products
router.get('/', ProductController.getProducts);

// Get stock availability for a specific product - FIXED
router.get('/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Checking stock for product ID: ${id}`); // Debug log
    
    // Find the product
    const product = await Product.findById(id);
    if (!product) {
      console.log(`Product not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    console.log(`Product found: ${product.name}, Category: ${product.category}`);

    let availableStock = 0;
    
    if (product.category === 'checker') {
      // For checker products, count unused serial pins
      const stockQuery = {
        productId: id,
        isUsed: false,
        orderId: null
      };
      
      console.log(`Searching for serial pins with query:`, stockQuery);
      
      availableStock = await SerialPin.countDocuments(stockQuery);
      
      console.log(`Found ${availableStock} available serial pins`);
      
      // Debug: Let's also see what serial pins exist for this product
      const allPins = await SerialPin.find({ productId: id });
      console.log(`All serial pins for product ${id}:`, allPins.map(pin => ({
        id: pin._id,
        serialNumber: pin.serialNumber,
        isUsed: pin.isUsed,
        orderId: pin.orderId,
        status: pin.status
      })));
      
    } else {
      // For other products, use stockQuantity
      availableStock = product.stockQuantity || 0;
      console.log(`Non-checker product, stockQuantity: ${availableStock}`);
    }

    const response = {
      success: true,
      data: {
        productId: product._id,
        productName: product.name,
        category: product.category,
        availableStock,
        inStock: availableStock > 0
      }
    };
    
    console.log(`Stock check response:`, response);
    
    res.json(response);

  } catch (error) {
    console.error('Stock check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check stock',
      error: error.message
    });
  }
});

// Check stock for multiple products (for cart validation)
router.post('/check-stock', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    const stockResults = [];
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        stockResults.push({
          productId: item.productId,
          error: 'Product not found',
          availableStock: 0,
          requestedQuantity: item.quantity,
          canFulfill: false
        });
        continue;
      }

      let availableStock = 0;
      
      if (product.category === 'checker') {
        availableStock = await SerialPin.countDocuments({
          productId: item.productId,
          isUsed: false,
          orderId: null
        });
      } else {
        availableStock = product.stockQuantity || 0;
      }

      stockResults.push({
        productId: item.productId,
        productName: product.name,
        category: product.category,
        availableStock,
        requestedQuantity: item.quantity,
        canFulfill: availableStock >= item.quantity,
        shortfall: Math.max(0, item.quantity - availableStock)
      });
    }

    const canFulfillAll = stockResults.every(result => result.canFulfill);
    const errors = stockResults.filter(result => !result.canFulfill);

    res.json({
      success: true,
      data: {
        canFulfillAll,
        items: stockResults,
        errors: errors.length > 0 ? errors.map(e => 
          `${e.productName}: need ${e.requestedQuantity}, only ${e.availableStock} available`
        ) : []
      }
    });

  } catch (error) {
    console.error('Bulk stock check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check stock',
      error: error.message
    });
  }
});

// Get categories
router.get('/categories', ProductController.getCategories);

// Get featured products
router.get('/featured', ProductController.getFeaturedProducts);

// Get single product (MOVED TO END to avoid route conflicts)
router.get('/:id', ProductController.getProductById);

module.exports = router;