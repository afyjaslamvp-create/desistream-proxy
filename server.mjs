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

async function extractFromPage(pageUrl) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  let m3u8 = null;

  await page.route('**/*', (route) => {
    const rt = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(rt))
      return route.abort();
    route.continue();
  });

  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('.m3u8')) m3u8 = u.split('?')[0];
  });

  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('.m3u8')) m3u8 = u.split('?')[0];
  });

  // Load embed page
  try {
    console.log(`  Loading ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
  } catch {}

  // Check for video or player
  if (!m3u8) {
    try {
      m3u8 = await page.evaluate(() => {
        const v = document.querySelector('video');
        if (v?.src) return v.src;
        const s = v?.querySelector('source');
        if (s?.src) return s.src;
        const allS = document.querySelectorAll('source');
        for (const src of allS) { if (src.src) return src.src; }
        // If no video, check for iframe
        const ifr = document.querySelector('iframe');
        return ifr?.src || null;
      });

      // If we got an iframe URL (not m3u8), follow it
      if (m3u8 && !m3u8.includes('.m3u8') && !m3u8.includes('.mp4')) {
        const iframeUrl = m3u8;
        m3u8 = null;
        console.log(`  Following iframe: ${iframeUrl}`);
        try {
          await page.goto(iframeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(8000);
        } catch {}
        // Check for video/m3u8 in iframe page
        if (!m3u8) {
          try {
            m3u8 = await page.evaluate(() => {
              const v = document.querySelector('video');
              if (v?.src) return v.src;
              const s = v?.querySelector('source');
              if (s?.src) return s.src;
              return null;
            });
          } catch {}
        }
      }
    } catch {}
  }

  await ctx.close();
  return m3u8;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.end();

  const p = url.parse(req.url, true);

  if (p.pathname === '/api/health') {
    return res.end(JSON.stringify({ ok: true }));
  }

  const m = p.pathname.match(/^\/api\/streams\/(movie|tv)\/(\d+)/i);
  if (!m) {
    return res.writeHead(404).end(JSON.stringify({ error: 'use /api/streams/movie/:id' }));
  }

  const tmdbId = m[2];
  const type = m[1];
  const t = type === 'movie' ? 'movie' : 'tv';

  // Try multiple providers, stop at first success
  const providers = [
    `https://vidsrc.to/embed/${t}/${tmdbId}`,
    `https://vidsrc.pm/embed/${t}/${tmdbId}`,
    `https://embed.su/embed/${t}/${tmdbId}`,
    `https://www.2embed.cc/embed/${t}/${tmdbId}`,
  ];

  let streamUrl = null;
  let providerName = null;
  console.log(`\nExtract ${type}/${tmdbId}`);

  for (const provUrl of providers) {
    const name = provUrl.split('/')[2];
    try {
      const hls = await extractFromPage(provUrl);
      if (hls && (hls.includes('.m3u8') || hls.includes('.mp4'))) {
        streamUrl = hls;
        providerName = name;
        console.log(`  ${name}: FOUND ${hls.substring(0, 100)}`);
        break;
      }
      console.log(`  ${name}: no stream`);
    } catch (e) {
      console.log(`  ${name}: error ${e.message}`);
    }
  }

  res.end(JSON.stringify({
    success: !!streamUrl,
    tmdbId, type,
    url: streamUrl,
    type_hint: streamUrl?.includes('.m3u8') ? 'hls' : streamUrl?.includes('.mp4') ? 'mp4' : undefined,
    provider: providerName,
    streams: streamUrl ? { [providerName]: { url: streamUrl } } : {},
  }));
});

init().then(() => {
  server.listen(PORT, () => console.log(`Ready :${PORT}`));
}).catch(e => {
  console.error('Browser launch failed:', e);
  process.exit(1);
});
