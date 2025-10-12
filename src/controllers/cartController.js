// src/controllers/cartController.js - FIXED VERSION
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const SerialPin = require('../models/SerialPin');

// Add item to cart - FIXED with proper stock checking
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, price } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Verify product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive'
      });
    }

    // Use product price if not provided
    const itemPrice = price || product.price;

    // Get available stock based on product type
    let availableStock = 0;
    if (product.category === 'checker') {
      // For checker products, count unused serial pins
      availableStock = await SerialPin.countDocuments({
        productId: productId,
        isUsed: false,
        orderId: null
      });
    } else {
      // For other products, use stockQuantity
      availableStock = product.stockQuantity || 0;
    }

    // Check if product is in stock
    if (availableStock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock'
      });
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if item already exists in cart
    const existingItem = cart.items.find(item => 
      item.productId.toString() === productId.toString()
    );

    const currentCartQuantity = existingItem ? existingItem.quantity : 0;
    const newTotalQuantity = currentCartQuantity + quantity;

    // CRITICAL FIX: Check if adding this quantity would exceed available stock
    if (newTotalQuantity > availableStock) {
      const remainingStock = availableStock - currentCartQuantity;
      return res.status(400).json({
        success: false,
        message: `Cannot add ${quantity} items. Only ${remainingStock} available (${currentCartQuantity} already in cart, ${availableStock} total stock)`
      });
    }

    // Add item to cart
    await cart.addItem(productId, quantity, itemPrice);

    // Populate product details for response
    await cart.populate({
      path: 'items.productId',
      select: 'name image price category'
    });

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: {
        cart,
        itemCount: cart.itemCount,
        totalAmount: cart.totalAmount
      }
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: error.message
    });
  }
};

// Update cart item with stock validation
const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    if (!quantity || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    if (quantity === 0) {
      await cart.removeItem(productId);
    } else {
      // Check stock before updating quantity
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Get available stock
      let availableStock = 0;
      if (product.category === 'checker') {
        availableStock = await SerialPin.countDocuments({
          productId: productId,
          isUsed: false,
          orderId: null
        });
      } else {
        availableStock = product.stockQuantity || 0;
      }

      // Check if requested quantity exceeds stock
      if (quantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Cannot set quantity to ${quantity}. Only ${availableStock} available in stock`
        });
      }

      await cart.updateItemQuantity(productId, quantity);
    }

    await cart.populate({
      path: 'items.productId',
      select: 'name image price category'
    });

    res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      data: { cart }
    });

  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart',
      error: error.message
    });
  }
};

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      select: 'name image price category originalPrice discountPercentage'
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: 'Cart is empty',
        data: {
          cart: { items: [], totalAmount: 0, itemCount: 0 }
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully',
      data: { cart }
    });

  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cart',
      error: error.message
    });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    await cart.removeItem(productId);

    await cart.populate({
      path: 'items.productId',
      select: 'name image price category'
    });

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: { cart }
    });

  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
      error: error.message
    });
  }
};

// Clear entire cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    await cart.clearCart();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: { cart }
    });

  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message
    });
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart
};