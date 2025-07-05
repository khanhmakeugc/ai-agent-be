import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';
import logger, { logEmail } from './logger.js';
import { asyncHandler, ValidationError, AuthenticationError } from './errorHandler.js';

dotenv.config();

const emailRouter = express.Router();

// Email configuration
const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
};

// Create transporter
const createTransporter = () => {
    return nodemailer.createTransporter(emailConfig);
};

// Email templates
const emailTemplates = {
    welcome: (userName) => ({
        subject: 'Welcome to Our Platform!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Welcome ${userName}!</h2>
                <p>Thank you for joining our platform. We're excited to have you on board!</p>
                <p>If you have any questions, feel free to reach out to our support team.</p>
                <br>
                <p>Best regards,<br>The Team</p>
            </div>
        `
    }),
    
    passwordReset: (resetLink) => ({
        subject: 'Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Password Reset</h2>
                <p>You requested a password reset. Click the link below to reset your password:</p>
                <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                <p>If you didn't request this, please ignore this email.</p>
                <br>
                <p>Best regards,<br>The Team</p>
            </div>
        `
    }),
    
    notification: (title, message) => ({
        subject: title,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${title}</h2>
                <p>${message}</p>
                <br>
                <p>Best regards,<br>The Team</p>
            </div>
        `
    }),
    
    custom: (subject, htmlContent) => ({
        subject,
        html: htmlContent
    })
};

/**
 * POST /api/email/send
 * Send a simple email
 */
emailRouter.post('/send', asyncHandler(async (req, res) => {
    const { to, subject, text, html, from } = req.body;
    
    if (!to || !subject || (!text && !html)) {
        throw new ValidationError('Missing required fields: to, subject, and either text or html');
    }
    
    logger.info('Email Send Request', {
        to,
        subject,
        hasText: !!text,
        hasHtml: !!html,
        from: from || 'default',
    });
    
    const transporter = createTransporter();
    
    const mailOptions = {
        from: from || process.env.EMAIL_USER,
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        text,
        html
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    logEmail.send({ to, subject, template: 'custom' }, info);
    
    res.json({
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully'
    });
}));

/**
 * POST /api/email/send-template
 * Send email using predefined templates
 */
emailRouter.post('/send-template', asyncHandler(async (req, res) => {
    const { to, template, templateData, from } = req.body;
    
    if (!to || !template) {
        throw new ValidationError('Missing required fields: to and template');
    }
    
    if (!emailTemplates[template]) {
        throw new ValidationError('Invalid template. Available templates: welcome, passwordReset, notification, custom');
    }
    
    logger.info('Email Template Request', {
        to,
        template,
        templateData,
        from: from || 'default',
    });
    
    const transporter = createTransporter();
    const templateConfig = emailTemplates[template];
    
    let subject, html;
    
    switch (template) {
        case 'welcome':
            subject = templateConfig.subject;
            html = templateConfig.html(templateData.userName);
            break;
            
        case 'passwordReset':
            subject = templateConfig.subject;
            html = templateConfig.html(templateData.resetLink);
            break;
            
        case 'notification':
            subject = templateConfig.subject(templateData.title);
            html = templateConfig.html(templateData.title, templateData.message);
            break;
            
        case 'custom':
            subject = templateData.subject;
            html = templateData.html;
            break;
            
        default:
            throw new ValidationError('Invalid template');
    }
    
    const mailOptions = {
        from: from || process.env.EMAIL_USER,
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        html
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    logEmail.send({ to, subject, template }, info);
    
    res.json({
        success: true,
        messageId: info.messageId,
        message: 'Template email sent successfully'
    });
}));

/**
 * POST /api/email/send-bulk
 * Send emails to multiple recipients
 */
emailRouter.post('/send-bulk', asyncHandler(async (req, res) => {
    const { recipients, subject, text, html, from } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        throw new ValidationError('Recipients must be a non-empty array');
    }
    
    if (!subject || (!text && !html)) {
        throw new ValidationError('Missing required fields: subject and either text or html');
    }
    
    logger.info('Bulk Email Request', {
        recipientCount: recipients.length,
        subject,
        hasText: !!text,
        hasHtml: !!html,
        from: from || 'default',
    });
    
    const transporter = createTransporter();
    const results = [];
    const errors = [];
    
    for (const recipient of recipients) {
        try {
            const mailOptions = {
                from: from || process.env.EMAIL_USER,
                to: recipient.email,
                subject: recipient.subject || subject,
                text: recipient.text || text,
                html: recipient.html || html
            };
            
            const info = await transporter.sendMail(mailOptions);
            results.push({
                email: recipient.email,
                messageId: info.messageId,
                status: 'sent'
            });
            
        } catch (error) {
            logger.error('Bulk Email Individual Error', {
                email: recipient.email,
                error: error.message,
            });
            
            errors.push({
                email: recipient.email,
                error: error.message
            });
        }
    }
    
    const response = {
        success: true,
        sent: results.length,
        failed: errors.length,
        results,
        errors
    };
    
    logEmail.bulk(recipients, response);
    
    res.json(response);
}));

/**
 * POST /api/email/verify
 * Verify email configuration
 */
emailRouter.post('/verify', asyncHandler(async (req, res) => {
    logger.info('Email Verification Request');
    
    const transporter = createTransporter();
    await transporter.verify();
    
    logger.info('Email Configuration Verified');
    
    res.json({
        success: true,
        message: 'Email configuration is valid'
    });
}));

/**
 * GET /api/email/templates
 * Get available email templates
 */
emailRouter.get('/templates', asyncHandler(async (req, res) => {
    logger.info('Email Templates Request');
    
    const templates = Object.keys(emailTemplates).map(template => ({
        name: template,
        description: getTemplateDescription(template)
    }));
    
    logger.info('Email Templates Retrieved', { count: templates.length });
    
    res.json({
        templates,
        count: templates.length
    });
}));

/**
 * POST /api/email/create-template
 * Create a custom email template
 */
emailRouter.post('/create-template', asyncHandler(async (req, res) => {
    const { name, subject, html } = req.body;
    
    if (!name || !subject || !html) {
        throw new ValidationError('Missing required fields: name, subject, and html');
    }
    
    if (emailTemplates[name]) {
        throw new ValidationError('Template already exists');
    }
    
    logger.info('Create Email Template', { name, subject });
    
    emailTemplates[name] = {
        subject,
        html: () => html
    };
    
    logger.info('Email Template Created', { name });
    
    res.json({
        success: true,
        message: `Template '${name}' created successfully`
    });
}));

/**
 * GET /api/email/health
 * Health check for email service
 */
emailRouter.get('/health', asyncHandler(async (req, res) => {
    logger.info('Email Health Check Request');
    
    const transporter = createTransporter();
    await transporter.verify();
    
    const healthData = {
        status: 'healthy',
        service: 'email',
        timestamp: new Date().toISOString(),
        config: {
            host: emailConfig.host,
            port: emailConfig.port,
            secure: emailConfig.secure
        }
    };
    
    logger.info('Email Health Check', healthData);
    
    res.json(healthData);
}));

// Helper function to get template descriptions
function getTemplateDescription(template) {
    const descriptions = {
        welcome: 'Welcome email for new users',
        passwordReset: 'Password reset email with reset link',
        notification: 'General notification email',
        custom: 'Custom email template'
    };
    
    return descriptions[template] || 'Custom template';
}

export default emailRouter; 