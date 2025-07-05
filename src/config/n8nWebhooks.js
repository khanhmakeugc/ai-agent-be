/**
 * N8N Webhook URLs Configuration
 * 
 * This file contains all the n8n webhook URLs used throughout the application.
 * Update these URLs when n8n workflows change or are moved.
 */

export const N8N_WEBHOOKS = {
    // Facebook Ads Recreation
    FACEBOOK_ADS_RECREATOR: "https://pdog.app.n8n.cloud/webhook/c77f11e4-8111-44e9-af8c-704741c75a47",
    
    // Brief Management
    HANDLE_CREATE_BRIEF: "https://pdog.app.n8n.cloud/webhook/e8ac4753-bfb2-424e-b80f-4bca195fb79e",
    GENERATE_BRIEF: "https://pdog.app.n8n.cloud/webhook/09442549-54ca-4815-a2a4-fbdb684ee8ab",
    
    // Cross Platform Generation
    CROSS_PLATFORM_META_TO_TIKTOK: "https://pdog.app.n8n.cloud/webhook/1d9f5cb6-7d6f-4919-90dd-aec406c6a24e",
    CROSS_PLATFORM_TIKTOK_TO_META: "https://pdog.app.n8n.cloud/webhook/f54b1f26-a7ff-4509-8f2d-621c72a0a007",
    
    // Video Processing
    HOOK_RECREATOR: "https://pdog.app.n8n.cloud/webhook/61391805-edbc-4f68-98ae-5d127977bae4",
    LANGUAGE_TRANSLATION: "https://pdog.app.n8n.cloud/webhook/ff839c4a-f848-4e3b-94a9-1b6679cf12ff",
    
    // Platform Specific
    TIKTOK_ADS_RECREATOR: "https://pdog.app.n8n.cloud/webhook/c7eb5200-e47b-48b8-af1d-0c1e81bec831",
    UPLOAD_MEDIA_MODAL: "https://pdog.app.n8n.cloud/webhook/5abf52a2-e668-4644-9b79-d93dc9930fd7",
    
    // Content Generation
    CONCAT_DESCRIPTIONS: "https://pdog.app.n8n.cloud/webhook/6a9d6caa-e378-4f5b-a806-3e022f3adc3a",
    GENERATE_DESCRIPTIONS: "https://pdog.app.n8n.cloud/webhook/19bbb7d3-3739-4421-bc18-c318e4b2e389"
};

/**
 * Get webhook URL by key
 * @param {string} key - The webhook key
 * @returns {string} The webhook URL
 */
export function getWebhookUrl(key) {
    if (!N8N_WEBHOOKS[key]) {
        throw new Error(`Webhook key '${key}' not found in configuration`);
    }
    return N8N_WEBHOOKS[key];
}

/**
 * Get all webhook URLs
 * @returns {Object} All webhook URLs
 */
export function getAllWebhookUrls() {
    return { ...N8N_WEBHOOKS };
}

export default N8N_WEBHOOKS; 