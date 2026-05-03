/**
 * Postmark Email Service
 * Handles email sending via Postmark API
 */

const axios = require('axios');
const keys = require('../config/keys');

const POSTMARK_API_URL = 'https://api.postmarkapp.com/email';
const POSTMARK_TEST_TOKEN = 'POSTMARK_API_TEST';

class PostmarkService {
  constructor() {
    this.apiToken = keys.postmark.apiToken || POSTMARK_TEST_TOKEN;
    this.fromEmail = keys.postmark.fromEmail;
    this.fromName = keys.postmark.fromName;
    this.isTestMode = this.apiToken === POSTMARK_TEST_TOKEN;
  }

  /**
   * Sends an email using Postmark API
   * @param {object} emailData - Email configuration
   * @param {string} emailData.to - Recipient email address
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.textBody - Plain text body
   * @param {string} emailData.htmlBody - HTML body
   * @param {string} emailData.from - Optional sender email (defaults to config)
   * @param {string} emailData.fromName - Optional sender name
   * @returns {Promise} - API response
   */
  async sendEmail(emailData) {
    try {
      const {
        to,
        subject,
        textBody,
        htmlBody,
        from = this.fromEmail,
        fromName = this.fromName,
      } = emailData;

      // Validate required fields
      if (!to || !subject) {
        throw new Error('Email recipient (to) and subject are required');
      }

      if (!textBody && !htmlBody) {
        throw new Error('Email must have either textBody or htmlBody');
      }

      // Format sender
      const fromAddress = fromName ? `${fromName} <${from}>` : from;

      // Prepare request body
      const postData = {
        From: fromAddress,
        To: to,
        Subject: subject,
        MessageStream: 'outbound',
      };

      // Add body content
      if (textBody) {
        postData.TextBody = textBody;
      }
      if (htmlBody) {
        postData.HtmlBody = htmlBody;
      }

      // Make API request
      const response = await axios.post(POSTMARK_API_URL, postData, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.apiToken,
        },
      });

      console.log(`[Postmark] Email sent to ${to} (Message ID: ${response.data.MessageID})`);

      return {
        success: true,
        messageId: response.data.MessageID,
        data: response.data,
      };
    } catch (error) {
      console.error('[Postmark Error]', error.response?.data || error.message);

      // Handle specific Postmark errors
      if (error.response?.status === 401) {
        throw new Error('Postmark API: Invalid server token');
      }
      if (error.response?.status === 422) {
        throw new Error(`Postmark API: ${error.response.data.Message || 'Invalid email data'}`);
      }
      if (error.response?.status === 429) {
        throw new Error('Postmark API: Too many requests - rate limited');
      }

      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Sends password reset email
   * @param {object} params - Reset email parameters
   * @param {string} params.email - User email
   * @param {string} params.resetLink - Reset password link
   * @param {string} params.userName - User's name (optional)
   * @returns {Promise} - API response
   */
  async sendPasswordResetEmail(params) {
    const { email, resetLink, userName = 'User' } = params;

    const subject = 'Password Reset Request';

    const textBody = `
Hello ${userName},

We received a request to reset your password. Click the link below to create a new password:

${resetLink}

This link will expire in 30 minutes.

If you didn't request a password reset, please ignore this email. Your account remains secure.

Best regards,
The ${this.fromName} Team
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
      .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
      .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold; }
      .footer { color: #64748b; font-size: 12px; text-align: center; margin-top: 20px; }
      .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Password Reset Request</h2>
      </div>
      <div class="content">
        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        
        <center>
          <a href="${resetLink}" class="button">Reset Your Password</a>
        </center>
        
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
          ${resetLink}
        </p>
        
        <div class="warning">
          <strong>Important:</strong> This link will expire in 30 minutes for security reasons.
        </div>
        
        <p>If you didn't request a password reset, please ignore this email. Your account remains secure.</p>
        
        <p>Best regards,<br><strong>The ${this.fromName} Team</strong></p>
      </div>
      
      <div class="footer">
        <p>© 2026 ${this.fromName}. All rights reserved.</p>
        <p>This is an automated email. Please do not reply directly to this message.</p>
      </div>
    </div>
  </body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject,
      textBody,
      htmlBody,
    });
  }

  /**
   * Sends password reset success confirmation email
   * @param {object} params - Confirmation email parameters
   * @param {string} params.email - User email
   * @param {string} params.userName - User's name (optional)
   * @returns {Promise} - API response
   */
  async sendPasswordResetSuccessEmail(params) {
    const { email, userName = 'User' } = params;

    const subject = 'Password Changed Successfully';

    const textBody = `
Hello ${userName},

Your password has been successfully changed. If you did not make this change, please contact our support team immediately.

Best regards,
The ${this.fromName} Team
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
      .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
      .success-icon { font-size: 48px; text-align: center; }
      .footer { color: #64748b; font-size: 12px; text-align: center; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="success-icon">✓</div>
        <h2>Password Changed Successfully</h2>
      </div>
      <div class="content">
        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>Your password has been successfully changed.</p>
        
        <p>If you did not make this change or did not request a password reset, please contact our support team immediately.</p>
        
        <p>Best regards,<br><strong>The ${this.fromName} Team</strong></p>
      </div>
      
      <div class="footer">
        <p>© 2026 ${this.fromName}. All rights reserved.</p>
        <p>This is an automated email. Please do not reply directly to this message.</p>
      </div>
    </div>
  </body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject,
      textBody,
      htmlBody,
    });
  }

  /**
   * Check if service is in test mode
   */
  isTestMode() {
    return this.isTestMode;
  }
}

module.exports = new PostmarkService();
