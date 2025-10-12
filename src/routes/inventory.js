
// src/routes/inventory.js
const express = require('express');
const router = express.Router();
const { InventoryService } = require('../services/inventoryService');
const { Product, SerialPin, InventoryAlert } = require('../models');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

// Get inventory overview
router.get('/overview', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const analytics = await InventoryService.getInventoryAnalytics();
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get inventory overview',
      error: error.message
    });
  }
});

// Get alerts
router.get('/alerts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const whereClause = status === 'active' ? { isResolved: false } : {};

    const alerts = await InventoryAlert.findAll({
      where: whereClause,
      include: [{
        model: Product,
        as: 'product',
        attributes: ['name', 'category', 'supplier', 'supplierContact']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get inventory alerts',
      error: error.message
    });
  }
});

// Add stock to product
router.post('/products/:productId/stock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const { serialPins } = req.body;

    if (!serialPins || !Array.isArray(serialPins)) {
      return res.status(400).json({
        success: false,
        message: 'Serial pins array is required'
      });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const addedPins = await InventoryService.addStock(productId, serialPins);

    res.json({
      success: true,
      message: `Successfully added ${addedPins.length} items to stock`,
      data: {
        addedCount: addedPins.length,
        productName: product.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add stock',
      error: error.message
    });
  }
});

// Get product stock details
router.get('/products/:productId/stock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findByPk(productId, {
      include: [{
        model: SerialPin,
        as: 'serialPins',
        attributes: ['id', 'serialNumber', 'pin', 'isUsed', 'usedAt', 'orderId', 'createdAt']
      }]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const stockAnalysis = {
      productName: product.name,
      totalPins: product.serialPins.length,
      availablePins: product.serialPins.filter(pin => !pin.isUsed && !pin.orderId).length,
      usedPins: product.serialPins.filter(pin => pin.isUsed).length,
      reservedPins: product.serialPins.filter(pin => !pin.isUsed && pin.orderId).length,
      lowStockThreshold: product.lowStockThreshold,
      isLowStock: product.isLowStock,
      lastRestocked: product.lastRestocked,
      pins: product.serialPins
    };

    res.json({
      success: true,
      data: stockAnalysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get product stock details',
      error: error.message
    });
  }
});

// Update low stock threshold
router.patch('/products/:productId/threshold', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const { lowStockThreshold } = req.body;

    if (!lowStockThreshold || lowStockThreshold < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid low stock threshold is required'
      });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.update({ lowStockThreshold });

    // Recheck stock levels
    await InventoryService.checkStockLevels();

    res.json({
      success: true,
      message: 'Low stock threshold updated successfully',
      data: {
        productName: product.name,
        newThreshold: lowStockThreshold
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update threshold',
      error: error.message
    });
  }
});

// Resolve alert
router.patch('/alerts/:alertId/resolve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { alertId } = req.params;

    const alert = await InventoryAlert.findByPk(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    await alert.update({
      isResolved: true,
      resolvedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error.message
    });
  }
});

// Force stock check
router.post('/check-stock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await InventoryService.checkStockLevels();
    
    res.json({
      success: true,
      message: 'Stock levels checked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check stock levels',
      error: error.message
    });
  }
});

module.exports = router;
