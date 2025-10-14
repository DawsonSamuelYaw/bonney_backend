// src/routes/orders.js - COMPLETE VERSION WITH ADMIN ENDPOINTS
const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const SerialPin = require('../models/SerialPin');
const Product = require('../models/Product');

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// ==================== ADMIN ROUTES (MUST BE FIRST) ====================

// Get all orders (Admin)
router.get('/admin/all', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate('userId', 'name email')
      .populate('items.productId', 'name category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get admin orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Update order status (Admin)
router.patch('/admin/orders/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    console.log('=== UPDATE ORDER STATUS ===');
    console.log('Order ID:', id);
    console.log('New Status:', status);
    console.log('Notes:', notes);

    // Validate status
    const validStatuses = ['pending', 'processing', 'paid', 'cancelled', 'completed', 'failed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order
    if (status) order.status = status;
    if (notes) order.adminNotes = notes;
    order.updatedAt = new Date();

    await order.save();

    // If status is changed to 'paid', auto-assign serial pins
    if (status === 'paid' && order.items.length > 0) {
      console.log('Order marked as paid, checking for serial pin assignment...');
      
      for (const item of order.items) {
        // Only assign serial pins for checker products
        if (item.productCategory === 'checker') {
          const quantity = item.quantity;
          
          console.log(`Assigning ${quantity} serial pins for product ${item.productId}`);
          
          // Find available serial pins
          const availablePins = await SerialPin.find({
            productId: item.productId,
            isUsed: false,
            status: 'available'
          }).limit(quantity);

          if (availablePins.length < quantity) {
            console.warn(`Not enough serial pins for product ${item.productId}. Need ${quantity}, found ${availablePins.length}`);
            continue;
          }

          // Assign serial pins to order
          for (const pin of availablePins) {
            pin.orderId = order._id;
            pin.isUsed = true;
            pin.status = 'sold';
            pin.usedAt = new Date();
            await pin.save();
          }

          console.log(`Successfully assigned ${availablePins.length} serial pins`);
        }
      }
    }

    // Populate order details for response
    await order.populate('userId', 'name email');
    await order.populate('items.productId', 'name category');

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: { order }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
});

// Add serial pins (Admin)
router.post('/admin/serial-pins', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { productId, serialNumber, pin, expiresAt } = req.body;

    console.log('=== ADD SERIAL PIN ===');
    console.log('Product ID:', productId);
    console.log('Serial Number:', serialNumber);

    // Validation
    if (!productId || !serialNumber || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, serial number, and PIN are required'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check for duplicate serial number
    const existingPin = await SerialPin.findOne({ serialNumber });
    if (existingPin) {
      return res.status(400).json({
        success: false,
        message: 'Serial number already exists'
      });
    }

    // Create new serial pin
    const newSerialPin = new SerialPin({
      productId,
      serialNumber,
      pin,
      expiresAt: expiresAt || null,
      isUsed: false,
      status: 'available'
    });

    await newSerialPin.save();

    // Update product stock quantity
    product.stockQuantity = (product.stockQuantity || 0) + 1;
    await product.save();

    console.log('Serial pin added successfully:', newSerialPin._id);

    res.status(201).json({
      success: true,
      message: 'Serial pin added successfully',
      data: { serialPin: newSerialPin }
    });

  } catch (error) {
    console.error('Add serial pin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add serial pin',
      error: error.message
    });
  }
});

// Get all serial pins (Admin)
router.get('/admin/serial-pins', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { productId, status, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (productId) filter.productId = productId;
    if (status) filter.status = status;

    const serialPins = await SerialPin.find(filter)
      .populate('productId', 'name category')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await SerialPin.countDocuments(filter);

    res.json({
      success: true,
      data: {
        serialPins,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get serial pins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch serial pins',
      error: error.message
    });
  }
});

// Bulk add serial pins (Admin)
router.post('/admin/serial-pins/bulk', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { productId, pins } = req.body;

    console.log('=== BULK ADD SERIAL PINS ===');
    console.log('Product ID:', productId);
    console.log('Number of pins:', pins?.length);

    if (!productId || !Array.isArray(pins) || pins.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and pins array are required'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const results = {
      added: 0,
      skipped: 0,
      errors: []
    };

    for (const pinData of pins) {
      try {
        const { serialNumber, pin, expiresAt } = pinData;

        if (!serialNumber || !pin) {
          results.skipped++;
          results.errors.push({ serialNumber, error: 'Missing serial number or PIN' });
          continue;
        }

        // Check for duplicate
        const existing = await SerialPin.findOne({ serialNumber });
        if (existing) {
          results.skipped++;
          results.errors.push({ serialNumber, error: 'Duplicate serial number' });
          continue;
        }

        // Create serial pin
        await SerialPin.create({
          productId,
          serialNumber,
          pin,
          expiresAt: expiresAt || null,
          isUsed: false,
          status: 'available'
        });

        results.added++;
      } catch (error) {
        results.skipped++;
        results.errors.push({ serialNumber: pinData.serialNumber, error: error.message });
      }
    }

    // Update product stock
    product.stockQuantity = (product.stockQuantity || 0) + results.added;
    await product.save();

    console.log('Bulk add results:', results);

    res.json({
      success: true,
      message: `Added ${results.added} serial pins, skipped ${results.skipped}`,
      data: results
    });

  } catch (error) {
    console.error('Bulk add serial pins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk add serial pins',
      error: error.message
    });
  }
});

// Delete serial pin (Admin)
router.delete('/admin/serial-pins/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { id } = req.params;

    const serialPin = await SerialPin.findById(id);
    if (!serialPin) {
      return res.status(404).json({
        success: false,
        message: 'Serial pin not found'
      });
    }

    // Don't allow deletion if already used
    if (serialPin.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a used serial pin'
      });
    }

    // Update product stock
    const product = await Product.findById(serialPin.productId);
    if (product) {
      product.stockQuantity = Math.max(0, (product.stockQuantity || 0) - 1);
      await product.save();
    }

    await SerialPin.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Serial pin deleted successfully'
    });

  } catch (error) {
    console.error('Delete serial pin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete serial pin',
      error: error.message
    });
  }
});

// ==================== USER ROUTES ====================

// Get user orders
router.get('/', authMiddleware, OrderController.getUserOrders);

// Get user's purchased items - MUST BE BEFORE /:id route
router.get('/purchases', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('=== PURCHASES REQUEST ===');
    console.log('User ID:', userId);
    
    // Find all paid orders
    const paidOrders = await Order.find({
      userId: userId,
      status: 'paid'
    }).populate('items.productId', 'name category').sort({ createdAt: -1 });

    console.log('Found paid orders:', paidOrders.length);

    // Get all serial pins for these orders
    const orderIds = paidOrders.map(order => order._id);
    const purchasedSerialPins = await SerialPin.find({
      orderId: { $in: orderIds }
    }).populate('productId', 'name category description').populate('orderId', 'orderNumber createdAt');

    console.log('Found serial pins:', purchasedSerialPins.length);

    // Build response
    const purchasesByOrder = {};
    
    paidOrders.forEach(order => {
      purchasesByOrder[order._id.toString()] = {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          purchaseDate: order.createdAt,
          status: order.status,
          paymentMethod: order.paymentMethod
        },
        items: order.items.map(item => ({
          productName: item.productName,
          productCategory: item.productCategory,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        })),
        serialPins: []
      };
    });

    // Add serial pins to their orders
    purchasedSerialPins.forEach(pin => {
      const orderKey = pin.orderId._id.toString();
      if (purchasesByOrder[orderKey]) {
        purchasesByOrder[orderKey].serialPins.push({
          id: pin._id,
          serialNumber: pin.serialNumber,
          pin: pin.pin,
          productName: pin.productId.name,
          productCategory: pin.productId.category,
          productDescription: pin.productId.description,
          purchaseDate: pin.usedAt || pin.orderId.createdAt,
          expiresAt: pin.expiresAt
        });
      }
    });

    const purchases = Object.values(purchasesByOrder);

    res.json({
      success: true,
      data: {
        purchases,
        totalPurchases: purchases.length,
        totalSerialPins: purchasedSerialPins.length
      }
    });

  } catch (error) {
    console.error('Get user purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchases',
      error: error.message
    });
  }
});

// Get specific purchase details
router.get('/purchases/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
      status: 'paid'
    }).populate('items.productId', 'name category description');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found or not paid'
      });
    }

    const serialPins = await SerialPin.find({
      orderId: orderId
    }).populate('productId', 'name category description');

    res.json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          purchaseDate: order.createdAt,
          status: order.status,
          paymentMethod: order.paymentMethod
        },
        items: order.items,
        serialPins: serialPins.map(pin => ({
          id: pin._id,
          serialNumber: pin.serialNumber,
          pin: pin.pin,
          productName: pin.productId.name,
          productCategory: pin.productId.category,
          productDescription: pin.productId.description,
          purchaseDate: pin.usedAt,
          expiresAt: pin.expiresAt
        }))
      }
    });

  } catch (error) {
    console.error('Get purchase details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase details',
      error: error.message
    });
  }
});

// Download purchase
router.get('/purchases/:orderId/download', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { format = 'json' } = req.query;
    const userId = req.user.id;

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
      status: 'paid'
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    const serialPins = await SerialPin.find({
      orderId: orderId
    }).populate('productId', 'name category');

    if (serialPins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No serial pins found for this order'
      });
    }

    if (format === 'csv') {
      let csvContent = 'Product Name,Serial Number,PIN,Purchase Date,Order Number\n';
      serialPins.forEach(pin => {
        csvContent += `"${pin.productId.name}","${pin.serialNumber}","${pin.pin}","${pin.usedAt || order.createdAt}","${order.orderNumber}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="purchase-${order.orderNumber}.csv"`);
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: {
          orderNumber: order.orderNumber,
          purchaseDate: order.createdAt,
          items: serialPins.map(pin => ({
            productName: pin.productId.name,
            serialNumber: pin.serialNumber,
            pin: pin.pin,
            category: pin.productId.category
          }))
        }
      });
    }

  } catch (error) {
    console.error('Download purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download purchase',
      error: error.message
    });
  }
});

// Get specific order
router.get('/:id', authMiddleware, OrderController.getOrderById);

// Create new order
router.post('/', [
  authMiddleware,
  body('items').isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('paymentMethod').optional().isIn(['paystack', 'bank_transfer', 'mobile_money'])
], validateRequest, OrderController.createOrder);

// Verify payment
router.post('/verify-payment', [
  authMiddleware,
  body('reference').notEmpty().withMessage('Payment reference is required')
], validateRequest, OrderController.verifyPayment);

// Cancel order
router.patch('/:id/cancel', authMiddleware, OrderController.cancelOrder);

module.exports = router;