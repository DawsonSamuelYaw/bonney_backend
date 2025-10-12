
// src/routes/payments.js
const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authMiddleware } = require('../middleware/authMiddleware');

// Webhook for payment notifications
router.post('/webhook/paystack', (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    
    // Handle different event types
    switch (event.event) {
      case 'charge.success':
        // Handle successful payment
        console.log('Payment successful:', event.data);
        break;
      case 'charge.failed':
        // Handle failed payment
        console.log('Payment failed:', event.data);
        break;
      default:
        console.log('Unhandled event:', event.event);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook error');
  }
});

// Get supported payment methods
router.get('/methods', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      methods: [
        {
          id: 'paystack',
          name: 'Paystack',
          description: 'Pay with card or mobile money',
          enabled: true
        }
      ]
    }
  });
});

module.exports = router;
