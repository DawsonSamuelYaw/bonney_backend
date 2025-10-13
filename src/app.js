// src/app.js - Fixed Version with Working CORS
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// Debug logging
console.log('🌐 FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('📂 __dirname:', __dirname);
console.log('📂 process.cwd():', process.cwd());

const app = express();

// SIMPLE CORS Configuration - No complex options
app.use(cors({
  origin: [
    'https://bigbonneyshop.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('combined'));

// Helper function to require routes safely
function requireRoute(routePath, routeName) {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.join(__dirname, routePath),
      path.join(process.cwd(), 'src', routePath),
      path.join(process.cwd(), routePath),
      path.join(__dirname, '..', routePath)
    ];

    for (const tryPath of possiblePaths) {
      const jsPath = tryPath + '.js';
      const dirPath = tryPath;
      
      if (fs.existsSync(jsPath)) {
        console.log(`✅ ${routeName} routes loaded from:`, jsPath);
        return require(jsPath);
      } else if (fs.existsSync(dirPath) && fs.existsSync(path.join(dirPath, 'index.js'))) {
        console.log(`✅ ${routeName} routes loaded from:`, path.join(dirPath, 'index.js'));
        return require(path.join(dirPath, 'index.js'));
      }
    }

    throw new Error(`Route file not found in any of: ${possiblePaths.join(', ')}`);
  } catch (err) {
    console.error(`❌ ${routeName} routes error:`, err.message);
    return null;
  }
}

// Test route to verify CORS is working
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    timestamp: new Date().toISOString(),
    allowedOrigins: [
      'https://bigbonneyshop.netlify.app',
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.FRONTEND_URL
    ]
  });
});

// Load routes with fallback
const authRoutes = requireRoute('routes/auth', 'Auth') || requireRoute('./routes/auth', 'Auth');
const productRoutes = requireRoute('routes/products', 'Product') || requireRoute('./routes/products', 'Product');
const orderRoutes = requireRoute('routes/orders', 'Order') || requireRoute('./routes/orders', 'Order');
const adminRoutes = requireRoute('routes/admin', 'Admin') || requireRoute('./routes/admin', 'Admin');
const paymentRoutes = requireRoute('routes/payments', 'Payment') || requireRoute('./routes/payments', 'Payment');
const inventoryRoutes = requireRoute('routes/inventory', 'Inventory') || requireRoute('./routes/inventory', 'Inventory');
const cartRoutes = requireRoute('routes/cart', 'Cart') || requireRoute('./routes/cart', 'Cart');

// Mount routes
if (authRoutes) app.use('/api/auth', authRoutes);
if (productRoutes) app.use('/api/products', productRoutes);
if (orderRoutes) app.use('/api/orders', orderRoutes);
if (adminRoutes) app.use('/api/admin', adminRoutes);
if (paymentRoutes) app.use('/api/payments', paymentRoutes);
if (inventoryRoutes) app.use('/api/inventory', inventoryRoutes);

// Cart routes with fallback
if (cartRoutes) {
  app.use('/api/cart', cartRoutes);
  app.use('/api/user/cart', cartRoutes); // Add this duplicate route for frontend compatibility
  console.log('✅ Cart routes mounted successfully');
} else {
  console.warn('⚠️  Using fallback cart routes');
  
  // Fallback cart routes
  const cartFallbackRouter = express.Router();
  
  cartFallbackRouter.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      data: { 
        cart: { 
          items: [], 
          totalAmount: 0, 
          itemCount: 0 
        } 
      }
    });
  });

  cartFallbackRouter.post('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Cart service temporarily unavailable',
      data: { itemCount: 0 }
    });
  });

  cartFallbackRouter.put('/:productId', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Cart service temporarily unavailable',
      data: { cart: { items: [], totalAmount: 0, itemCount: 0 } }
    });
  });

  cartFallbackRouter.delete('/:productId', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Cart service temporarily unavailable',
      data: { cart: { items: [], totalAmount: 0, itemCount: 0 } }
    });
  });

  cartFallbackRouter.delete('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Cart service temporarily unavailable',
      data: { cart: { items: [], totalAmount: 0, itemCount: 0 } }
    });
  });

  app.use('/api/cart', cartFallbackRouter);
  app.use('/api/user/cart', cartFallbackRouter); // Add this duplicate route
}

// Static files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Big Bonney Backend',
    environment: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
    routes: {
      auth: !!authRoutes,
      products: !!productRoutes,
      orders: !!orderRoutes,
      admin: !!adminRoutes,
      payments: !!paymentRoutes,
      inventory: !!inventoryRoutes,
      cart: !!cartRoutes
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.path}`
    });
  }
  res.status(404).json({
    success: false,
    message: 'Not found'
  });
});

module.exports = app;