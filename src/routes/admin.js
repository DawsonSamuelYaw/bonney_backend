// src/routes/admin.js - Updated with debugging and fixes
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// FIXED: More lenient rate limiting for development
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased from 5 to 10 attempts
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for development
  skip: (req) => process.env.NODE_ENV === 'development'
});

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

// Custom admin authentication middleware
const customAdminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.header('x-auth-token');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if user is admin
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Verify admin still exists and is active
    const admin = await User.findById(decoded.userId);
    if (!admin || !admin.isActive || admin.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or admin account deactivated.'
      });
    }

    req.admin = admin;
    req.user = admin;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

// ADDED: Test endpoint to verify API is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Admin API is working!',
    timestamp: new Date().toISOString()
  });
});

// ENHANCED: Admin login route with better debugging
router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }).withMessage('Password is required')
], validateRequest, async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔍 Admin login attempt for:', email);

    // Find admin user and include password field
    const admin = await User.findOne({ 
      email: email.toLowerCase(),
      role: 'admin',
      isActive: true
    }).select('+password');

    console.log('👤 Admin found:', admin ? `${admin.firstName} ${admin.lastName}` : 'Not found');

    if (!admin) {
      console.log('❌ Admin not found or inactive');
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    console.log('🔐 Comparing password...');
    console.log('Password from request length:', password.length);
    console.log('Stored hash length:', admin.password.length);
    console.log('Stored hash preview:', admin.password.substring(0, 20) + '...');

    // Check password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    console.log('🔑 Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Update last login without triggering validation
    await User.updateOne(
      { _id: admin._id },
      { $set: { lastLogin: new Date() } }
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: admin._id,
        email: admin.email,
        role: admin.role,
        type: 'admin'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    );

    console.log('✅ Login successful');

    // Send response
    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        fullName: admin.fullName,
        lastLogin: admin.lastLogin
      }
    });

  } catch (error) {
    console.error('💥 Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ADDED: Debug endpoint to check admin in database
router.get('/debug/admin-info', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    const admin = await User.findOne({ 
      email: 'bbstore@company.com',
      role: 'admin'
    }).select('+password');

    if (!admin) {
      return res.json({
        success: false,
        message: 'Admin not found',
        searchedEmail: 'bbstore@company.com'
      });
    }

    res.json({
      success: true,
      admin: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        lastLogin: admin.lastLogin,
        passwordHashLength: admin.password.length,
        passwordHashPreview: admin.password.substring(0, 20) + '...'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

// Get admin profile
router.get('/profile', customAdminAuth, async (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.admin._id,
      firstName: req.admin.firstName,
      lastName: req.admin.lastName,
      email: req.admin.email,
      role: req.admin.role,
      fullName: req.admin.fullName,
      lastLogin: req.admin.lastLogin,
      createdAt: req.admin.createdAt
    }
  });
});

// Logout endpoint
router.post('/logout', customAdminAuth, async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Verify token endpoint
router.get('/verify-token', customAdminAuth, async (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    admin: {
      id: req.admin._id,
      firstName: req.admin.firstName,
      lastName: req.admin.lastName,
      email: req.admin.email,
      role: req.admin.role,
      fullName: req.admin.fullName
    }
  });
});

// Use custom admin auth for all remaining routes
router.use(customAdminAuth);

// Dashboard analytics
router.get('/dashboard', AdminController.getDashboardAnalytics);

// Product management
router.post('/products', upload.single('image'), [
  body('name').notEmpty().trim().escape(),
  body('category').isIn(['form', 'checker', 'tool']),
  body('price').isDecimal({ decimal_digits: '0,2' }),
  body('lowStockThreshold').optional().isInt({ min: 0 })
], validateRequest, AdminController.createProduct);

router.patch('/products/:id', upload.single('image'), AdminController.updateProduct);
router.delete('/products/:id', AdminController.deleteProduct);
router.get('/products', AdminController.getAllProducts);
router.get('/products/:id', AdminController.getProduct);

// Order management
router.get('/orders', AdminController.getAllOrders);
router.get('/orders/:id', AdminController.getOrder);
router.patch('/orders/:id/status', AdminController.updateOrderStatus);
// Add this to your existing src/routes/admin.js file
// Insert this BEFORE the existing serial pins routes

// Individual Serial Pin Routes (add these)
router.post('/serial-pins', [
  body('serialNumber').notEmpty().trim().withMessage('Serial number is required'),
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('pin').optional().trim(),
  body('expiresAt').optional().isISO8601().withMessage('Invalid expiration date')
], validateRequest, async (req, res) => {
  try {
    const { serialNumber, pin, productId, expiresAt } = req.body;

    // Check if product exists
    const Product = require('../models/Product');
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if serial number already exists
    const SerialPin = require('../models/SerialPin');
    const existingPin = await SerialPin.findOne({ serialNumber: serialNumber.trim() });
    if (existingPin) {
      return res.status(400).json({
        success: false,
        message: 'Serial number already exists'
      });
    }

    // Create new serial pin
    const newSerialPin = new SerialPin({
      serialNumber: serialNumber.trim(),
      pin: pin?.trim() || '',
      productId,
      isUsed: false,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await newSerialPin.save();

    // Populate product info
    await newSerialPin.populate('productId', 'name price');

    res.status(201).json({
      success: true,
      message: 'Serial pin created successfully',
      serialPin: newSerialPin
    });

  } catch (error) {
    console.error('Create serial pin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create serial pin',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// Edit/Update serial pin
router.patch('/serial-pins/:id', customAdminAuth, [
  body('serialNumber').optional().trim(),
  body('pin').optional().trim(),
  body('expiresAt').optional().isISO8601()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { serialNumber, pin, expiresAt } = req.body;

    const SerialPin = require('../models/SerialPin');
    const serialPin = await SerialPin.findById(id);
    
    if (!serialPin) {
      return res.status(404).json({
        success: false,
        message: 'Serial pin not found'
      });
    }

    // Check if new serial number already exists (if being changed)
    if (serialNumber && serialNumber !== serialPin.serialNumber) {
      const existing = await SerialPin.findOne({ serialNumber: serialNumber.trim() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Serial number already exists'
        });
      }
      serialPin.serialNumber = serialNumber.trim();
    }

    if (pin !== undefined) serialPin.pin = pin.trim();
    if (expiresAt !== undefined) serialPin.expiresAt = expiresAt ? new Date(expiresAt) : null;

    await serialPin.save();
    await serialPin.populate('productId', 'name category');

    res.json({
      success: true,
      message: 'Serial pin updated successfully',
      serialPin
    });

  } catch (error) {
    console.error('Update serial pin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update serial pin',
      error: error.message
    });
  }
});

// Reactivate serial pin (already in your routes but ensuring it's correct)
router.patch('/serial-pins/:id/reactivate', customAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const SerialPin = require('../models/SerialPin');
    
    const serialPin = await SerialPin.findById(id);
    if (!serialPin) {
      return res.status(404).json({
        success: false,
        message: 'Serial pin not found'
      });
    }

    serialPin.isUsed = false;
    serialPin.status = 'available';
    serialPin.orderId = null;
    serialPin.usedAt = null;

    await serialPin.save();
    await serialPin.populate('productId', 'name category');

    res.json({
      success: true,
      message: 'Serial pin reactivated successfully',
      serialPin
    });

  } catch (error) {
    console.error('Reactivate serial pin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate serial pin',
      error: error.message
    });
  }
});
// Make sure your existing routes are in this order:
// router.get('/serial-pins', AdminController.getSerialPins);
// router.post('/serial-pins/bulk', AdminController.bulkAddSerialPins);
// router.delete('/serial-pins
// Serial Pins Management Routes
router.get('/serial-pins', AdminController.getSerialPins);
router.post('/serial-pins/bulk', AdminController.bulkAddSerialPins);
router.delete('/serial-pins/:id', AdminController.deleteSerialPin);
router.patch('/serial-pins/:id/toggle-used', AdminController.toggleSerialPinUsed);
router.get('/serial-pins/stats', AdminController.getSerialPinsStats);

// User management
router.get('/users', AdminController.getAllUsers);
router.get('/users/:id', AdminController.getUser);
router.patch('/users/:id/toggle-status', AdminController.toggleUserStatus);
router.delete('/users/:id', AdminController.deleteUser);

// Analytics and Reports
router.get('/analytics/sales', AdminController.getSalesAnalytics);
router.get('/analytics/users', AdminController.getUserAnalytics);
router.get('/reports/export', AdminController.exportData);

// Settings management
router.get('/settings', AdminController.getSettings);
router.patch('/settings', AdminController.updateSettings);

module.exports = router;