
// src/utils/helpers.js
const crypto = require('crypto');

const helpers = {
  // Generate random string
  generateRandomString: (length = 10) => {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
  },

  // Generate OTP
  generateOTP: (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  },

  // Format currency
  formatCurrency: (amount, currency = 'GHS') => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  // Paginate data
  paginate: (page, limit) => {
    const offset = (page - 1) * limit;
    return { limit: parseInt(limit), offset };
  },

  // Calculate pagination info
  getPaginationInfo: (page, limit, totalCount) => {
    return {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit),
      totalItems: totalCount,
      itemsPerPage: parseInt(limit),
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1
    };
  },

  // Sanitize filename
  sanitizeFilename: (filename) => {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  },

  // Generate order number
  generateOrderNumber: () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `BB${timestamp.slice(-6)}${random}`;
  },

  // Validate Ghana phone number
  validateGhanaPhone: (phone) => {
    const ghanaPhoneRegex = /^(\+233|0)[2-9]\d{8}$/;
    return ghanaPhoneRegex.test(phone);
  },

  // Format Ghana phone number
  formatGhanaPhone: (phone) => {
    // Remove any spaces or special characters
    phone = phone.replace(/[\s\-\(\)]/g, '');
    
    // Convert to international format
    if (phone.startsWith('0')) {
      return '+233' + phone.substring(1);
    } else if (!phone.startsWith('+233')) {
      return '+233' + phone;
    }
    return phone;
  },

  // Check if email is valid
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Generate secure hash
  generateHash: (data, secret) => {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  },

  // Time formatting
  timeAgo: (date) => {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }
};

module.exports = helpers;
