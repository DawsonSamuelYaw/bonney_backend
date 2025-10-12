// src/routes/orders.js - COMPLETE VERSION WITH DEBUGGING
const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const SerialPin = require('../models/SerialPin');

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
    paidOrders.forEach(order => {
      console.log(`Order ${order.orderNumber}: status=${order.status}, items=${order.items.length}`);
    });

    // Get all serial pins for these orders
    const orderIds = paidOrders.map(order => order._id);
    console.log('Looking for serial pins in orders:', orderIds);

    const purchasedSerialPins = await SerialPin.find({
      orderId: { $in: orderIds }
    }).populate('productId', 'name category description').populate('orderId', 'orderNumber createdAt');

    console.log('Found serial pins:', purchasedSerialPins.length);
    purchasedSerialPins.forEach(pin => {
      console.log(`Pin ${pin.serialNumber}: isUsed=${pin.isUsed}, status=${pin.status}, orderId=${pin.orderId?._id}`);
    });

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
    
    console.log('Final purchases count:', purchases.length);
    console.log('Purchases with serial pins:', purchases.filter(p => p.serialPins.length > 0).length);

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

    console.log('Getting purchase details for order:', orderId);

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

    console.log('Found serial pins for order:', serialPins.length);

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

// Admin routes
router.get('/admin/all', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Admin orders endpoint',
      data: { orders: [] }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin orders',
      error: error.message
    });
  }
});

module.exports = router;