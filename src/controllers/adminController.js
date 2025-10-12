const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const SerialPin = require('../models/SerialPin');

class AdminController {
  // Dashboard Analytics
  static async getDashboardAnalytics(req, res) {
    try {
      const [
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue,
        pendingOrders,
        completedOrders,
        totalSerialPins,
        usedSerialPins,
        recentOrders,
        recentUsers
      ] = await Promise.all([
        User.countDocuments({ role: 'customer' }),
        Order.countDocuments(),
        Product.countDocuments(),
        Order.aggregate([
          { $match: { status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Order.countDocuments({ status: 'pending' }),
        Order.countDocuments({ status: 'paid' }),
        SerialPin.countDocuments(),
        SerialPin.countDocuments({ isUsed: true }),
        Order.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'firstName lastName email'),
        User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(5).select('-password')
      ]);

      // Calculate monthly revenue
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthlyRevenue = await Order.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);

      // Today's revenue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayRevenue = await Order.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);

      res.json({
        success: true,
        stats: {
          totalUsers,
          totalOrders,
          totalProducts,
          totalRevenue: totalRevenue[0]?.total || 0,
          monthlyRevenue: monthlyRevenue[0]?.total || 0,
          todayRevenue: todayRevenue[0]?.total || 0,
          pendingOrders,
          completedOrders,
          totalSerialPins,
          usedSerialPins,
          availableSerialPins: totalSerialPins - usedSerialPins
        },
        recentOrders,
        recentUsers
      });
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard analytics',
        error: error.message
      });
    }
  }

  // Product Management
  static async getAllProducts(req, res) {
    try {
      const { page = 1, limit = 50, category, search } = req.query;
      
      const query = {};
      if (category) query.category = category;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [products, total] = await Promise.all([
        Product.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).skip(skip),
        Product.countDocuments(query)
      ]);

      res.json({
        success: true,
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch products',
        error: error.message
      });
    }
  }

  static async getProduct(req, res) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      res.json({ success: true, product });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product',
        error: error.message
      });
    }
  }

  static async createProduct(req, res) {
    try {
      const productData = req.body;
      
      if (req.file) {
        productData.image = `/uploads/${req.file.filename}`;
      }

      const product = new Product(productData);
      await product.save();

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error.message
      });
    }
  }

  static async updateProduct(req, res) {
    try {
      const updates = req.body;
      
      if (req.file) {
        updates.image = `/uploads/${req.file.filename}`;
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product updated successfully',
        product
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message
      });
    }
  }

  static async deleteProduct(req, res) {
    try {
      const product = await Product.findByIdAndDelete(req.params.id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message
      });
    }
  }

  // Order Management
  static async getAllOrders(req, res) {
    try {
      const { page = 1, limit = 50, status, search } = req.query;
      
      const query = {};
      if (status) query.status = status;
      if (search) {
        query.orderNumber = { $regex: search, $options: 'i' };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [orders, total] = await Promise.all([
        Order.find(query)
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .populate('userId', 'firstName lastName email'),
        Order.countDocuments(query)
      ]);

      res.json({
        success: true,
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders',
        error: error.message
      });
    }
  }

  static async getOrder(req, res) {
    try {
      const order = await Order.findById(req.params.id)
        .populate('userId', 'firstName lastName email phone');
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Get serial pins for this order
      const serialPins = await SerialPin.find({ orderId: order._id })
        .populate('productId', 'name');

      res.json({
        success: true,
        order,
        serialPins
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order',
        error: error.message
      });
    }
  }

  static async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      
      const order = await Order.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      ).populate('userId', 'firstName lastName email');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.json({
        success: true,
        message: 'Order status updated successfully',
        order
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update order status',
        error: error.message
      });
    }
  }

  // Serial Pin Management
  static async getSerialPins(req, res) {
    try {
      const { isUsed, productId, page = 1, limit = 100 } = req.query;
      
      const query = {};
      if (isUsed !== undefined) query.isUsed = isUsed === 'true';
      if (productId) query.productId = productId;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [serialPins, total] = await Promise.all([
        SerialPin.find(query)
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .populate('productId', 'name category')
          .populate('orderId', 'orderNumber userId'),
        SerialPin.countDocuments(query)
      ]);

      res.json({
        success: true,
        serialPins,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch serial pins',
        error: error.message
      });
    }
  }

  static async bulkAddSerialPins(req, res) {
    try {
      const { serialPins } = req.body;

      if (!Array.isArray(serialPins) || serialPins.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Serial pins array is required'
        });
      }

      const results = {
        added: [],
        failed: []
      };

      for (const pinData of serialPins) {
        try {
          const existing = await SerialPin.findOne({ serialNumber: pinData.serialNumber });
          if (existing) {
            results.failed.push({
              serialNumber: pinData.serialNumber,
              reason: 'Already exists'
            });
            continue;
          }

          const serialPin = new SerialPin({
            ...pinData,
            isUsed: false,
            status: 'available'
          });

          await serialPin.save();
          results.added.push(serialPin);
        } catch (error) {
          results.failed.push({
            serialNumber: pinData.serialNumber,
            reason: error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: `Added ${results.added.length} serial pins, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to bulk add serial pins',
        error: error.message
      });
    }
  }

  static async deleteSerialPin(req, res) {
    try {
      const serialPin = await SerialPin.findById(req.params.id);
      
      if (!serialPin) {
        return res.status(404).json({
          success: false,
          message: 'Serial pin not found'
        });
      }

      if (serialPin.isUsed && serialPin.orderId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete serial pin that has been used in an order'
        });
      }

      await SerialPin.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Serial pin deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete serial pin',
        error: error.message
      });
    }
  }

  static async toggleSerialPinUsed(req, res) {
    try {
      const serialPin = await SerialPin.findById(req.params.id);
      
      if (!serialPin) {
        return res.status(404).json({
          success: false,
          message: 'Serial pin not found'
        });
      }

      serialPin.isUsed = !serialPin.isUsed;
      serialPin.status = serialPin.isUsed ? 'sold' : 'available';
      
      if (!serialPin.isUsed) {
        serialPin.orderId = null;
        serialPin.usedAt = null;
      }

      await serialPin.save();

      res.json({
        success: true,
        message: `Serial pin ${serialPin.isUsed ? 'marked as used' : 'reactivated'}`,
        serialPin
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to toggle serial pin status',
        error: error.message
      });
    }
  }

  static async getSerialPinsStats(req, res) {
    try {
      const [total, used, byProduct] = await Promise.all([
        SerialPin.countDocuments(),
        SerialPin.countDocuments({ isUsed: true }),
        SerialPin.aggregate([
          {
            $group: {
              _id: '$productId',
              total: { $sum: 1 },
              used: {
                $sum: { $cond: ['$isUsed', 1, 0] }
              }
            }
          },
          {
            $lookup: {
              from: 'products',
              localField: '_id',
              foreignField: '_id',
              as: 'product'
            }
          }
        ])
      ]);

      res.json({
        success: true,
        stats: {
          total,
          used,
          available: total - used,
          byProduct
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch serial pins stats',
        error: error.message
      });
    }
  }

  // User Management
  static async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 50, search } = req.query;
      
      const query = { role: { $ne: 'admin' } };
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(skip),
        User.countDocuments(query)
      ]);

      res.json({
        success: true,
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error.message
      });
    }
  }

  static async getUser(req, res) {
    try {
      const user = await User.findById(req.params.id).select('-password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user's orders
      const orders = await Order.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(10);

      res.json({
        success: true,
        user,
        orders
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user',
        error: error.message
      });
    }
  }

  static async toggleUserStatus(req, res) {
    try {
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      user.isActive = !user.isActive;
      await user.save();

      res.json({
        success: true,
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to toggle user status',
        error: error.message
      });
    }
  }

  static async deleteUser(req, res) {
    try {
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete admin users'
        });
      }

      await User.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message
      });
    }
  }

  // Analytics
  static async getSalesAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;
      
      let startDate = new Date();
      if (period === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (period === '90d') {
        startDate.setDate(startDate.getDate() - 90);
      }

      const salesData = await Order.aggregate([
        {
          $match: {
            status: 'paid',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        salesData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales analytics',
        error: error.message
      });
    }
  }

  static async getUserAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;
      
      let startDate = new Date();
      if (period === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      }

      const userData = await User.aggregate([
        {
          $match: {
            role: 'customer',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            newUsers: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        userData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user analytics',
        error: error.message
      });
    }
  }

  static async exportData(req, res) {
    try {
      const { type = 'orders', format = 'json' } = req.query;
      
      let data;
      if (type === 'orders') {
        data = await Order.find()
          .populate('userId', 'firstName lastName email')
          .lean();
      } else if (type === 'users') {
        data = await User.find({ role: 'customer' })
          .select('-password')
          .lean();
      } else if (type === 'serialpins') {
        data = await SerialPin.find()
          .populate('productId', 'name')
          .populate('orderId', 'orderNumber')
          .lean();
      }

      if (format === 'csv') {
        // Convert to CSV (basic implementation)
        const csv = convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}-export.csv"`);
        res.send(csv);
      } else {
        res.json({
          success: true,
          data
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to export data',
        error: error.message
      });
    }
  }

  // Settings
  static async getSettings(req, res) {
    try {
      // Implement settings storage logic
      res.json({
        success: true,
        settings: {
          siteName: 'Big Bonney Store',
          currency: 'GHS',
          lowStockThreshold: 10
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch settings',
        error: error.message
      });
    }
  }

  static async updateSettings(req, res) {
    try {
      // Implement settings update logic
      res.json({
        success: true,
        message: 'Settings updated successfully',
        settings: req.body
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update settings',
        error: error.message
      });
    }
  }
}

// Helper function
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(val => 
      typeof val === 'object' ? JSON.stringify(val) : val
    ).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

module.exports = AdminController;