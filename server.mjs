import { chromium } from 'playwright';
import http from 'http';
import url from 'url';

const PORT = process.env.PORT || 3000;
const TIMEOUT = 30000;

const PROVIDERS = [
  { name: 'VidSrc', build: (t, id) => `https://vidsrc.to/embed/${t}/${id}` },
  { name: 'VidSrcPM', build: (t, id) => `https://vidsrc.pm/embed/${t}/${id}` },
  { name: '2Embed', build: (t, id) => `https://www.2embed.cc/embed/${t}/${id}` },
  { name: 'EmbedSu', build: (t, id) => `https://embed.su/embed/${t}/${id}` },
  { name: 'MultiEmbed', build: (t, id) => `https://multiembed.mov/?video_id=${id}&tmdb=1` },
  { name: 'VidCore', build: (t, id) => `https://www.vidcore.org/embed/${t}/${id}` },
  { name: 'LetsEmbed', build: (t, id) => `https://letsembed.cc/embed/${t}/?id=${id}` },
  { name: 'DXStream', build: (t, id) => `https://scylla.dxstream.net/embed/${id}` },
];

async function extractFromBrowser(pageUrl) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
    const page = await ctx.newPage();
    let hlsUrl = null;

    page.on('response', async (res) => {
      const u = res.url();
      if (u.includes('.m3u8')) hlsUrl = u;
    });

    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('.m3u8')) hlsUrl = u;
    });

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: TIMEOUT });
      await page.waitForTimeout(3000);
    } catch {}

    if (!hlsUrl) {
      hlsUrl = await page.evaluate(() => {
        const v = document.querySelector('video');
        if (v) return v.src || v.querySelector('source')?.src || null;
        const iframe = document.querySelector('iframe');
        return iframe?.src || null;
      });
    }

    return hlsUrl;
  } finally {
    await browser.close();
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.end();

  const p = url.parse(req.url, true);
  const m = p.pathname.match(/^\/api\/streams\/(movie|tv)\/(\d+)/i);
  if (!m) {
    if (p.pathname === '/api/health' || p.pathname === '/') return res.end(JSON.stringify({ ok: true }));
    return res.writeHead(404).end(JSON.stringify({ error: 'Use /api/streams/movie/:id' }));
  }

  const type = m[1];
  const tmdbId = m[2];
  const t = type === 'movie' ? 'movie' : 'tv';
  const results = {};

  for (const prov of PROVIDERS) {
    const pageUrl = prov.build(t, tmdbId);
    try {
      const hls = await extractFromBrowser(pageUrl);
      results[prov.name] = hls || null;
    } catch (e) {
      results[prov.name] = null;
    }
  }

  const streams = {};
  for (const [name, hls] of Object.entries(results)) {
    if (hls && (hls.includes('.m3u8') || hls.includes('.mp4'))) {
      streams[name] = { url: hls, type: hls.includes('.m3u8') ? 'hls' : 'mp4' };
    }
  }

  res.end(JSON.stringify({ success: true, tmdbId, count: Object.keys(streams).length, streams }));
});

server.listen(PORT, () => console.log(`Playwright proxy on :${PORT}`));
