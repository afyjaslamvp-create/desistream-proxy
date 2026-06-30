import { chromium } from 'playwright';
import http from 'http';
import url from 'url';

const PORT = process.env.PORT || 3000;
let browser;

async function init() {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-gpu', '--disable-dev-shm-usage',
      '--single-process', '--no-zygote',
      '--disable-accelerated-2d-canvas', '--disable-software-rasterizer',
    ],
  });
}

async function extract(tmdbId, type) {
  const t = type === 'movie' ? 'movie' : 'tv';
  const sources = [
    { name: 'VidSrc', url: `https://vidsrc.to/embed/${t}/${tmdbId}` },
    { name: 'VidSrcPM', url: `https://vidsrc.pm/embed/${t}/${tmdbId}` },
    { name: '2Embed', url: `https://www.2embed.cc/embed/${t}/${tmdbId}` },
  ];

  for (const src of sources) {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
    const page = await ctx.newPage();
    let hls = null;

    await page.route('**/*', (route) => {
      const rt = route.request().resourceType();
      if (['image','stylesheet','font','media'].includes(rt)) return route.abort();
      const u = route.request().url();
      if (u.includes('.m3u8')) hls = u;
      route.continue();
    });

    page.on('request', (req) => { if (req.url().includes('.m3u8')) hls = req.url(); });
    page.on('response', (res) => { if (res.url().includes('.m3u8')) hls = res.url(); });

    try {
      await page.goto(src.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(5000);
    } catch {}

    if (!hls) {
      try {
        hls = await page.evaluate(() => {
          const v = document.querySelector('video');
          if (v?.src) return v.src;
          const s = v?.querySelector('source');
          if (s?.src) return s.src;
          const f = document.querySelector('iframe');
          return f?.src || null;
        });
      } catch {}
    }

    await ctx.close();
    if (hls) return { source: src.name, url: hls };
  }

  return { error: 'no stream found' };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.end();

  const p = url.parse(req.url, true);

  if (p.pathname === '/api/test') {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const title = await page.title();
      await ctx.close();
      return res.end(JSON.stringify({ ok: true, title }));
    } catch (e) {
      await ctx.close();
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  const m = p.pathname.match(/^\/api\/streams\/(movie|tv)\/(\d+)/i);
  if (!m) {
    if (p.pathname === '/api/health') return res.end(JSON.stringify({ ok: true }));
    return res.writeHead(404).end(JSON.stringify({ error: 'use /api/streams/movie/:id' }));
  }

  console.log(`Extract ${m[1]}/${m[2]}`);
  const result = await extract(m[2], m[1]);
  console.log(`Result:`, JSON.stringify(result).substring(0, 200));
  res.end(JSON.stringify(result));
});

init().then(() => {
  server.listen(PORT, () => console.log(`Ready :${PORT}`));
}).catch(e => {
  console.error('Browser launch failed:', e);
  process.exit(1);
});
