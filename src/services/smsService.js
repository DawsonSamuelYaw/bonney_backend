// src/services/smsService.js
const twilio = require('twilio');

class SMSService {
  constructor() {
    // Only initialize Twilio if credentials are provided
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.isEnabled = true;
      console.log('✅ SMS service initialized');
    } else {
      this.isEnabled = false;
      console.log('⚠️ SMS service disabled - Twilio credentials not found');
    }
  }

  async sendSMS(phone, message) {
    if (!this.isEnabled) {
      console.log(`📱 SMS would be sent to ${phone}: ${message}`);
      return { success: true, message: 'SMS disabled in development' };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendVerificationCode(phone, code) {
    const message = `Your Big Bonney verification code is: ${code}. Valid for 10 minutes.`;
    return this.sendSMS(phone, message);
  }

  async sendOrderUpdate(phone, orderStatus, orderNumber) {
    const message = `Your order #${orderNumber} status: ${orderStatus}. Thank you for choosing Big Bonney!`;
    return this.sendSMS(phone, message);
  }

  async sendWelcomeSMS(phone, firstName) {
    const message = `Welcome to Big Bonney, ${firstName}! We're excited to serve you the best local dishes.`;
    return this.sendSMS(phone, message);
  }
}

// Export singleton instance
module.exports = new SMSService();