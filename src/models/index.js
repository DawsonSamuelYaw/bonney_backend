// src/models/index.js
const User = require('./User');
const Product = require('./Product');
const Order = require('./Order');
const SerialPin = require('./SerialPin');
const InventoryAlert = require('./InventoryAlert');

module.exports = {
  User,
  Product,
  Order,
  SerialPin,
  InventoryAlert
};