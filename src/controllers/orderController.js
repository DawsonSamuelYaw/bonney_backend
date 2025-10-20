// src/controllers/orderController.js - FIXED VERSION
const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require('../models/cart');
const Product = require('../models/Product');
const SerialPin = require('../models/SerialPin');
const axios = require('axios');
const mongoose = require('mongoose');

class OrderController {
  // Get user orders
  static async getUserOrders(req, res) {
    try {
      const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
      const userId = req.user.id;

      let sortObj = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const orders = await Order.find({ userId })
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(skip)
        .populate('userId', 'firstName lastName email')
        .lean();

      const totalOrders = await Order.countDocuments({ userId });

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOrders / parseInt(limit)),
            totalItems: totalOrders,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Get user orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders',
        error: error.message
      });
    }
  }

  // Get order by ID
  static async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const query = { 
        _id: id,
        ...(user.role !== 'admin' && { userId: user._id })
      };

      const order = await Order.findOne(query)
        .populate('userId', 'firstName lastName email');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.json({
        success: true,
        data: { order }
      });
    } catch (error) {
      console.error('Get order by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order',
        error: error.message
      });
    }
  }

  // Create new order with proper validation and payment initialization
  static async createOrder(req, res) {
    try {
      const { items, paymentMethod = 'paystack', shippingAddress } = req.body;
      const user = req.user;

      console.log('Creating order for user:', user._id);
      console.log('Order data:', { items, paymentMethod, shippingAddress });

      // Validate input
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order items are required'
        });
      }

      // Get user's cart to validate items
      const userCart = await Cart.findOne({ userId: user._id }).populate('items.productId');
      if (!userCart || userCart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty. Please add items to cart before checkout.'
        });
      }

      // Validate and process items
      let totalAmount = 0;
      const validatedItems = [];
      const stockErrors = [];

      for (const item of items) {
        try {
          // Find product
          const product = await Product.findById(item.productId);
          if (!product || !product.isActive) {
            return res.status(404).json({
              success: false,
              message: `Product ${item.productId} not found or inactive`
            });
          }

          // Check stock availability
          let availableStock = 0;
          if (product.category === 'checker') {
            availableStock = await SerialPin.countDocuments({
              productId: product._id,
              isUsed: false,
              status: 'available'
            });
            console.log(`Checker product ${product.name}: ${availableStock} pins available`);
          } else {
            availableStock = product.stockQuantity || 0;
          }

          // Validate quantity against stock
          if (item.quantity > availableStock) {
            stockErrors.push(`${product.name}: requested ${item.quantity}, only ${availableStock} available`);
            continue;
          }

          const itemPrice = item.price || product.price;
          const itemTotal = itemPrice * item.quantity;
          totalAmount += itemTotal;

          validatedItems.push({
            productId: product._id,
            productName: product.name,
            productCategory: product.category,
            price: itemPrice,
            quantity: item.quantity,
            total: itemTotal
          });

        } catch (error) {
          console.error(`Error processing item ${item.productId}:`, error);
          return res.status(500).json({
            success: false,
            message: `Error processing item: ${error.message}`
          });
        }
      }

      // Check for stock errors
      if (stockErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Stock validation failed',
          errors: stockErrors
        });
      }

      if (validatedItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid items found in order'
        });
      }

      // Create order
      const order = new Order({
        userId: user._id,
        items: validatedItems,
        totalAmount,
        paymentMethod,
        shippingAddress: shippingAddress || {
          name: user.firstName + ' ' + user.lastName,
          email: user.email,
          phone: user.phone || ''
        },
        status: 'pending',
        orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      });

      await order.save();

      // Initialize payment based on method
      let paymentResponse = null;
      
      if (paymentMethod === 'paystack') {
        try {
          paymentResponse = await OrderController.initializePaystackPayment(order, user);
        } catch (payError) {
          console.error('Paystack initialization error:', payError);
        }
      }

      const response = {
        success: true,
        message: 'Order created successfully',
        data: {
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            status: order.status,
            items: order.items,
            paymentMethod: order.paymentMethod
          }
        }
      };

      if (paymentResponse) {
        response.data.payment = paymentResponse;
      }

      res.status(201).json(response);

    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create order',
        error: error.message
      });
    }
  }

  // Initialize Paystack payment
  static async initializePaystackPayment(order, user) {
    try {
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      
      if (!paystackSecretKey) {
        throw new Error('Paystack secret key not configured');
      }

      const paymentData = {
        email: user.email,
        amount: Math.round(order.totalAmount * 100),
        reference: `${order.orderNumber}_${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/checkout`,
        metadata: {
          orderId: order._id.toString(),
          userId: user._id.toString(),
          orderNumber: order.orderNumber
        },
        channels: ['card', 'bank', 'mobile_money'],
        currency: 'GHS'
      };

      console.log('Initializing Paystack payment:', paymentData);

      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === true) {
        await Order.findByIdAndUpdate(order._id, {
          'paymentDetails.reference': response.data.data.reference,
          'paymentDetails.accessCode': response.data.data.access_code
        });

        return {
          authorization_url: response.data.data.authorization_url,
          access_code: response.data.data.access_code,
          reference: response.data.data.reference
        };
      } else {
        throw new Error(response.data.message || 'Paystack initialization failed');
      }

    } catch (error) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw error;
    }
  }

  // CRITICAL FIX: Verify payment with proper ObjectId handling
  static async verifyPayment(req, res) {
    try {
      const { reference } = req.body;
      
      if (!reference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference is required'
        });
      }

      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      
      if (!paystackSecretKey) {
        return res.status(500).json({
          success: false,
          message: 'Payment service not configured'
        });
      }

      console.log('=== PAYMENT VERIFICATION ===');
      console.log('Verifying payment with reference:', reference);

      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`
          }
        }
      );

      if (response.data.status === true && response.data.data.status === 'success') {
        const paymentData = response.data.data;
        const orderId = paymentData.metadata?.orderId;

        console.log('Payment successful for order:', orderId);

        if (!orderId) {
          return res.status(400).json({
            success: false,
            message: 'Order ID not found in payment metadata'
          });
        }

        const order = await Order.findById(orderId);

        if (!order) {
          return res.status(404).json({
            success: false,
            message: 'Order not found'
          });
        }

        if (order.status === 'paid') {
          console.log('Order already processed');
          await order.populate('items.productId');
          const serialPins = await SerialPin.find({ orderId: order._id })
            .populate('productId', 'name category description');
          
          return res.json({
            success: true,
            message: 'Payment already processed',
            data: { 
              order,
              serialPins 
            }
          });
        }

        // Update order status FIRST
        order.status = 'paid';
        order.paymentDetails.paidAt = new Date();
        order.paymentDetails.paystackResponse = paymentData;
        await order.save();

        console.log('Order status updated to paid');

        // CRITICAL FIX: Assign serial pins with proper ObjectId conversion
        let totalAssignedPins = 0;
        const assignedPins = [];
        
        for (const item of order.items) {
          if (item.productCategory === 'checker') {
            console.log(`\n--- Processing checker product ---`);
            console.log(`Product Name: ${item.productName}`);
            console.log(`Product ID (from order): ${item.productId}`);
            console.log(`Product ID type: ${typeof item.productId}`);
            console.log(`Quantity needed: ${item.quantity}`);
            
            const quantity = item.quantity;
            
            // CRITICAL FIX: Convert to ObjectId if it's a string
            let productObjectId;
            if (typeof item.productId === 'string') {
              productObjectId = new mongoose.Types.ObjectId(item.productId);
              console.log(`Converted string to ObjectId: ${productObjectId}`);
            } else {
              productObjectId = item.productId;
            }

            // Debug: Check what pins exist for this product
            const allPinsForProduct = await SerialPin.find({ 
              productId: productObjectId 
            });
            console.log(`Total pins in DB for this product: ${allPinsForProduct.length}`);
            
            const availablePinsForProduct = await SerialPin.find({ 
              productId: productObjectId,
              isUsed: false,
              status: 'available'
            });
            console.log(`Available pins for this product: ${availablePinsForProduct.length}`);

            // Find available serial pins
            const availablePins = await SerialPin.find({
              productId: productObjectId,
              isUsed: false,
              status: 'available'
            }).limit(quantity);

            console.log(`Found ${availablePins.length} available pins to assign`);

            if (availablePins.length < quantity) {
              console.error(`❌ NOT ENOUGH PINS! Need ${quantity}, found ${availablePins.length}`);
              continue;
            }

            // Assign pins to order
            const pinIds = availablePins.map(pin => pin._id);
            console.log(`Assigning pin IDs: ${pinIds.join(', ')}`);
            
            const updateResult = await SerialPin.updateMany(
              { _id: { $in: pinIds } },
              {
                orderId: order._id,
                isUsed: true,
                status: 'sold',
                usedAt: new Date()
              }
            );

            console.log(`✅ Update result: ${updateResult.modifiedCount} pins modified`);
            totalAssignedPins += updateResult.modifiedCount;
            
            // Get the updated pins for response
            const updatedPins = await SerialPin.find({ _id: { $in: pinIds } })
              .populate('productId', 'name category description');
            assignedPins.push(...updatedPins);
          }
        }

        console.log(`\n=== ASSIGNMENT COMPLETE ===`);
        console.log(`Total pins assigned: ${totalAssignedPins}`);

        // Clear user's cart
        await Cart.findOneAndUpdate(
          { userId: order.userId },
          { items: [], totalAmount: 0, itemCount: 0 }
        );

        console.log('Cart cleared for user:', order.userId);

        // Populate order for response
        await order.populate('items.productId');
        const serialPins = await SerialPin.find({ orderId: order._id })
          .populate('productId', 'name category description');

        console.log(`Final check - Serial pins found for order: ${serialPins.length}`);

        res.json({
          success: true,
          message: 'Payment verified successfully',
          data: { 
            order,
            serialPins,
            totalAssignedPins,
            debug: {
              orderItems: order.items.length,
              pinsAssigned: serialPins.length
            }
          }
        });

      } else {
        res.status(400).json({
          success: false,
          message: 'Payment verification failed',
          data: response.data
        });
      }

    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Payment verification failed',
        error: error.message
      });
    }
  }

  // Cancel order (only if pending)
  static async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const order = await Order.findOne({
        _id: id,
        userId: user._id,
        status: { $in: ['pending', 'processing'] }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or cannot be cancelled'
        });
      }

      // Release any assigned serial pins
      await SerialPin.updateMany(
        { orderId: order._id },
        { 
          $unset: { orderId: 1 }, 
          status: 'available',
          isUsed: false,
          $unset: { usedAt: 1 }
        }
      );

      // Update order status
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      await order.save();

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: { order }
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: error.message
      });
    }
  }
}

module.exports = OrderController;