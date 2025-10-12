
// src/utils/validation.js
const { body, param, query } = require('express-validator');

const userValidation = {
  register: [
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters')
      .trim()
      .escape(),
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters')
      .trim()
      .escape(),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^[\+]?[1-9][\d]{0,15}$/)
      .withMessage('Valid phone number is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
  ],
  login: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]
};

const productValidation = {
  create: [
    body('name')
      .notEmpty()
      .withMessage('Product name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Product name must be between 2 and 100 characters')
      .trim()
      .escape(),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters')
      .trim()
      .escape(),
    body('category')
      .isIn(['form', 'checker', 'tool'])
      .withMessage('Category must be form, checker, or tool'),
    body('price')
      .isDecimal({ decimal_digits: '0,2' })
      .withMessage('Valid price is required')
      .custom(value => {
        if (parseFloat(value) <= 0) {
          throw new Error('Price must be greater than 0');
        }
        return true;
      }),
    body('lowStockThreshold')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Low stock threshold must be a positive integer')
  ]
};

const orderValidation = {
  create: [
    body('items')
      .isArray({ min: 1 })
      .withMessage('At least one item is required'),
    body('items.*.productId')
      .isUUID()
      .withMessage('Valid product ID is required'),
    body('items.*.quantity')
      .isInt({ min: 1, max: 100 })
      .withMessage('Quantity must be between 1 and 100')
  ]
};

module.exports = {
  userValidation,
  productValidation,
  orderValidation
};
