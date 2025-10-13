// src/controllers/cartController.js
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Get user's cart
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id }).populate('items.productId');
    
    if (!cart) {
      cart = await Cart.create({
        user: req.user.id,
        items: [],
        totalAmount: 0,
        itemCount: 0
      });
    }

    res.json({
      success: true,
      data: {
        cart: {
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount
        }
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart'
    });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, price } = req.body;
    
    // Validate required fields
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check stock availability
    if (product.availableStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.availableStock} items available in stock`
      });
    }

    let cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      // Create new cart if it doesn't exist
      cart = new Cart({
        user: req.user.id,
        items: [{
          productId,
          quantity,
          price: price || product.price,
          name: product.name,
          image: product.image
        }],
        totalAmount: (price || product.price) * quantity,
        itemCount: quantity
      });
    } else {
      // Check if item already exists in cart
      const existingItemIndex = cart.items.findIndex(
        item => item.productId.toString() === productId
      );

      if (existingItemIndex > -1) {
        // Update existing item quantity
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        
        // Check stock for updated quantity
        if (product.availableStock < newQuantity) {
          return res.status(400).json({
            success: false,
            message: `Only ${product.availableStock} items available in stock`
          });
        }
        
        cart.items[existingItemIndex].quantity = newQuantity;
      } else {
        // Add new item to cart
        cart.items.push({
          productId,
          quantity,
          price: price || product.price,
          name: product.name,
          image: product.image
        });
      }

      // Recalculate totals
      cart.totalAmount = cart.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);

      cart.itemCount = cart.items.reduce((total, item) => {
        return total + item.quantity;
      }, 0);
    }

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      success: true,
      data: {
        message: 'Item added to cart successfully',
        cart: {
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount
        }
      }
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart'
    });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be negative'
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Check stock availability
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      if (product.availableStock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.availableStock} items available in stock`
        });
      }

      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }

    // Recalculate totals
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    cart.itemCount = cart.items.reduce((total, item) => {
      return total + item.quantity;
    }, 0);

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      success: true,
      data: {
        cart: {
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount
        }
      }
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart item'
    });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    // Remove the item
    cart.items.splice(itemIndex, 1);

    // Recalculate totals
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    cart.itemCount = cart.items.reduce((total, item) => {
      return total + item.quantity;
    }, 0);

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      success: true,
      data: {
        message: 'Item removed from cart',
        cart: {
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount
        }
      }
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove cart item'
    });
  }
};

// Clear entire cart
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Clear all items
    cart.items = [];
    cart.totalAmount = 0;
    cart.itemCount = 0;

    await cart.save();

    res.json({
      success: true,
      data: {
        message: 'Cart cleared successfully',
        cart: {
          items: [],
          totalAmount: 0,
          itemCount: 0
        }
      }
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};