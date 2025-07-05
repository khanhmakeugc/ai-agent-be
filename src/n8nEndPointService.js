import express from 'express';
import dotenv from 'dotenv';
import FormData from 'form-data';
import logger from './logger.js';
import { asyncHandler, ValidationError } from './errorHandler.js';
import { logMeta } from './logger.js';
import { N8N_WEBHOOKS } from './config/n8nWebhooks.js';

dotenv.config();

const n8nRouter = express.Router();

/**
 * POST /api/n8n/facebook-ads-recreator
 * Sends video and brand data to n8n webhook for Facebook ads recreation
 */
n8nRouter.post('/facebook-ads-recreator', asyncHandler(async (req, res) => {
    // Check if request body exists
    logger.info('N8N Facebook Ads Recreator Request Received', {
        hasBody: !!req.body,
        contentType: req.get('Content-Type'),
        bodyKeys: req.body ? Object.keys(req.body) : [],
        body: req.body
    });

    if (!req.body) {
        throw new ValidationError('Request body is missing');
    }
    
    // Handle both JSON and multipart/form-data
    let video, videoUrl, brandUrl, email, metaLink;
    
    if (req.get('Content-Type')?.includes('multipart/form-data')) {
        // Handle multipart/form-data
        video = req.body.video;
        videoUrl = req.body.videoUrl;
        brandUrl = req.body.brandUrl;
        email = req.body.email;
        metaLink = req.body.metaLink;
        
        logger.info('Processing multipart/form-data request', {
            hasVideo: !!video,
            hasVideoUrl: !!videoUrl,
            brandUrl,
            email,
            metaLink
        });
    } else {
        // Handle JSON
        ({ video, videoUrl, brandUrl, email, metaLink } = req.body);
        
        logger.info('Processing JSON request', {
            hasVideo: !!video,
            hasVideoUrl: !!videoUrl,
            brandUrl,
            email,
            metaLink
        });
    }
    
    // Log the incoming request for debugging
    logger.info('N8N Facebook Ads Recreator Request Received', {
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        contentType: req.get('Content-Type'),
    });
    
    // Validate required fields
    // Handle "null" string from form data
    if (!video || video === 'null') {
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
            N8N_WEBHOOKS.FACEBOOK_ADS_RECREATOR,
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
        N8N_WEBHOOKS.HANDLE_CREATE_BRIEF,
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
    N8N_WEBHOOKS.GENERATE_BRIEF,
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
 * POST /api/n8n/cross-platform-generation
 * Generates content for cross-platform advertising (Meta to TikTok or TikTok to Meta)
 */
n8nRouter.post('/cross-platform-generation', asyncHandler(async (req, res) => {
    // Check if request body exists
    if (!req.body) {
        throw new ValidationError('Request body is missing');
    }
    
    const { mode, video, brandUrl, email, adUrl } = req.body;
    
    // Validate required fields
    if (!mode) {
        throw new ValidationError('Missing required field: mode');
    }
    
    if (!video) {
        throw new ValidationError('Missing required field: video');
    }
    
    if (!brandUrl) {
        throw new ValidationError('Missing required field: brandUrl');
    }
    
    if (!email) {
        throw new ValidationError('Missing required field: email');
    }
    
    // if (!adUrl) {
    //     throw new ValidationError('Missing required field: adUrl');
    // }
    
    // Validate mode
    if (!['metaToTikTok', 'tiktokToMeta'].includes(mode)) {
        throw new ValidationError('Invalid mode. Must be "metaToTikTok" or "tiktokToMeta"');
    }
    
    logger.info('N8N Cross Platform Generation Request', {
        mode,
        hasVideo: !!video,
        brandUrl,
        email,
        adUrl,
    });

    try {
        const formData = new FormData();
        formData.append("video", video);
        formData.append("brandUrl", brandUrl);
        formData.append("email", email);

        if (adUrl) {
            formData.append("adUrl", adUrl);
        }

        const url = mode === "metaToTikTok"
            ? N8N_WEBHOOKS.CROSS_PLATFORM_META_TO_TIKTOK
            : N8N_WEBHOOKS.CROSS_PLATFORM_TIKTOK_TO_META;

        logger.info('Sending to N8N webhook', {
            mode,
            url,
            hasVideo: !!video,
            brandUrl,
            email
        });

        const response = await fetch(url, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('N8N Cross Platform Generation Error', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                mode,
                url,
            });
            throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        logger.info('N8N Cross Platform Generation Success', {
            status: response.status,
            mode,
            hasResult: !!result,
        });

        res.json({
            success: true,
            message: 'Cross Platform Generation successfully',
            data: result,
        });

    } catch (error) {
        logger.error('N8N Cross Platform Generation Error', {
            error: error.message,
            mode,
            brandUrl,
            email,
        });
        throw error;
    }
}));




/**
 * POST /api/n8n/hook-recreator
 * Recreates video hooks via n8n webhook
 */
n8nRouter.post('/hook-recreator', asyncHandler(async (req, res) => {
    // Check if request body exists
    if (!req.body) {
        throw new ValidationError('Request body is missing');
    }
    
    const { video } = req.body;
    
    // Validate required fields
    if (!video) {
        throw new ValidationError('Missing required field: video');
    }
    
    logger.info('N8N Hook Recreator Request', {
        hasVideo: !!video,
    });

    try {
        const formData = new FormData();
        formData.append("video", video);

        logger.info('Sending to N8N webhook', {
            url: N8N_WEBHOOKS.HOOK_RECREATOR,
            hasVideo: !!video,
        });

        const response = await fetch(
            N8N_WEBHOOKS.HOOK_RECREATOR,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('N8N Hook Recreator Error', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });
            throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        logger.info('N8N Hook Recreator Success', {
            status: response.status,
            hasResult: !!result,
        });

        res.json({
            success: true,
            message: 'Hook Recreator successfully',
            data: result,
        });

    } catch (error) {
        logger.error('N8N Hook Recreator Error', {
            error: error.message,
        });
        throw error;
    }
}));



/**
 * POST /api/n8n/language-translation
 * Translates video to different languages via n8n webhook
 */
n8nRouter.post('/language-translation', asyncHandler(async (req, res) => {
    // Check if request body exists
    if (!req.body) {
        throw new ValidationError('Request body is missing');
    }   
    
    const { video, languages } = req.body;

    if (!languages) {
        throw new ValidationError('Missing required field: languages');
    }

    // Validate required fields
    if (!video) {
        throw new ValidationError('Missing required field: video');
    }
    
    logger.info('N8N Language Translation Request', {
        hasVideo: !!video,
        languages,
    });

    try {
        const formData = new FormData();
        formData.append("video", video);
        formData.append("languages", languages);

        logger.info('Sending to N8N webhook', {
            url: N8N_WEBHOOKS.LANGUAGE_TRANSLATION,
            hasVideo: !!video,
            languages,
        });

        const response = await fetch(
          N8N_WEBHOOKS.LANGUAGE_TRANSLATION,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('N8N Language Translation Error', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });
            throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        logger.info('N8N Language Translation Success', {
            status: response.status,
            hasResult: !!result,
        });

        res.json({
            success: true,
            message: 'Language Translation successfully',
            data: result,
        });

    } catch (error) {
        logger.error('N8N Language Translation Error', {
            error: error.message,
        });
        throw error;
    }
}));


/**
 * POST /api/n8n/tiktokads-recreator
 * Recreates TikTok ads via n8n webhook
 */
n8nRouter.post('/tiktokads-recreator', asyncHandler(async (req, res) => {
    // Check if request body exists
    if (!req.body) {
        throw new ValidationError('Request body is missing');
    }   

    const { video, brandUrl, tiktokLink } = req.body;

    // Validate required fields
    if (!video) {
        throw new ValidationError('Missing required field: video');
    }

    if (!brandUrl) {
        throw new ValidationError('Missing required field: brandUrl');
    }

    if (!tiktokLink) {
        throw new ValidationError('Missing required field: tiktokLink');
    }

    logger.info('N8N TikTok Ads Recreator Request', {
        hasVideo: !!video,
        brandUrl,
        tiktokLink,
    });

    try {

        const formData = new FormData();
        formData.append("video", video);
        formData.append("brandUrl", brandUrl);
        formData.append("tiktokLink", tiktokLink || "uploaded");

        const response = await fetch(
            N8N_WEBHOOKS.TIKTOK_ADS_RECREATOR,
            {
            method: "POST",
            body: formData,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('N8N TikTok Ads Recreator Error', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });
            throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        logger.info('N8N TikTok Ads Recreator Success', {
            status: response.status,
            hasResult: !!result,
        });

        res.json({
            success: true,
            message: 'TikTok Ads Recreator successfully',
            data: result,
        });

    } catch (error) {
        logger.error('N8N TikTok Ads Recreator Error', {
            error: error.message,
        });
        throw error;
    }
}));


/**
 * POST /api/n8n/upload-media-modal
 * Uploads media files to Meta advertising platform via n8n webhook
 */
n8nRouter.post('/upload-media-modal', asyncHandler(async (req, res) => {
    // Check if request body exists
    if (!req.body) {
        throw new ValidationError('Request body is missing');
    }
    
    const { file, name, type, accessToken, optimize, primaryText, page_id, adAccount, adset_id, media_id } = req.body;

    // Validate required fields
    if (!file) {
        throw new ValidationError('Missing required field: file');
    }
    
    if (!name) {
        throw new ValidationError('Missing required field: name');
    }
    
    if (!type) {
        throw new ValidationError('Missing required field: type');
    }
    
    if (!accessToken) {
        throw new ValidationError('Missing required field: accessToken');
    }
    
    if (!page_id) {
        throw new ValidationError('Missing required field: page_id');
    }
    
    if (!adAccount) {
        throw new ValidationError('Missing required field: adAccount');
    }
    
    logger.info('N8N Upload Media Modal Request', {
        fileName: name,
        fileType: type,
        hasPageId: !!page_id,
        hasAdAccount: !!adAccount,
        hasAdsetId: !!adset_id,
        hasMediaId: !!media_id,
    });

    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);
        formData.append("type", type);
        formData.append("accessToken", accessToken);
        formData.append("optimize", optimize);
        formData.append("primaryText", primaryText || "");
        formData.append("page_id", page_id);
        formData.append("adAccount", adAccount);

        if (adset_id) {
            formData.append("adset_id", adset_id);
        }

        if (media_id) {
            formData.append("media_id", media_id);
        }

        logger.info('Sending to N8N webhook', {
            url: N8N_WEBHOOKS.UPLOAD_MEDIA_MODAL,
            fileName: name,
            fileType: type,
            hasAdset_id: !!adset_id,
            hasMedia_id: !!media_id,
        });

        const response = await fetch(
            N8N_WEBHOOKS.UPLOAD_MEDIA_MODAL,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('N8N Upload Media Modal Error', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                fileName: name,
            });
            throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        logger.info('N8N Upload Media Modal Success', {
            status: response.status,
            fileName: name,
            hasResult: !!result,
        });
        
        res.json({
            success: true,
            message: 'Upload Media Modal successfully',
            data: result,
        });

    } catch (error) {
        logger.error('N8N Upload Media Modal Error', {
            error: error.message,
            fileName: name,
        });
        throw error;
    }
}));





/**
 * POST /api/n8n/concat-descriptions
 * Concatenates descriptions via n8n webhook
 */
n8nRouter.post('/concat-descriptions', asyncHandler(async (req, res) => {
    // Check if request body exists
    if (!req.body) {
        throw new ValidationError('Request body is missing');
    }
    
    const { concatenatedText, originalTranscript } = req.body;
    
    logger.info('N8N Concat Descriptions Request', {
        concatenatedText,
        originalTranscript,
    });

    try {
        logger.info('Sending to N8N webhook', {
            url: N8N_WEBHOOKS.CONCAT_DESCRIPTIONS,
            concatenatedText,
            originalTranscript,
        });


        const response = await fetch(
        N8N_WEBHOOKS.CONCAT_DESCRIPTIONS,
        {
            method: "POST",
            body: JSON.stringify({ text: concatenatedText, originalTranscript: originalTranscript }),
        }
        );
        

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('N8N Concat Descriptions Error', {
                status: response.status,
                statusText: response.statusText,
                error: errorText, 
            });
            throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        logger.info('N8N Concat Descriptions Success', {
            status: response.status,
            hasResult: !!result,
        });
        
        res.json({
            success: true,
            message: 'Concat Descriptions successfully',
            data: result,
        });

    } catch (error) {
        logger.error('N8N Concat Descriptions Error', {
            error: error.message,
            concatenatedText,
            originalTranscript,
        });
        throw error;
    }
}));




/**
 * POST /api/n8n/generate-descriptions
 * Generates descriptions via n8n webhook
 */
n8nRouter.post('/generate-descriptions', asyncHandler(async (req, res) => {
    // Check if request body exists
    if (!req.body) {
        throw new ValidationError('Request body is missing');
    }
    
    const { blob } = req.body;
    
    // Validate required fields
    if (!blob) {
        throw new ValidationError('Missing required field: blob');
    }
    
    logger.info('N8N Generate Descriptions Request', {
        hasBlob: !!blob,
    });

    try {
        logger.info('Sending to N8N webhook', {
            url: N8N_WEBHOOKS.GENERATE_DESCRIPTIONS,
            hasBlob: !!blob,
        });
        
        const formData = new FormData();
        formData.append("image", blob, `screenshot-${Date.now()}.jpg`);

        const response = await fetch(
            N8N_WEBHOOKS.GENERATE_DESCRIPTIONS,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('N8N Generate Descriptions Error', {
                status: response.status,
                statusText: response.statusText,
                error: errorText, 
            });
            throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        logger.info('N8N Generate Descriptions Success', {
            status: response.status,
            hasResult: !!result,
        });
        
        res.json({
            success: true,
            message: 'Generate Descriptions successfully',
            data: result,
        });

    } catch (error) {
        logger.error('N8N Generate Descriptions Error', {
            error: error.message,
            hasBlob: !!blob,
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
            'POST /facebook-ads-recreator',
            'POST /handle-create-brief',
            'POST /generate-brief',
            'POST /cross-platform-generation',
            'POST /hook-recreator',
            'POST /language-translation',
            'POST /tiktokads-recreator',
            'POST /upload-media-modal',
            'POST /concat-descriptions',
            'POST /generate-descriptions'
        ]
    });
}));






export default n8nRouter; 


