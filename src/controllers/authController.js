// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

class AuthController {
  // Register user
  static async register(req, res) {
    try {
      const { firstName, lastName, email, phone, password } = req.body;

      // Check if user already exists - Fixed for Mongoose
      const existingUser = await User.findOne({
        $or: [{ email }, { phone }] // Fixed: Changed Sequelize Op.or to MongoDB $or
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      // Create user - Mongoose syntax is the same
      const user = await User.create({
        firstName,
        lastName,
        email,
        phone,
        password
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(user);
      } catch (emailError) {
        console.error('Welcome email failed:', emailError);
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role
          },
          token
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }

  // Login user
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user - Fixed: Added .select('+password') to include password field
      const user = await User.findOne({ email }).select('+password');
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last login
      await User.findByIdAndUpdate(user.id, { lastLogin: new Date() });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            lastLogin: user.lastLogin
          },
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }

  // Get current user
  static async getCurrentUser(req, res) {
    try {
      const user = req.user;
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            lastLogin: user.lastLogin
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get user data',
        error: error.message
      });
    }
  }

  // Update profile
  static async updateProfile(req, res) {
    try {
      const { firstName, lastName, phone } = req.body;
      const user = req.user;

      // Check if phone is already taken by another user - Fixed for Mongoose
      if (phone && phone !== user.phone) {
        const existingUser = await User.findOne({
          phone: phone,
          _id: { $ne: user.id } // Fixed: Changed Sequelize Op.ne to MongoDB $ne
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Phone number already in use'
          });
        }
      }

      await User.findByIdAndUpdate(user.id, {
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        phone: phone || user.phone
      });

      // Fetch updated user
      const updatedUser = await User.findById(user.id);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            phone: updatedUser.phone,
            role: updatedUser.role
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Profile update failed',
        error: error.message
      });
    }
  }

  // Change password
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user.id).select('+password'); // Fixed: Get user with password

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Password change failed',
        error: error.message
      });
    }
  }
}

module.exports = AuthController;