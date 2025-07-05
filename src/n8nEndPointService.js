import express from 'express';
import dotenv from 'dotenv';
import FormData from 'form-data';
import logger from './logger.js';
import { asyncHandler, ValidationError } from './errorHandler.js';

dotenv.config();

const n8nRouter = express.Router();

/**
 * POST /api/n8n/facebook-ads-recreator
 * Sends video and brand data to n8n webhook for Facebook ads recreation
 */
n8nRouter.post('/facebook-ads-recreator', asyncHandler(async (req, res) => {
    const { video, brandUrl, email, metaLink } = req.body;
    
    // Validate required fields
    if (!video) {
        throw new ValidationError('Missing required field: video');
    }
    
    if (!brandUrl) {
        throw new ValidationError('Missing required field: brandUrl');
    }
    
    if (!email) {
        throw new ValidationError('Missing required field: email');
    }
    
    logger.info('N8N Facebook Ads Recreator Request', {
        hasVideo: !!video,
        brandUrl,
        email,
        metaLink: metaLink || 'uploaded',
    });

    try {
        const formData = new FormData();
        formData.append("video", video);
        formData.append("brandUrl", brandUrl);
        formData.append("email", email);
        formData.append("metaLink", metaLink || "uploaded");

        const n8nResponse = await fetch(
            "https://pdog.app.n8n.cloud/webhook/c77f11e4-8111-44e9-af8c-704741c75a47",
            {
                method: "POST",
                body: formData,
            }
        );

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            logger.error('N8N Webhook Error', {
                status: n8nResponse.status,
                statusText: n8nResponse.statusText,
                error: errorText,
            });
            throw new Error(`N8N webhook failed: ${n8nResponse.status} ${n8nResponse.statusText}`);
        }

        const responseData = await n8nResponse.json();
        
        logger.info('N8N Facebook Ads Recreator Success', {
            status: n8nResponse.status,
            responseData,
        });

        res.json({
            success: true,
            message: 'Facebook ads recreation request sent successfully',
            data: responseData,
        });

    } catch (error) {
        logger.error('N8N Facebook Ads Recreator Error', {
            error: error.message,
            brandUrl,
            email,
        });
        throw error;
    }
}));

/**
 * GET /api/n8n/health
 * Health check for n8n service
 */
n8nRouter.get('/health', asyncHandler(async (req, res) => {
    logger.info('N8N Health Check Request');
    
    res.json({
        status: 'healthy',
        service: 'n8n',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST /facebook-ads-recreator'
        ]
    });
}));

export default n8nRouter; 


