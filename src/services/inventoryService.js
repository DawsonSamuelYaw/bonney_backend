
// src/services/inventoryService.js
const { Product, SerialPin, InventoryAlert } = require('../models');
const { Op } = require('sequelize');
const emailService = require('./emailService');
const smsService = require('./smsService');

class InventoryService {
  // Check stock levels and create alerts
  static async checkStockLevels() {
    try {
      const products = await Product.findAll({
        where: { isActive: true }
      });

      for (const product of products) {
        const availableStock = await this.getAvailableStock(product.id);
        
        // Update product stock quantity
        await product.update({ stockQuantity: availableStock });

        // Check if stock is low or out
        if (availableStock === 0) {
          await this.createAlert(product.id, 'out_of_stock', availableStock, 0);
        } else if (availableStock <= product.lowStockThreshold) {
          await this.createAlert(product.id, 'low_stock', availableStock, product.lowStockThreshold);
        }

        // Update low stock flag
        await product.update({ isLowStock: availableStock <= product.lowStockThreshold });
      }
    } catch (error) {
      console.error('Error checking stock levels:', error);
    }
  }

  // Get available stock for a product
  static async getAvailableStock(productId) {
    const availableCount = await SerialPin.count({
      where: {
        productId,
        isUsed: false,
        orderId: null
      }
    });
    return availableCount;
  }

  // Create inventory alert
  static async createAlert(productId, alertType, currentStock, threshold) {
    try {
      // Check if alert already exists and is not resolved
      const existingAlert = await InventoryAlert.findOne({
        where: {
          productId,
          alertType,
          isResolved: false
        }
      });

      if (!existingAlert) {
        const alert = await InventoryAlert.create({
          productId,
          alertType,
          currentStock,
          threshold
        });

        // Send notification
        await this.sendInventoryNotification(alert);
        
        return alert;
      }
    } catch (error) {
      console.error('Error creating inventory alert:', error);
    }
  }

  // Send inventory notifications
  static async sendInventoryNotification(alert) {
    try {
      const product = await Product.findByPk(alert.productId);
      if (!product) return;

      const message = this.getAlertMessage(alert.alertType, product.name, alert.currentStock);
      
      // Send email to admin
      await emailService.sendInventoryAlert({
        productName: product.name,
        alertType: alert.alertType,
        currentStock: alert.currentStock,
        threshold: alert.threshold,
        supplier: product.supplier,
        supplierContact: product.supplierContact
      });

      // Send SMS if configured
      if (process.env.ADMIN_PHONE) {
        await smsService.sendInventoryAlert(process.env.ADMIN_PHONE, message);
      }

      // Mark notification as sent
      await alert.update({ notificationSent: true });
    } catch (error) {
      console.error('Error sending inventory notification:', error);
    }
  }

  // Get alert message
  static getAlertMessage(alertType, productName, currentStock) {
    switch (alertType) {
      case 'out_of_stock':
        return `🚨 URGENT: ${productName} is OUT OF STOCK! Please restock immediately.`;
      case 'low_stock':
        return `⚠️ WARNING: ${productName} is running low (${currentStock} units remaining). Consider restocking soon.`;
      case 'restock_needed':
        return `📦 RESTOCK: ${productName} needs to be restocked to maintain adequate inventory levels.`;
      default:
        return `📊 Inventory alert for ${productName}`;
    }
  }

  // Add stock (when restocking)
  static async addStock(productId, serialPins) {
    try {
      // Add serial pins to inventory
      const createdPins = await SerialPin.bulkCreate(
        serialPins.map(pin => ({
          ...pin,
          productId,
          isUsed: false
        }))
      );

      // Update product last restocked date
      await Product.update(
        { lastRestocked: new Date() },
        { where: { id: productId } }
      );

      // Resolve related alerts
      await InventoryAlert.update(
        { isResolved: true, resolvedAt: new Date() },
        { where: { productId, isResolved: false } }
      );

      // Recheck stock levels
      await this.checkStockLevels();

      return createdPins;
    } catch (error) {
      console.error('Error adding stock:', error);
      throw error;
    }
  }

  // Reserve stock for order
  static async reserveStock(orderId, items) {
    try {
      const reservedPins = [];

      for (const item of items) {
        const availablePins = await SerialPin.findAll({
          where: {
            productId: item.productId,
            isUsed: false,
            orderId: null
          },
          limit: item.quantity
        });

        if (availablePins.length < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }

        // Reserve the pins
        for (const pin of availablePins) {
          await pin.update({ orderId });
          reservedPins.push(pin);
        }
      }

      return reservedPins;
    } catch (error) {
      console.error('Error reserving stock:', error);
      throw error;
    }
  }

  // Release reserved stock
  static async releaseStock(orderId) {
    try {
      await SerialPin.update(
        { orderId: null },
        { where: { orderId, isUsed: false } }
      );
    } catch (error) {
      console.error('Error releasing stock:', error);
      throw error;
    }
  }

  // Mark stock as used
  static async markStockAsUsed(orderId) {
    try {
      await SerialPin.update(
        { isUsed: true, usedAt: new Date() },
        { where: { orderId, isUsed: false } }
      );
    } catch (error) {
      console.error('Error marking stock as used:', error);
      throw error;
    }
  }

  // Get inventory analytics
  static async getInventoryAnalytics() {
    try {
      const products = await Product.findAll({
        include: [{
          model: SerialPin,
          as: 'serialPins'
        }]
      });

      const analytics = {
        totalProducts: products.length,
        lowStockProducts: 0,
        outOfStockProducts: 0,
        totalStock: 0,
        stockValue: 0,
        products: []
      };

      for (const product of products) {
        const availableStock = product.serialPins.filter(pin => !pin.isUsed && !pin.orderId).length;
        const usedStock = product.serialPins.filter(pin => pin.isUsed).length;
        const reservedStock = product.serialPins.filter(pin => !pin.isUsed && pin.orderId).length;

        const productData = {
          id: product.id,
          name: product.name,
          category: product.category,
          availableStock,
          usedStock,
          reservedStock,
          totalStock: product.serialPins.length,
          lowStockThreshold: product.lowStockThreshold,
          isLowStock: availableStock <= product.lowStockThreshold,
          isOutOfStock: availableStock === 0,
          stockValue: parseFloat(product.price) * availableStock,
          supplier: product.supplier
        };

        if (productData.isLowStock) analytics.lowStockProducts++;
        if (productData.isOutOfStock) analytics.outOfStockProducts++;
        
        analytics.totalStock += availableStock;
        analytics.stockValue += productData.stockValue;
        analytics.products.push(productData);
      }

      return analytics;
    } catch (error) {
      console.error('Error getting inventory analytics:', error);
      throw error;
    }
  }
}

// Start monitoring interval
const startInventoryMonitoring = () => {
  // Check stock levels every 5 minutes
  setInterval(async () => {
    await InventoryService.checkStockLevels();
  }, 5 * 60 * 1000);

  // Initial check
  setTimeout(async () => {
    await InventoryService.checkStockLevels();
  }, 10000); // Wait 10 seconds after startup
};

module.exports = {
  InventoryService,
  startInventoryMonitoring
};
