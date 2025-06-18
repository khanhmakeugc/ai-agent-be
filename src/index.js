import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import axios from 'axios';
import FormData from 'form-data'

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
const defaultBrandUrl = 'https://thepetlabco.com/';
const defaultEmail = 'lautynievas09@gmail.com';

app.get('/api/get-user-video', async (req, res) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
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
                    const form = new FormData();
                    form.append('video', buffer, {
                        filename: 'user-meta-video.mp4',
                        contentType: 'video/mp4',
                    });
                    form.append('brandUrl', defaultBrandUrl);
                    form.append('email', defaultEmail);

                    res.set(form.getHeaders());
                    return form.pipe(res);
                }
            } catch (err) {
                console.log(`⚠️ Falló al intentar usar video: ${err.message}`);
                continue;
            }
        }

        return res.status(404).json({ error: 'No se encontró un video menor a 25MB' });

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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
