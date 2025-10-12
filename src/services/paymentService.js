
// src/services/paymentService.js
const axios = require('axios');

class PaymentService {
  constructor() {
    this.paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    this.paystackPublic = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseURL = 'https://api.paystack.co';
  }

  async initializePayment(orderData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        {
          email: orderData.email,
          amount: Math.round(orderData.amount * 100), // Convert to kobo
          reference: orderData.reference,
          callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
          metadata: {
            orderId: orderData.orderId,
            userId: orderData.userId,
            items: orderData.items
          }
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Payment initialization failed:', error.response?.data || error.message);
      throw new Error('Payment initialization failed');
    }
  }

  async verifyPayment(reference) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecret}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Payment verification failed:', error.response?.data || error.message);
      throw new Error('Payment verification failed');
    }
  }

  async processRefund(transactionId, amount) {
    try {
      const response = await axios.post(
        `${this.baseURL}/refund`,
        {
          transaction: transactionId,
          amount: Math.round(amount * 100) // Convert to kobo
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Refund processing failed:', error.response?.data || error.message);
      throw new Error('Refund processing failed');
    }
  }

  generateReference() {
    return `BB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new PaymentService();