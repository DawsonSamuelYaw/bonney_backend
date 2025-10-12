
// src/utils/constants.js
const constants = {
  // User roles
  USER_ROLES: {
    CUSTOMER: 'customer',
    ADMIN: 'admin'
  },

  // Product categories
  PRODUCT_CATEGORIES: {
    FORM: 'form',
    CHECKER: 'checker',
    TOOL: 'tool'
  },

  // Order statuses
  ORDER_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },

  // Delivery statuses
  DELIVERY_STATUS: {
    PENDING: 'pending',
    DELIVERED: 'delivered',
    FAILED: 'failed'
  },

  // Inventory alert types
  ALERT_TYPES: {
    LOW_STOCK: 'low_stock',
    OUT_OF_STOCK: 'out_of_stock',
    RESTOCK_NEEDED: 'restock_needed'
  },

  // Payment methods
  PAYMENT_METHODS: {
    PAYSTACK: 'paystack',
    FLUTTERWAVE: 'flutterwave',
    MOMO: 'mobile_money'
  },

  // Email templates
  EMAIL_TEMPLATES: {
    WELCOME: 'welcome',
    ORDER_CONFIRMATION: 'order_confirmation',
    INVENTORY_ALERT: 'inventory_alert',
    PASSWORD_RESET: 'password_reset'
  },

  // File upload limits
  FILE_LIMITS: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  },

  // Cache keys
  CACHE_KEYS: {
    USER_SESSION: 'user_session:',
    PRODUCT_LIST: 'products:list',
    INVENTORY_ALERTS: 'inventory:alerts',
    DASHBOARD_STATS: 'dashboard:stats'
  },

  // Cache TTL (Time To Live) in seconds
  CACHE_TTL: {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 3600, // 1 hour
    DAILY: 86400 // 24 hours
  },

  // Error messages
  ERROR_MESSAGES: {
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    NOT_FOUND: 'Resource not found',
    VALIDATION_ERROR: 'Validation failed',
    SERVER_ERROR: 'Internal server error',
    INSUFFICIENT_STOCK: 'Insufficient stock available',
    PAYMENT_FAILED: 'Payment processing failed',
    EMAIL_SEND_FAILED: 'Failed to send email',
    SMS_SEND_FAILED: 'Failed to send SMS'
  },

  // Success messages
  SUCCESS_MESSAGES: {
    USER_REGISTERED: 'User registered successfully',
    LOGIN_SUCCESS: 'Login successful',
    PROFILE_UPDATED: 'Profile updated successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    ORDER_CREATED: 'Order created successfully',
    PAYMENT_VERIFIED: 'Payment verified successfully',
    PRODUCT_CREATED: 'Product created successfully',
    PRODUCT_UPDATED: 'Product updated successfully',
    STOCK_ADDED: 'Stock added successfully',
    ALERT_RESOLVED: 'Alert resolved successfully'
  },

  // Notification settings
  NOTIFICATIONS: {
    LOW_STOCK_THRESHOLD: 10,
    EMAIL_QUEUE_RETRY: 3,
    SMS_QUEUE_RETRY: 3,
    INVENTORY_CHECK_INTERVAL: 5 * 60 * 1000 // 5 minutes
  },

  // Security settings
  SECURITY: {
    JWT_EXPIRES_IN: '7d',
    BCRYPT_ROUNDS: 12,
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100, // requests per window
    PASSWORD_MIN_LENGTH: 8,
    OTP_LENGTH: 6,
    OTP_EXPIRES_IN: 10 * 60 * 1000 // 10 minutes
  },

  // Business settings
  BUSINESS: {
    COMPANY_NAME: 'Big Bonney Ventures',
    COMPANY_EMAIL: 'info@bigbonney.com',
    COMPANY_PHONE: '+233123456789',
    CURRENCY: 'GHS',
    TAX_RATE: 0.125, // 12.5% VAT
    COMMISSION_RATE: 0.05 // 5% commission
  }
};

module.exports = constants;
