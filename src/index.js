import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import axios from 'axios';
import FormData from 'form-data'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const CHROME_PATH = path.join(
    __dirname,
    'node_modules',
    'puppeteer',
    '.local-chromium',
    'linux-1375495',
    'chrome-linux',
    'chrome'
);


app.get('/api/random-meta-video', async (req, res) => {
    let browser;
    try {
        const randomUrl = adUrls[Math.floor(Math.random() * adUrls.length)];

        browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
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
            responseType: 'arraybuffer',
        });

        const form = new FormData();
        form.append('video', Buffer.from(response.data), {
            filename: 'meta-video.mp4',
            contentType: 'video/mp4',
        });

        res.set(form.getHeaders());
        res.status(200).send(form.getBuffer());
    } catch (err) {
        console.error('❌ Error extracting video:', err.message);
        res.status(500).json({ error: 'Failed to extract or return video', details: err.message });
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
            executablePath: CHROME_PATH,
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
