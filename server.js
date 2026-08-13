// server.js - Robust KissKH HLS Video Stream & Subtitles Backend (Render & Vercel Compatible)
const express = require('express');
const axios = require('axios');
const path = require('path');
const kkey = require('./kkey');
const proxyManager = require('./proxyManager');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

// Global CORS Middleware - Ensures CORS headers on ALL requests, including preflight & errors
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const KISSKH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://kisskh.is/",
  "Origin": "https://kisskh.is"
};

// In-Memory Cache
const epCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Search Endpoint (Strictly capped at MAX 5 results) ──────────────────────
app.get('/api/search', async (req, res) => {
  const query = (req.query.q || req.query.query || '').trim();
  if (!query) {
    return res.status(400).json({ success: false, error: "Missing search query 'q'." });
  }

  try {
    const rawData = await proxyManager.fetchFromProxyPool(
      `/DramaList/Search?q=${encodeURIComponent(query)}`,
      {},
      KISSKH_HEADERS
    );
    const items = Array.isArray(rawData) ? rawData : [];

    // Strictly limit search results to MAX 5 items
    const formatted = items.slice(0, 5).map(item => ({
      id: item.id,
      title: item.title || 'Untitled Drama',
      thumbnail: item.thumbnail || null,
      country: item.country || 'Asian Drama',
      episodes_count: item.episodesCount || 1,
      status: item.label || ''
    }));

    res.json({
      success: true,
      query: query,
      total_results: formatted.length,
      results: formatted
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Search failed: ${err.message}` });
  }
});

// ── Drama Details & Episodes List ───────────────────────────────────────────
app.get('/api/drama/:id', async (req, res) => {
  const dramaId = parseInt(req.params.id, 10);
  if (isNaN(dramaId)) {
    return res.status(400).json({ success: false, error: "Invalid drama ID." });
  }

  try {
    const data = await proxyManager.fetchFromProxyPool(
      `/DramaList/Drama/${dramaId}`,
      {},
      KISSKH_HEADERS
    );

    if (!data || !data.id) {
      return res.status(404).json({ success: false, error: "Drama not found." });
    }

    const rawEpisodes = Array.isArray(data.episodes) ? data.episodes : [];
    // Sort episodes ascending by episode number
    const episodes = [...rawEpisodes].sort((a, b) => (a.number || 0) - (b.number || 0)).map(ep => ({
      id: ep.id,
      number: ep.number,
      subtitles_count: ep.sub || 0
    }));

    res.json({
      success: true,
      drama: {
        id: data.id,
        title: data.title || 'Untitled Drama',
        thumbnail: data.thumbnail || null,
        status: data.status || '',
        country: data.country || '',
        episodes_count: data.episodesCount || episodes.length,
        episodes: episodes
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Failed to fetch drama: ${err.message}` });
  }
});

// ── Episode Stream & Subtitle Extractor ────────────────────────────────────
app.get('/api/episode/:id', async (req, res) => {
  const episodeId = parseInt(req.params.id, 10);
  if (isNaN(episodeId)) {
    return res.status(400).json({ success: false, error: "Invalid episode ID." });
  }

  const epKey = String(episodeId);
  const now = Date.now();

  if (epCache.has(epKey)) {
    const cached = epCache.get(epKey);
    if (now - cached.ts < CACHE_TTL_MS) {
      return res.json({ ...cached.data, cached: true });
    }
  }

  try {
    const kkeyStream = kkey.getKkey(episodeId, 'vid');
    const kkeySub = kkey.getKkey(episodeId, 'sub');

    let streamData = null;
    let subData = [];

    await Promise.all([
      proxyManager.fetchFromProxyPool(`/DramaList/Episode/${episodeId}.png`, {
        err: 'false', ts: '', time: '', kkey: kkeyStream
      }, KISSKH_HEADERS).then(r => { streamData = r; }),

      proxyManager.fetchFromProxyPool(`/Sub/${episodeId}`, {
        kkey: kkeySub
      }, KISSKH_HEADERS).then(r => { subData = Array.isArray(r) ? r : []; })
        .catch(err => { console.warn(`Subtitle fetch notice: ${err.message}`); })
    ]);

    if (!streamData || !streamData.Video) {
      return res.status(500).json({ success: false, error: "Stream URL extraction failed from KissKH." });
    }

    const rawStreamUrl = streamData.Video || "";
    // Use relative path for proxy URLs to ensure same-origin requests across Vercel custom domains & preview URLs
    const playerReadyUrl = rawStreamUrl
      ? `/api/proxy?url=${encodeURIComponent(rawStreamUrl)}`
      : "";

    const formattedSubs = subData.map(s => ({
      label: s.label || "Unknown",
      language: s.land || "en",
      url: s.src ? `/api/proxy?url=${encodeURIComponent(s.src)}` : "",
      raw_url: s.src || "",
      default: !!s.default
    })).filter(s => s.url);

    const defaultSub = formattedSubs.find(s => s.default) || formattedSubs[0] || null;
    const isHlsType = streamData.Type === 1 || rawStreamUrl.includes('.m3u8');

    const result = {
      success: true,
      episode_id: episodeId,
      stream: {
        url: rawStreamUrl,
        player_ready_url: playerReadyUrl,
        type: isHlsType ? "hls" : "mp4"
      },
      subtitles: formattedSubs,
      artplayer: {
        url: playerReadyUrl || rawStreamUrl,
        type: isHlsType ? "m3u8" : "mp4",
        subtitle: defaultSub ? {
          url: defaultSub.url,
          type: "vtt",
          style: { color: "#ffffff", fontSize: "18px", fontFamily: "'Rubik', sans-serif" }
        } : null,
        subtitles: formattedSubs.map(s => ({
          html: s.label,
          url: s.url,
          default: s.default
        }))
      },
      cached: false
    };

    epCache.set(epKey, { ts: now, data: result });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: `Episode resolution failed: ${err.message}` });
  }
});

// Helper function: Rewrite URLs inside M3U8 playlists to route segments through proxy relative path
function rewritePlaylistUrls(playlistText, baseUrl) {
  const lines = playlistText.split('\n');
  const rewrittenLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      return line.replace(/URI="(.*?)"/g, (match, uri) => {
        try {
          const absolute = new URL(uri, baseUrl).href;
          const proxied = `/api/proxy?url=${encodeURIComponent(absolute)}`;
          return `URI="${proxied}"`;
        } catch (e) {
          return match;
        }
      });
    }

    try {
      const absolute = new URL(trimmed, baseUrl).href;
      return `/api/proxy?url=${encodeURIComponent(absolute)}`;
    } catch (e) {
      return line;
    }
  });

  return rewrittenLines.join('\n');
}

// ── Resilient CORS Media Stream & Subtitle Proxy ────────────────────────────
app.get('/api/proxy', async (req, res) => {
  // Set CORS headers immediately before doing any async network operations
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  const targetUrl = req.query.url;
  const customReferer = req.query.referer || 'https://kisskh.is/';
  const customOrigin = req.query.origin || 'https://kisskh.is';

  if (!targetUrl) {
    return res.status(400).send("Missing proxy URL parameter.");
  }

  const lowerUrl = targetUrl.toLowerCase();

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': customReferer,
      'Origin': customOrigin,
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const isTextResource = lowerUrl.includes('.m3u8') || 
                           lowerUrl.includes('.srt') || 
                           lowerUrl.includes('.vtt') || 
                           lowerUrl.includes('.txt1') ||
                           lowerUrl.includes('.txt');

    // 1. FOR PLAYLISTS & SUBTITLES: Load text buffer for rewriting/formatting
    if (isTextResource) {
      const response = await axios.get(targetUrl, {
        headers: headers,
        responseType: 'arraybuffer',
        timeout: 12000,
        validateStatus: status => status < 500
      });

      const rawBuffer = Buffer.from(response.data);
      const contentType = (response.headers['content-type'] || '').toLowerCase();
      const textSnippet = rawBuffer.toString('utf8', 0, Math.min(rawBuffer.length, 512));

      const isPlaylist = contentType.includes('mpegurl') || 
                         contentType.includes('m3u8') || 
                         textSnippet.trimStart().startsWith('#EXTM3U') ||
                         lowerUrl.split('?')[0].endsWith('.m3u8');

      res.setHeader('Cache-Control', 'no-cache');

      if (isPlaylist) {
        const playlistText = rawBuffer.toString('utf8');
        const rewrittenPlaylist = rewritePlaylistUrls(playlistText, targetUrl);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        return res.status(response.status).send(rewrittenPlaylist);
      }

      if (lowerUrl.includes('.srt') || lowerUrl.includes('.txt1')) {
        let subText = rawBuffer.toString('utf8');
        if (!subText.trim().startsWith('WEBVTT')) {
          subText = 'WEBVTT\n\n' + subText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        }
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        return res.status(200).send(subText);
      }

      if (lowerUrl.includes('.vtt')) {
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        return res.status(200).send(rawBuffer);
      }
    }

    // 2. FOR BINARY VIDEO MEDIA STREAMS (.mp4, .ts, etc.): Use responseType: 'stream' & pipe directly with Range support
    const response = await axios.get(targetUrl, {
      headers: headers,
      responseType: 'stream',
      timeout: 25000,
      validateStatus: status => status < 500
    });

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (lowerUrl.includes('.ts') || (response.headers['content-type'] || '').includes('mp2t')) {
      res.setHeader('Content-Type', 'video/mp2t');
    } else if (lowerUrl.includes('.mp4') || (response.headers['content-type'] || '').includes('mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    } else {
      res.setHeader('Content-Type', 'video/mp4');
    }

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
      res.status(206);
    } else {
      res.status(response.status);
    }

    response.data.pipe(res);

  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: `Proxy fetch error: ${err.message}` });
    }
  }
});

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`⚡ KissKH LightKD Web Server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
