// src/routes/cart.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cartController');

// All cart routes require authentication
router.use(protect);

// Get user's cart
router.get('/', getCart);

// Add item to cart
router.post('/', addToCart);

// Update cart item quantity
router.put('/:productId', updateCartItem);

// Remove item from cart
router.delete('/:productId', removeFromCart);

// Clear entire cart
router.delete('/', clearCart);

module.exports = router;