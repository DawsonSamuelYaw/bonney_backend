// src/routes/cart.js
const express = require('express');
const router = express.Router();
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cartController');

// Import your auth middleware - CORRECTED PATH
const { authMiddleware } = require('../middleware/authMiddleware');

// Apply authentication to all cart routes
router.use(authMiddleware);

// GET /api/cart - Get user's cart
router.get('/', getCart);

// POST /api/cart - Add item to cart
router.post('/', addToCart);

// PUT /api/cart/:productId - Update item quantity in cart
router.put('/:productId', updateCartItem);

// DELETE /api/cart/:productId - Remove item from cart
router.delete('/:productId', removeFromCart);

// DELETE /api/cart - Clear entire cart
router.delete('/', clearCart);

module.exports = router;