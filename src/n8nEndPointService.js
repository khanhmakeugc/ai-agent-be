import express from 'express';
import dotenv from 'dotenv';
import FormData from 'form-data';
import logger from './logger.js';
import { asyncHandler, ValidationError } from './errorHandler.js';
import { logMeta } from './logger.js';

dotenv.config();

const n8nRouter = express.Router();

/**
 * POST /api/n8n/facebook-ads-recreator
 * Sends video and brand data to n8n webhook for Facebook ads recreation
 */
n8nRouter.post('/facebook-ads-recreator', asyncHandler(async (req, res) => {
    const { video, videoUrl, brandUrl, email, metaLink } = req.body;
    
    // Validate required fields
    if (!video) {

        if (!videoUrl) {
            throw new ValidationError('Missing required field: videoUrl or Video');
        }

        logger.info('N8N Facebook Ads Recreator Request', {
            hasVideo: "No video provided -> check videoUrl",
            videoUrl,
            brandUrl,
            email,
            metaLink: metaLink || 'uploaded',
        });
        // throw new ValidationError('Missing required field: video');
    } else {

        logger.info('N8N Facebook Ads Recreator Request', {
            hasVideo: "Has video provided",
            brandUrl,
            email,
            metaLink: metaLink || 'uploaded',
        });
    }
    
    if (!brandUrl) {
        throw new ValidationError('Missing required field: brandUrl');
    }
    
    if (!email) {
        throw new ValidationError('Missing required field: email');
    }
    

    try {
        let base64;
        if (videoUrl) {

            const isMp4 = videoUrl.endsWith('.mp4');

            logger.info('Video URL Found', { videoUrl, isMp4 });

            const downloadRes = await fetch(videoUrl);
            if (!downloadRes.ok) throw new Error('Failed to download video');
            const arrayBuffer = await downloadRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            logMeta.video('scrape', videoUrl, buffer);

            base64 = buffer.toString('base64');
        }
        

        const formData = new FormData();
        formData.append("video", videoUrl ? base64 : video);
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
 * POST /api/n8n/handle-create-brief
 * Handles transcript optimization via n8n webhook
 */
n8nRouter.post('/handle-create-brief', asyncHandler(async (req, res) => {
    const { originalTranscript } = req.body;
    
    const response = await fetch(
        "https://pdog.app.n8n.cloud/webhook/e8ac4753-bfb2-424e-b80f-4bca195fb79e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: originalTranscript }),
        }
    );

    const data = await response.json();

    if (!res.ok || !data.text) {
        throw new Error(data.error || "Failed to optimize transcript");
    }

    res.json({
        success: true,
        message: 'Handle Create Brief successfully',
        data: data,
    });

}));


n8nRouter.post('/generate-brief', asyncHandler(async (req, res) => {
    const { bodyCount, hookCount, originalTranscript, imagesText, optimizedTranscript } = req.body;
    
    const response = await fetch(
    "https://pdog.app.n8n.cloud/webhook/09442549-54ca-4815-a2a4-fbdb684ee8ab",
    {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify({
        bodyCount,
        hookCount,
        originalTranscript,
        imagesText,
        optimizedOriginalTranscript: optimizedTranscript,
        }),
    }
    );
    const result = await response.json();

    res.json({
        success: true,
        message: 'Generate Brief successfully',
        data: result,
    });

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


