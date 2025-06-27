import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import axios from 'axios';
import FormData from 'form-data'
import multer from "multer";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const adUrls = [
    "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&is_targeted_country=false&media_type=video&search_type=page&view_all_page_id=177930899801067", // PetLabCo
    "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&is_targeted_country=false&media_type=video&search_type=page&view_all_page_id=109899597504831", // Javvy
    "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&is_targeted_country=false&media_type=video&search_type=page&view_all_page_id=275270825974823", // Hike
    "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&is_targeted_country=false&media_type=video&search_type=page&view_all_page_id=1573441899601646", // HiSmile
    "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&is_targeted_country=false&media_type=video&search_type=page&view_all_page_id=357167600818818", // David Protein
    "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&is_targeted_country=false&media_type=video&search_type=page&view_all_page_id=108815292124532", // HeyShape
];

const MAX_SIZE_BYTES = 25 * 1024 * 1024;
const adLibraryUrl = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&is_targeted_country=false&media_type=video&search_type=page&view_all_page_id=177930899801067';

app.get('/api/get-user-video', async (req, res) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.goto(adLibraryUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        await page.waitForSelector('video[src]', { timeout: 15000 });
        const videoUrls = await page.$$eval('video[src]', els =>
            els.map(el => el.src).filter(Boolean)
        );

        if (!videoUrls.length) {
            return res.status(404).json({ error: 'No se encontraron videos en la página.' });
        }

        for (const videoUrl of videoUrls) {
            try {
                const response = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 20000,
                });

                const buffer = Buffer.from(response.data);
                if (buffer.length <= MAX_SIZE_BYTES) {
                    res.setHeader('Content-Type', 'video/mp4');
                    res.setHeader('Content-Disposition', 'attachment; filename="user-meta-video.mp4"');
                    return res.send(buffer);
                }
            } catch (err) {
                console.log(`⚠️ Video fallido: ${err.message}`);
                continue;
            }
        }

        res.status(404).json({ error: 'No se encontró un video menor a 25MB.' });

    } catch (err) {
        console.error('❌ Error general:', err.message);
        res.status(500).json({ error: 'Error extracting video', details: err.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/api/get-brand-url', (req, res) => {
    res.json({ brandUrl: 'https://thepetlabco.com/', email: "lautynievas09@gmail.com" });
});

app.get('/api/random-meta-video', async (req, res) => {
    let browser;
    try {
        const randomUrl = adUrls[Math.floor(Math.random() * adUrls.length)];

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.goto(randomUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        await page.waitForSelector('video[src]', { timeout: 15000 });
        const videoUrls = await page.$$eval('video[src]', els =>
            els.map(el => el.src).filter(Boolean)
        );

        if (!videoUrls.length) throw new Error('No videos found');
        const selectedVideoUrl = videoUrls[Math.floor(Math.random() * videoUrls.length)];

        const response = await axios.get(selectedVideoUrl, {
            responseType: 'stream',
        });

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="random-meta-video.mp4"');
        response.data.pipe(res);
    } catch (err) {
        console.error('❌ Error extracting video:', err.message);
        res.status(500).json({ error: 'Failed to extract video', details: err.message });
    } finally {
        if (browser) await browser.close();
    }
});


app.post('/api/get-video', async (req, res) => {
    const { adUrl } = req.body;
    const download = req.query.download === 'true';

    if (!adUrl || (!adUrl.includes('facebook.com/ads/library') && !adUrl.includes('tiktok.com/ads/detail'))) {
        return res.status(400).json({ error: 'Invalid ad URL (must be Meta or TikTok)' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.goto(adUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        await page.waitForSelector('video[src]', { timeout: 15000 });
        const videoUrl = await page.$eval('video', (el) => el.src);
        if (!videoUrl) throw new Error('Video URL not found');

        const isTikTok = adUrl.includes('tiktok.com');
        const isMp4 = videoUrl.endsWith('.mp4');

        const downloadRes = await fetch(videoUrl);
        if (!downloadRes.ok) throw new Error('Failed to download video');
        const arrayBuffer = await downloadRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (download) {
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', 'attachment; filename=ad-video.mp4');
            return res.send(buffer);
        }

        const base64 = buffer.toString('base64');
        res.json({
            platform: isTikTok ? 'tiktok' : 'meta',
            videoUrl,
            base64,
        });

    } catch (err) {
        console.error('Video scraping error:', err.message);
        res.status(500).json({ error: 'Failed to extract video', details: err.message });
    } finally {
        if (browser) await browser.close();
    }
});

// GET /api/meta/campaigns
app.get("/api/meta/campaigns", async (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];

    if (!accessToken) return res.status(401).json({ error: "Missing token" });


    try {
        // Obtener cuenta de anuncios del usuario
        const adAccountsRes = await fetch(
            `https://graph.facebook.com/v23.0/me/adaccounts?access_token=${accessToken}`
        );
        const adAccountsData = await adAccountsRes.json();
        console.log(adAccountsData);
        const accountId = adAccountsData.data?.[0]?.id;

        if (!accountId) return res.status(400).json({ error: "No ad account found" });

        // Obtener campañas activas
        const campaignsRes = await fetch(
            `https://graph.facebook.com/v23.0/${accountId}/campaigns?access_token=${accessToken}&fields=id,name,status`
        );
        const campaignsData = await campaignsRes.json();
        res.json(campaignsData.data);
    } catch (err) {
        res.status(500).json({ error: "Error fetching campaigns", details: err });
    }
});


const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/meta/upload", upload.array("files"), async (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];

    if (!accessToken) return res.status(401).json({ error: "Missing token" });

    const { campaignId, optimizeText, primaryText } = req.body;
    const files = req.files;

    try {
        // 1. Subir imágenes o videos a Meta
        const uploadedMedia = await Promise.all(
            files.map(async (file) => {
                const uploadUrl = file.mimetype.startsWith("video/")
                    ? `https://graph-video.facebook.com/v23.0/me/advideos`
                    : `https://graph.facebook.com/v23.0/me/adimages`;

                const form = new FormData();
                form.append("access_token", accessToken);
                form.append("source", file.buffer, file.originalname);

                const res = await fetch(uploadUrl, {
                    method: "POST",
                    body: form,
                });
                const result = await res.json();
                return result;
            })
        );

        // 2. (opcional) Llamar IA para generar nuevo texto
        let finalText = primaryText;
        if (optimizeText === "true" && primaryText) {
            const prompt = `Mejorá este texto para un anuncio atractivo: ${primaryText}`;
            const aiRes = await fetch("https://api.anthropic.com/v1/complete", {
                method: "POST",
                headers: {
                    "x-api-key": process.env.ANTHROPIC_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "claude-3-opus-20240229",
                    prompt,
                    max_tokens: 300,
                }),
            });
            const aiJson = await aiRes.json();
            finalText = aiJson.completion.trim();
        }

        // 3. Crear ad creatives con texto + imagen/video
        for (const media of uploadedMedia) {
            const creativeRes = await fetch(
                `https://graph.facebook.com/v23.0/act_${campaignId}/adcreatives?access_token=${accessToken}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "Generated Creative",
                        object_story_spec: {
                            page_id: "TU_PAGE_ID",
                            link_data: {
                                message: finalText,
                                image_hash: media.hash || undefined,
                                video_id: media.id || undefined,
                                link: "https://tusitio.com",
                            },
                        },
                    }),
                }
            );
            const creative = await creativeRes.json();

            // 4. Crear el anuncio
            await fetch(`https://graph.facebook.com/v23.0/act_${campaignId}/ads?access_token=${accessToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Generated Ad",
                    adset_id: "ADSET_ID", // opcional
                    creative: { creative_id: creative.id },
                    status: "PAUSED",
                }),
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload error", details: err });
    }
});

app.get("/api/meta/pages", async (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];

    if (!accessToken) return res.status(401).json({ error: "Missing token" });

    try {
        const result = await fetch(
            `https://graph.facebook.com/v23.0/me/accounts?access_token=${accessToken}`
        );
        const json = await result.json();
        res.json(json.data); // cada item tiene id, name, access_token
    } catch (err) {
        res.status(500).json({ error: "Error fetching pages", details: err });
    }
});

app.get("/api/meta/adsets/:campaignId", async (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];
    const { campaignId } = req.params;

    if (!accessToken) {
        return res.status(401).json({ error: "Missing token" });
    }

    try {
        const result = await fetch(
            `https://graph.facebook.com/v23.0/${campaignId}/adsets?access_token=${accessToken}&fields=id,name,status`
        );
        const json = await result.json();

        if (!result.ok) {
            return res.status(500).json({ error: json.error || "Unknown error" });
        }

        res.json(json.data || []);
    } catch (err) {
        res.status(500).json({ error: "Error fetching adsets", details: err });
    }
});


app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    const redirectUri = "http://localhost:3000/auth/callback"; // URL de este mismo endpoint
    const frontendUri = "http://localhost:5173/meta-auth-success"; // donde redirigir después de auth
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    try {
        // Intercambiar el code por el token
        const tokenRes = await fetch(
            `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
                redirectUri
            )}&client_secret=${appSecret}&code=${code}`
        );
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
            // Redirigir al frontend con el token y vencimiento
            const redirectWithToken = `${frontendUri}?token=${tokenData.access_token}&expires_in=${tokenData.expires_in}`;
            return res.redirect(redirectWithToken);
        } else {
            return res.redirect(`${frontendUri}?error=token_error`);
        }
    } catch (err) {
        console.error("Auth callback error:", err);
        return res.redirect(`${frontendUri}?error=auth_exception`);
    }
});

app.get("/api/meta/user", async (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];
    if (!accessToken) return res.status(401).json({ error: "Missing token" });

    try {
        const response = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${accessToken}`);
        const data = await response.json();
        res.json(data); // { id, name }
    } catch (err) {
        res.status(500).json({ error: "Error fetching user info", details: err });
    }
});

app.get("/api/meta/adaccounts", async (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];
    if (!accessToken) return res.status(401).json({ error: "Missing token" });

    try {
        const response = await fetch(`https://graph.facebook.com/v23.0/me/adaccounts?access_token=${accessToken}`);
        const data = await response.json();
        res.json(data.data); // devuelve un array de ad accounts
    } catch (err) {
        res.status(500).json({ error: "Error fetching ad accounts", details: err });
    }
});

// GET /api/meta/ads/:campaignId
app.get("/api/meta/campaigns/:adAccountId", async (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];
    const { adAccountId } = req.params;

    if (!accessToken) return res.status(401).json({ error: "Missing token" });

    try {
        const campaignsRes = await fetch(
            `https://graph.facebook.com/v23.0/${adAccountId}/campaigns?access_token=${accessToken}&fields=id,name,status`
        );
        const campaignsData = await campaignsRes.json();
        res.json(campaignsData.data);
    } catch (err) {
        res.status(500).json({ error: "Error fetching campaigns", details: err });
    }
});

app.get("/api/meta/ads/:campaignId", async (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1];
    const campaignId = req.params.campaignId;

    if (!accessToken) return res.status(401).json({ error: "Missing token" });

    try {
        const response = await fetch(
            `https://graph.facebook.com/v23.0/${campaignId}/ads?access_token=${accessToken}&fields=id,name,status,adset_id,creative{id,name,object_story_spec}`
        );
        const json = await response.json();

        if (json.error) {
            return res.status(500).json({ error: json.error.message });
        }

        res.json(json.data);
    } catch (err) {
        res.status(500).json({ error: "Error fetching ads", details: err });
    }
});

app.get("/api/meta/creative/:id", async (req, res) => {
    const creativeId = req.params.id;
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) return res.status(401).json({ error: "Missing token" });

    try {
        const result = await fetch(
            `https://graph.facebook.com/v23.0/${creativeId}?fields=thumbnail_url,image_url,object_story_spec&access_token=${accessToken}`
        );
        const json = await result.json();
        res.json(json);
    } catch (err) {
        res.status(500).json({ error: "Error fetching creative info", details: err });
    }
});

app.post("/api/meta/adsets", async (req, res) => {
    const token = req.headers.authorization?.split("Bearer ")[1];
    const { ad_account_id, campaign_id, name } = req.body;
    if (!token || !ad_account_id || !campaign_id || !name) {
        return res.status(400).json({ error: "Missing parameters" });
    }

    try {
        // 1. Tomar un AdSet existente dentro de la campaña
        const existingRes = await fetch(
            `https://graph.facebook.com/v17.0/${campaign_id}/adsets?fields=optimization_goal&limit=1`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const existingData = await existingRes.json();
        if (!existingRes.ok) {
            return res.status(400).json({ error: "Failed fetching existing adsets", details: existingData });
        }
        const existing = existingData.data?.[0];
        if (!existing) {
            return res.status(400).json({ error: "No existing adsets in this campaign. Can't determine optimization_goal." });
        }

        // 2. Usar el mismo optimization_goal
        const optimization_goal = existing.optimization_goal;

        // 3. Crear nuevo AdSet con ese mismo optimization_goal
        const createRes = await fetch(
            `https://graph.facebook.com/v17.0/${ad_account_id}/adsets`,
            {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    campaign_id,
                    billing_event: "IMPRESSIONS",
                    optimization_goal,
                    targeting: { geo_locations: { countries: ["US"] } },
                    start_time: new Date(Date.now() + 5 * 60000).toISOString(),
                    end_time: new Date(Date.now() + 7 * 86400000).toISOString(),
                    status: "PAUSED",
                }),
            }
        );
        const createData = await createRes.json();
        if (!createRes.ok) {
            return res.status(500).json({ error: createData.error || createData });
        }

        res.json(createData);
    } catch (err) {
        console.error("AdSet creation failed:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
