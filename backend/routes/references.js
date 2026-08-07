const router = require('express').Router();
const mongoose = require('mongoose');
const Reference = require('../models/Reference');
const { requireSessionUser } = require('../utils/session');
const { rateLimit } = require('../utils/rateLimit');

router.use(requireSessionUser);
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, prefix: 'references-write', message: 'Too many reference changes. Please slow down.' });

function validateId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
}

async function scrapeUrl(targetUrl) {
  try {
    let urlToFetch = targetUrl.trim();
    if (!/^https?:\/\//i.test(urlToFetch)) {
      urlToFetch = 'https://' + urlToFetch;
    }
    const response = await fetch(urlToFetch, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(7000)
    });
    
    const html = await response.text();
    
    // Extract title
    let title = '';
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1];
    }

    // Extract description
    let description = '';
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (ogDescMatch) description = ogDescMatch[1];

    // Extract image
    let image = '';
    const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImgMatch) image = ogImgMatch[1];

    // Normalize relative image URLs
    if (image && !image.startsWith('http')) {
      try {
        const parsedUrl = new URL(urlToFetch);
        if (image.startsWith('/')) {
          image = `${parsedUrl.protocol}//${parsedUrl.host}${image}`;
        } else {
          image = `${parsedUrl.protocol}//${parsedUrl.host}/${image}`;
        }
      } catch (e) {}
    }

    return {
      title: title ? title.trim() : new URL(urlToFetch).hostname,
      description: description ? description.trim() : '',
      image: image || '',
      url: urlToFetch
    };
  } catch (err) {
    let cleanUrl = targetUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;
    let fallbackTitle = cleanUrl;
    try { fallbackTitle = new URL(cleanUrl).hostname; } catch(e){}
    return {
      title: fallbackTitle,
      description: '',
      image: '',
      url: cleanUrl
    };
  }
}

router.get('/', async (_, res) => {
  try { res.json(await Reference.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST Scrape endpoint
router.post('/scrape', writeLimiter, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const metadata = await scrapeUrl(url);
    res.json(metadata);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', writeLimiter, async (req, res) => {
  try { res.status(201).json(await Reference.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', validateId, writeLimiter, async (req, res) => {
  try { res.json(await Reference.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', validateId, writeLimiter, async (req, res) => {
  try { await Reference.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;


async function scrapeUrl(targetUrl) {
  try {
    let urlToFetch = targetUrl.trim();
    if (!/^https?:\/\//i.test(urlToFetch)) {
      urlToFetch = 'https://' + urlToFetch;
    }
    const response = await fetch(urlToFetch, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(7000)
    });
    
    const html = await response.text();
    
    // Extract title
    let title = '';
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1];
    }

    // Extract description
    let description = '';
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (ogDescMatch) description = ogDescMatch[1];

    // Extract image
    let image = '';
    const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImgMatch) image = ogImgMatch[1];

    // Normalize relative image URLs
    if (image && !image.startsWith('http')) {
      try {
        const parsedUrl = new URL(urlToFetch);
        if (image.startsWith('/')) {
          image = `${parsedUrl.protocol}//${parsedUrl.host}${image}`;
        } else {
          image = `${parsedUrl.protocol}//${parsedUrl.host}/${image}`;
        }
      } catch (e) {}
    }

    return {
      title: title ? title.trim() : new URL(urlToFetch).hostname,
      description: description ? description.trim() : '',
      image: image || '',
      url: urlToFetch
    };
  } catch (err) {
    let cleanUrl = targetUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;
    let fallbackTitle = cleanUrl;
    try { fallbackTitle = new URL(cleanUrl).hostname; } catch(e){}
    return {
      title: fallbackTitle,
      description: '',
      image: '',
      url: cleanUrl
    };
  }
}

router.get('/', async (_, res) => {
  try { res.json(await Reference.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST Scrape endpoint
router.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const metadata = await scrapeUrl(url);
    res.json(metadata);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try { res.status(201).json(await Reference.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try { res.json(await Reference.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await Reference.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
