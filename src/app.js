// src/app.js - Fixed CORS and Route Configuration
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

require('dotenv').config();

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const inventoryRoutes = require('./routes/inventory');

// Import cart routes with better error handling
let cartRoutes;
try {
  cartRoutes = require('./routes/cart');
  console.log('✅ Cart routes loaded successfully');
} catch (err) {
  console.warn('⚠️  Cart routes not found - creating fallback routes');
  // Create simple fallback cart routes
  const express = require('express');
  cartRoutes = express.Router();
  cartRoutes.use((req, res) => {
    res.status(501).json({
      success: false,
      message: 'Cart functionality is currently being implemented'
    });
  });
}

const app = express();

// Fix for express-rate-limit trust proxy issue
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS Configuration - FIXED
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', 
      'http://localhost:3001',
      'https://bonney-backend.onrender.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Rate limiting with trust proxy fix
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('combined'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);

// Mount cart routes (either real or fallback)
app.use('/api/cart', cartRoutes);

// Alternative cart endpoints for compatibility
app.use('/api/user/cart', cartRoutes);

// Static files
app.use('/uploads', express.static('uploads'));

// Health check with detailed info
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Big Bonney Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: {
      cart: !!cartRoutes
    }
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Big Bonney API is running',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products', 
      cart: '/api/cart',
      orders: '/api/orders',
      payments: '/api/payments',
      inventory: '/api/inventory'
    },
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy: Origin not allowed'
    });
  }
  
  // Rate limit errors
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.'
    });
  }
  
  // Default error
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    })
  });
});

// 404 handler - should be last
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

module.exports = app;