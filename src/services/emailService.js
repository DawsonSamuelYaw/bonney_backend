// src/services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail', // or your preferred service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendWelcomeEmail(user) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Welcome to Big Bonney Ventures!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome ${user.firstName}!</h1>
          <p>Thank you for joining Big Bonney Ventures. We're excited to have you on board!</p>
          <p>You can now access our premium forms and checkers to boost your productivity.</p>
          <div style="margin: 20px 0;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Login to Your Account
            </a>
          </div>
          <p>Best regards,<br>The Big Bonney Team</p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendOrderConfirmation(order, user, serialPins) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Order Confirmed!</h1>
          <p>Hello ${user.firstName},</p>
          <p>Your order has been confirmed and processed successfully.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Order Details:</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Total Amount:</strong> GHS ${order.totalAmount}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          </div>

          <h3>Your Serial Numbers & PINs:</h3>
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            ${serialPins.map(pin => `
              <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 3px;">
                <strong>Serial:</strong> ${pin.serialNumber}<br>
                ${pin.pin ? `<strong>PIN:</strong> ${pin.pin}` : ''}
              </div>
            `).join('')}
          </div>

          <p><strong>Important:</strong> Please save these serial numbers and PINs securely. You will need them to access your purchased items.</p>
          
          <p>Thank you for your purchase!</p>
          <p>Best regards,<br>The Big Bonney Team</p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendInventoryAlert({ productName, alertType, currentStock, threshold, supplier, supplierContact }) {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const alertMessages = {
      'out_of_stock': 'OUT OF STOCK - URGENT ACTION REQUIRED',
      'low_stock': 'LOW STOCK WARNING',
      'restock_needed': 'RESTOCK NOTIFICATION'
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: adminEmail,
      subject: `🚨 INVENTORY ALERT: ${productName} - ${alertMessages[alertType]}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${alertType === 'out_of_stock' ? '#dc3545' : '#ffc107'}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
            <h1 style="margin: 0;">📦 INVENTORY ALERT</h1>
          </div>
          
          <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
            <h2 style="color: #333; margin-top: 0;">${alertMessages[alertType]}</h2>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Product:</strong> ${productName}</p>
              <p><strong>Current Stock:</strong> ${currentStock} units</p>
              <p><strong>Threshold:</strong> ${threshold} units</p>
              <p><strong>Alert Type:</strong> ${alertType.replace('_', ' ').toUpperCase()}</p>
            </div>

            ${supplier ? `
              <h3>Supplier Information:</h3>
              <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>Supplier:</strong> ${supplier}</p>
                ${supplierContact ? `<p><strong>Contact:</strong> ${supplierContact}</p>` : ''}
              </div>
            ` : ''}

            <div style="margin: 20px 0;">
              <a href="${process.env.FRONTEND_URL}/admin/inventory" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                View Inventory Dashboard
              </a>
            </div>

            <p><strong>Action Required:</strong> Please restock this item as soon as possible to avoid disruption to sales.</p>
          </div>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordReset(user, resetToken) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request - Big Bonney Ventures',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Password Reset Request</h1>
          <p>Hello ${user.firstName},</p>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          
          <div style="margin: 20px 0;">
            <a href="${resetLink}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </div>
          
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
          
          <p>Best regards,<br>The Big Bonney Team</p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();